import Foundation

/// Mirrors public.notes. Only the columns the app reads/writes are declared;
/// unknown columns (e.g. the rich `content` JSON) are ignored on decode.
struct Note: Identifiable, Codable, Equatable, Hashable {
    var id: UUID
    var title: String
    var contentText: String
    var categoryId: UUID?
    var pinned: Bool
    var archived: Bool
    // Kept as raw ISO strings (e.g. "2026-06-23T18:00:42.284857+00:00") so decoding
    // never fails on Postgres' variable fractional-second timestamps.
    var createdAt: String
    var updatedAt: String

    enum CodingKeys: String, CodingKey {
        case id, title, pinned, archived
        case contentText = "content_text"
        case categoryId = "category_id"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }

    var updatedDate: Date { Note.parseTimestamp(updatedAt) }

    static func nowISO() -> String { iso(Date()) }

    static func iso(_ date: Date) -> String {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f.string(from: date)
    }

    static func parseTimestamp(_ s: String) -> Date {
        let withFrac = ISO8601DateFormatter()
        withFrac.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let d = withFrac.date(from: s) { return d }
        // Fall back: strip the fractional seconds, keep the timezone offset.
        if let dot = s.firstIndex(of: ".") {
            let rest = s[s.index(after: dot)...]
            if let tzStart = rest.firstIndex(where: { $0 == "+" || $0 == "-" || $0 == "Z" }) {
                let trimmed = String(s[..<dot]) + String(rest[tzStart...])
                let plain = ISO8601DateFormatter()
                plain.formatOptions = [.withInternetDateTime]
                if let d = plain.date(from: trimmed) { return d }
            }
        }
        return .distantPast
    }
}

/// Mirrors public.categories.
struct Category: Identifiable, Codable, Equatable, Hashable {
    var id: UUID
    var name: String
    var color: String
    var sortOrder: Int

    enum CodingKeys: String, CodingKey {
        case id, name, color
        case sortOrder = "sort_order"
    }
}

// MARK: - Tiptap doc bridge
// The website renders the `content` JSON (Tiptap), not `content_text`. The phone reads AND
// writes that JSON — including `linkPreview` block nodes ({type:"linkPreview",attrs:{url}}) —
// so link previews (and text) stay in sync with the website both ways.

struct TiptapText: Encodable {
    let type = "text"
    let text: String
}

struct TiptapBlock: Encodable {
    let type: String
    let attrs: [String: String]?
    let content: [TiptapText]?
}

struct TiptapDoc: Encodable {
    let type = "doc"
    let content: [TiptapBlock]
    init(content: [TiptapBlock]) { self.content = content }
    init(plainText: String) { self.init(content: NoteContent.build(from: plainText).doc.content) }
}

// Decoding the stored content JSON back to editor text.
struct TDoc: Decodable { let content: [TNode]? }
struct TNode: Decodable {
    let type: String
    let attrs: TAttrs?
    let content: [TInline]?
}
struct TAttrs: Decodable { let url: String? }
struct TInline: Decodable { let text: String? }

enum NoteContent {
    /// Build the Tiptap doc + plain content_text from the editor's plain-text body.
    /// URL-only lines become `linkPreview` nodes (matching the website) so previews sync.
    static func build(from body: String) -> (doc: TiptapDoc, text: String) {
        var blocks: [TiptapBlock] = []
        var textLines: [String] = []
        for line in body.components(separatedBy: "\n") {
            if let url = urlOnly(line) {
                blocks.append(TiptapBlock(type: "linkPreview", attrs: ["url": url], content: nil))
            } else {
                blocks.append(TiptapBlock(type: "paragraph", attrs: nil,
                                          content: line.isEmpty ? nil : [TiptapText(text: line)]))
                textLines.append(line)
            }
        }
        if blocks.isEmpty { blocks = [TiptapBlock(type: "paragraph", attrs: nil, content: nil)] }
        return (TiptapDoc(content: blocks), textLines.joined(separator: "\n"))
    }

