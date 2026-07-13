import Foundation

/// Streams chat completions from Gemini's native endpoint with the google_search tool enabled,
/// so the assistant can browse the web for current information. Tokens stream for a live effect.
/// Also understands video: a YouTube URL (watched natively) or an uploaded file (via the Files API).
enum AI {
    static let model = "gemini-3-flash-preview"
    static let apiBase = "https://generativelanguage.googleapis.com"
    static var endpoint: URL {
        URL(string: "\(apiBase)/v1beta/models/\(model):streamGenerateContent?alt=sse")!
    }

    struct Message: Identifiable, Equatable, Codable {
        var id = UUID()
        var role: String   // "system" | "user" | "assistant"
        var content: String
    }

    /// A video the model can watch, as a Gemini `fileData` part.
    enum VideoPart: Equatable {
        case youtube(url: String)
        case file(uri: String, mime: String)

        var part: [String: Any] {
            switch self {
            case let .youtube(url):
                return ["fileData": ["fileUri": url]]
            case let .file(uri, mime):
                return ["fileData": ["fileUri": uri, "mimeType": mime]]
            }
        }
    }

    enum AIError: LocalizedError {
        case http(Int, String)
        var errorDescription: String? {
            switch self {
            case let .http(code, body): return "AI request failed (\(code)). \(body)"
            }
        }
    }

    /// Stream a chat completion. Any `videos` (with their position labels) are attached to the
    /// latest user turn, so the model can watch them and the user can refer to them by order.
    static func stream(messages: [Message], videos: [(label: String, part: VideoPart)] = []) -> AsyncThrowingStream<String, Error> {
        // Native Gemini shape: contents (user/model) + systemInstruction; system is separate.
        var contents: [[String: Any]] = []
        var systemText: String?
        for m in messages {
            if m.role == "system" { systemText = m.content; continue }
            let role = m.role == "assistant" ? "model" : "user"
            contents.append(["role": role, "parts": [["text": m.content]]])
        }

        // Attach labeled video parts to the front of the last user turn's parts.
        if !videos.isEmpty, let lastUser = contents.lastIndex(where: { ($0["role"] as? String) == "user" }) {
            let parts = contents[lastUser]["parts"] as? [[String: Any]] ?? []
            var prefix: [[String: Any]] = []
            for v in videos {
                prefix.append(["text": "\(v.label):"])
                prefix.append(v.part.part)
            }
            contents[lastUser]["parts"] = prefix + parts
        }

        return streamContents(contents, systemText: systemText)
    }

    /// Core SSE stream over a prepared `contents` array. Shared by chat and video calls.
    private static func streamContents(_ contents: [[String: Any]], systemText: String?) -> AsyncThrowingStream<String, Error> {
        AsyncThrowingStream { continuation in
            let task = Task {
                do {
                    var body: [String: Any] = [
                        "contents": contents,
                        // google_search: browse the web; url_context: read the content of any
                        // URL in the prompt (news, YouTube, etc.).
                        "tools": [
                            ["google_search": [String: String]()],
                            ["url_context": [String: String]()],
                        ],
                    ]
                    if let systemText {
                        body["systemInstruction"] = ["parts": [["text": systemText]]]
                    }

                    var req = URLRequest(url: endpoint)
                    req.httpMethod = "POST"
                    req.setValue(Config.geminiKey, forHTTPHeaderField: "x-goog-api-key")
                    req.setValue("application/json", forHTTPHeaderField: "Content-Type")
                    req.httpBody = try JSONSerialization.data(withJSONObject: body)

                    var attempt = 0
                    while true {
                        attempt += 1
                        let (bytes, response) = try await URLSession.shared.bytes(for: req)
                        let status = (response as? HTTPURLResponse)?.statusCode ?? 0

                        if status == 200 {
                            for try await line in bytes.lines {
                                guard line.hasPrefix("data:") else { continue }
                                let chunk = line.dropFirst(5).trimmingCharacters(in: .whitespaces)
                                if chunk.isEmpty || chunk == "[DONE]" { continue }
                                guard let data = chunk.data(using: .utf8),
                                      let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                                      let candidates = json["candidates"] as? [[String: Any]],
                                      let content = candidates.first?["content"] as? [String: Any],
                                      let parts = content["parts"] as? [[String: Any]] else { continue }
                                for part in parts {
                                    if let text = part["text"] as? String { continuation.yield(text) }
                                }
                            }
                            continuation.finish()
                            return
                        }

                        var errBody = ""
                        for try await line in bytes.lines { errBody += line; if errBody.count > 400 { break } }
                        if status == 503 || status == 429, attempt < 4 {
                            // Back off progressively for rate limits.
                            try await Task.sleep(nanoseconds: UInt64(attempt) * 2_000_000_000)
                            continue
                        }
                        let friendly: String
                        switch status {
                        case 429: friendly = "You've hit the free AI usage limit for now. Wait a minute and try again — or add billing / an unrestricted key for higher limits."
                        case 503: friendly = "The AI is busy right now — try again in a moment."
                        default: friendly = errBody
                        }
                        continuation.finish(throwing: AIError.http(status, friendly))
                        return
                    }
                } catch {
                    continuation.finish(throwing: error)
                }
            }
            continuation.onTermination = { _ in task.cancel() }
        }
    }