    /// Reconstruct the editor body from stored content (linkPreview urls become text lines).
    static func body(from doc: TDoc) -> String {
        var lines: [String] = []
        for node in doc.content ?? [] {
            switch node.type {
            case "linkPreview":
                if let url = node.attrs?.url, !url.isEmpty { lines.append(url) }
            case "image":
                break
            default:
                lines.append((node.content ?? []).compactMap { $0.text }.joined())
            }
        }
        return lines.joined(separator: "\n")
    }

    /// If a trimmed line is exactly one http(s) URL, return it.
    static func urlOnly(_ line: String) -> String? {
        let trimmed = line.trimmingCharacters(in: .whitespaces)
        guard !trimmed.isEmpty,
              let detector = try? NSDataDetector(types: NSTextCheckingResult.CheckingType.link.rawValue)
        else { return nil }
        let ns = trimmed as NSString
        let matches = detector.matches(in: trimmed, range: NSRange(location: 0, length: ns.length))
        if matches.count == 1, let m = matches.first, m.range.length == ns.length,
           let url = m.url, url.scheme == "http" || url.scheme == "https" {
            return url.absoluteString
        }
        return nil
    }
}

// MARK: - Write payloads

struct NoteInsert: Encodable {
    let title: String
    let content: TiptapDoc
    let content_text: String
    let category_id: String?
}

struct NoteContentUpdate: Encodable {
    let title: String
    let content: TiptapDoc
    let content_text: String
}

struct NoteFlagsUpdate: Encodable {
    let pinned: Bool?
    let archived: Bool?
    let category_id: String?
}

/// Mirrors public.attachments (image stored in the private `note-images` bucket).
struct Attachment: Identifiable, Codable, Hashable {
    var id: UUID
    var noteId: UUID
    var storagePath: String

    enum CodingKeys: String, CodingKey {
        case id
        case noteId = "note_id"
        case storagePath = "storage_path"
    }
}

struct AttachmentInsert: Encodable {
    let note_id: String
    let storage_path: String
}

/// A note attachment resolved for display: attachment id, storage path, and a signed URL.
/// Holds both images and videos — `isVideo` is derived from the file extension.
struct NoteImage: Identifiable, Hashable {
    let id: UUID
    let path: String
    let url: URL

    var ext: String { (path as NSString).pathExtension.lowercased() }
    var isVideo: Bool { NoteImage.videoExts.contains(ext) }

    static let videoExts: Set<String> = ["mp4", "mov", "webm", "mkv", "avi", "m4v", "mpg", "mpeg"]

    /// MIME type for a video file extension (used for storage upload + Gemini Files API).
    static func videoMime(ext: String) -> String {
        switch ext.lowercased() {
        case "mov": return "video/quicktime"
        case "webm": return "video/webm"
        case "m4v": return "video/x-m4v"
        case "mkv": return "video/x-matroska"
        case "avi": return "video/x-msvideo"
        case "mpg", "mpeg": return "video/mpeg"
        default: return "video/mp4"
        }
    }
}

/// An ordered video available to the note's AI chat: either an uploaded file (resolved to a
/// Gemini Files API uri on demand) or a YouTube link (watched natively by Gemini).
/// `label` is a stable position name ("Video 1") the user can reference in chat.
struct NoteVideo: Identifiable, Hashable {
    enum Source: Hashable {
        case upload(url: URL, path: String)
        case youtube(String)
    }
    let id: String
    let label: String
    let source: Source
}

// MARK: - Category writes

struct CategoryInsert: Encodable {
    let name: String
    let color: String
    let sort_order: Int
}

struct CategoryUpdate: Encodable {
    let name: String
    let color: String
}

// MARK: - Reminders (public.reminders)

struct Reminder: Identifiable, Codable, Hashable {
    var id: UUID
    var noteId: UUID
    var remindAt: String
    var message: String

    enum CodingKeys: String, CodingKey {
        case id, message
        case noteId = "note_id"
        case remindAt = "remind_at"
    }

    var remindDate: Date { Note.parseTimestamp(remindAt) }
}

struct ReminderInsert: Encodable {
    let note_id: String
    let remind_at: String
    let message: String
}