    // MARK: - Files API (upload a video so the model can watch it)

    /// Upload a video file to Gemini's Files API (resumable), poll until the file is ACTIVE,
    /// and return its `fileUri` for use in a `fileData` part. Mirrors client.files.upload.
    /// Streams from disk (never loads the video into memory).
    static func uploadVideo(fileURL: URL, mime: String, displayName: String) async throws -> String {
        let size = (try? FileManager.default.attributesOfItem(atPath: fileURL.path)[.size] as? Int) ?? 0
        guard size > 0 else { throw AIError.http(0, "The video file is empty.") }
        guard size <= NotesStore.maxVideoBytes else {
            throw AIError.http(0, "That video is too large for AI analysis — keep it under 200 MB.")
        }

        // 1. Start a resumable upload session.
        var start = URLRequest(url: URL(string: "\(apiBase)/upload/v1beta/files")!)
        start.httpMethod = "POST"
        start.setValue(Config.geminiKey, forHTTPHeaderField: "x-goog-api-key")
        start.setValue("resumable", forHTTPHeaderField: "X-Goog-Upload-Protocol")
        start.setValue("start", forHTTPHeaderField: "X-Goog-Upload-Command")
        start.setValue(String(size), forHTTPHeaderField: "X-Goog-Upload-Header-Content-Length")
        start.setValue(mime, forHTTPHeaderField: "X-Goog-Upload-Header-Content-Type")
        start.setValue("application/json", forHTTPHeaderField: "Content-Type")
        start.httpBody = try JSONSerialization.data(withJSONObject: ["file": ["display_name": displayName]])

        let (_, startResp) = try await URLSession.shared.data(for: start)
        guard let http = startResp as? HTTPURLResponse, http.statusCode == 200,
              let uploadURLStr = http.value(forHTTPHeaderField: "X-Goog-Upload-URL")
                  ?? http.value(forHTTPHeaderField: "x-goog-upload-url"),
              let uploadURL = URL(string: uploadURLStr)
        else {
            throw AIError.http((startResp as? HTTPURLResponse)?.statusCode ?? 0, "Couldn't start the video upload.")
        }

        // 2. Upload the bytes (streamed from disk) and finalize in one shot.
        var up = URLRequest(url: uploadURL)
        up.httpMethod = "POST"
        up.setValue(String(size), forHTTPHeaderField: "Content-Length")
        up.setValue("0", forHTTPHeaderField: "X-Goog-Upload-Offset")
        up.setValue("upload, finalize", forHTTPHeaderField: "X-Goog-Upload-Command")
        let (upData, _) = try await URLSession.shared.upload(for: up, fromFile: fileURL)

        guard let json = try? JSONSerialization.jsonObject(with: upData) as? [String: Any],
              let file = json["file"] as? [String: Any],
              let name = file["name"] as? String,
              let uri = file["uri"] as? String
        else {
            throw AIError.http(0, "The video upload failed.")
        }

        // 3. Poll until the file finishes processing (ACTIVE) or fails.
        var state = file["state"] as? String ?? "PROCESSING"
        var attempts = 0
        while state == "PROCESSING", attempts < 90 {
            try await Task.sleep(nanoseconds: 2_000_000_000)
            attempts += 1
            var get = URLRequest(url: URL(string: "\(apiBase)/v1beta/\(name)")!)
            get.setValue(Config.geminiKey, forHTTPHeaderField: "x-goog-api-key")
            let (gData, _) = try await URLSession.shared.data(for: get)
            if let gjson = try? JSONSerialization.jsonObject(with: gData) as? [String: Any] {
                state = gjson["state"] as? String ?? state
            }
        }
        if state == "FAILED" { throw AIError.http(0, "Gemini couldn't process this video.") }
        if state == "PROCESSING" { throw AIError.http(0, "Timed out preparing the video. Try a shorter clip.") }
        return uri
    }
}
