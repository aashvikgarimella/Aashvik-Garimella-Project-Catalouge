import Foundation
import Supabase

@MainActor
final class NotesStore: ObservableObject {
    @Published var notes: [Note] = []
    @Published var categories: [Category] = []
    @Published var remindersByNote: [UUID: Reminder] = [:]
    @Published var loading = false
    @Published var error: String?

    private static let cacheFileURL: URL = {
        let dir = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
        return dir.appendingPathComponent("notes-cache.json")
    }()
    private var cacheURL: URL { Self.cacheFileURL }

    /// Delete the on-disk notes cache — called on sign-out so the next account
    /// on this device can't see the previous user's notes flash up from cache.
    static func wipeCache() {
        try? FileManager.default.removeItem(at: cacheFileURL)
    }

    // MARK: Loading

    /// Show cached notes instantly, then refresh from the server.
    func start() {
        loadCache()
        Task { await refresh() }
    }

    func refresh() async {
        loading = true
        defer { loading = false }
        do {
            let fetched: [Note] = try await supabase
                .from("notes")
                .select()
                .eq("archived", value: false)
                .order("pinned", ascending: false)
                .order("updated_at", ascending: false)
                .execute()
                .value
            self.notes = fetched
            saveCache()

            let cats: [Category] = try await supabase
                .from("categories")
                .select()
                .order("sort_order", ascending: true)
                .execute()
                .value
            self.categories = cats

            let rems: [Reminder] = try await supabase
                .from("reminders")
                .select()
                .eq("done", value: false)
                .order("remind_at", ascending: true)
                .execute()
                .value
            var map: [UUID: Reminder] = [:]
            for r in rems where map[r.noteId] == nil { map[r.noteId] = r }
            self.remindersByNote = map

            self.error = nil
        } catch {
            self.error = error.localizedDescription
        }
    }

    // MARK: Categories

    func createCategory(name: String, color: String) async {
        do {
            try await supabase.from("categories")
                .insert(CategoryInsert(name: name, color: color, sort_order: categories.count))
                .execute()
            await refresh()
        } catch { self.error = error.localizedDescription }
    }

    func updateCategory(id: UUID, name: String, color: String) async {
        do {
            try await supabase.from("categories")
                .update(CategoryUpdate(name: name, color: color))
                .eq("id", value: id.uuidString.lowercased())
                .execute()
            await refresh()
        } catch { self.error = error.localizedDescription }
    }

    func deleteCategory(id: UUID) async {
        do {
            try await supabase.from("categories").delete().eq("id", value: id.uuidString.lowercased()).execute()
            await refresh()
        } catch { self.error = error.localizedDescription }
    }

    // MARK: Reminders (one per note)

    func setReminder(noteId: UUID, date: Date, title: String) async {
        try? await supabase.from("reminders").delete().eq("note_id", value: noteId.uuidString.lowercased()).execute()
        do {
            let r: Reminder = try await supabase.from("reminders")
                .insert(ReminderInsert(note_id: noteId.uuidString.lowercased(), remind_at: Note.iso(date), message: title))
                .select().single().execute().value
            remindersByNote[noteId] = r
            Notifications.schedule(
                id: noteId.uuidString,
                title: "lynx",
                body: title.isEmpty ? "Reminder" : title,
                date: date
            )
        } catch { self.error = error.localizedDescription }
    }

    func removeReminder(noteId: UUID) async {
        remindersByNote[noteId] = nil
        Notifications.cancel(id: noteId.uuidString)
        do {
            try await supabase.from("reminders").delete().eq("note_id", value: noteId.uuidString.lowercased()).execute()
        } catch { self.error = error.localizedDescription }
    }

    // MARK: Mutations

    func create() async -> Note? {
        let payload = NoteInsert(
            title: "",
            content: TiptapDoc(plainText: ""),
            content_text: "",
            category_id: nil
        )
        do {
            let note: Note = try await supabase
                .from("notes")
                .insert(payload)
                .select()
                .single()
                .execute()
                .value
            notes.insert(note, at: 0)
            saveCache()
            return note
        } catch {
            self.error = error.localizedDescription
            return nil
        }
    }

    func saveContent(id: UUID, title: String, body: String) async {
        let built = NoteContent.build(from: body)
        let payload = NoteContentUpdate(title: title, content: built.doc, content_text: built.text)
        // Optimistic local update.
        if let i = notes.firstIndex(where: { $0.id == id }) {
            notes[i].title = title
            notes[i].contentText = built.text
            notes[i].updatedAt = Note.nowISO()
        }
        do {
            try await supabase.from("notes").update(payload).eq("id", value: id.uuidString.lowercased()).execute()
            saveCache()
        } catch {
            self.error = error.localizedDescription
        }
    }

    /// Fetch the note's content JSON and reconstruct the editor body (linkPreview urls included),
    /// so previews created on the website show up on the phone.
    func noteBody(id: UUID) async -> String? {
        struct Row: Decodable { let content: TDoc }
        do {
            let row: Row = try await supabase.from("notes")
                .select("content")
                .eq("id", value: id.uuidString.lowercased())
                .single().execute().value
            return NoteContent.body(from: row.content)
        } catch {
            return nil
        }
    }

    func setPinned(id: UUID, _ pinned: Bool) async {
        await updateFlags(id: id, NoteFlagsUpdate(pinned: pinned, archived: nil, category_id: nil))
    }

    func setCategory(id: UUID, categoryId: UUID?) async {
        await updateFlags(id: id, NoteFlagsUpdate(pinned: nil, archived: nil, category_id: categoryId?.uuidString.lowercased()))
    }

    func archive(id: UUID) async {
        notes.removeAll { $0.id == id }
        saveCache()
        await updateFlags(id: id, NoteFlagsUpdate(pinned: nil, archived: true, category_id: nil))
    }

    func delete(id: UUID) async {
        notes.removeAll { $0.id == id }
        saveCache()
        do {
            try await supabase.from("notes").delete().eq("id", value: id.uuidString.lowercased()).execute()
        } catch {
            self.error = error.localizedDescription
        }
    }

    // MARK: Photos (private note-images bucket + attachments table)

    private static func randomID() -> String { UUID().uuidString.lowercased() }
    // Signed URLs are bearer tokens; keep them short-lived. They're re-minted on
    // every gallery load, so a 1-hour TTL costs nothing.
    private static let signedTTL = 60 * 60
    /// Client-side cap on video uploads — a whole video is held in memory during
    /// upload, and unbounded reads would OOM the app long before the bucket's limit.
    static let maxVideoBytes = 200 * 1024 * 1024

    /// Upload image data, record the attachment, return the new image (id + signed URL).
    func uploadImage(noteId: UUID, data: Data, ext: String) async -> NoteImage? {
        guard let uid = supabase.auth.currentUser?.id else { return nil }
        let path = "\(uid.uuidString.lowercased())/\(Self.randomID()).\(ext)"
        let contentType = ext == "png" ? "image/png" : "image/jpeg"
        do {
            _ = try await supabase.storage
                .from("note-images")
                .upload(path, data: data, options: FileOptions(contentType: contentType))
            let row: Attachment = try await supabase
                .from("attachments")
                .insert(AttachmentInsert(note_id: noteId.uuidString.lowercased(), storage_path: path))
                .select().single().execute().value
            let url = try await supabase.storage
                .from("note-images")
                .createSignedURL(path: path, expiresIn: Self.signedTTL)
            return NoteImage(id: row.id, path: path, url: url)
        } catch {
            self.error = error.localizedDescription
            return nil
        }
    }

    /// Upload a video file, record the attachment, return the new item (id + signed URL).
    /// Reads the file from `fileURL` (a local temp/Files URL) into memory, then uploads.
    func uploadVideo(noteId: UUID, fileURL: URL) async -> NoteImage? {
        guard let uid = supabase.auth.currentUser?.id else { return nil }
        let ext = fileURL.pathExtension.isEmpty ? "mp4" : fileURL.pathExtension.lowercased()
        let path = "\(uid.uuidString.lowercased())/\(Self.randomID()).\(ext)"
        do {
            let size = (try? FileManager.default.attributesOfItem(atPath: fileURL.path)[.size] as? Int) ?? 0
            guard size <= Self.maxVideoBytes else {
                self.error = "That video is too large — keep it under 200 MB."
                return nil
            }
            let data = try Data(contentsOf: fileURL)
            _ = try await supabase.storage
                .from("note-images")
                .upload(path, data: data, options: FileOptions(contentType: NoteImage.videoMime(ext: ext)))
            let row: Attachment = try await supabase
                .from("attachments")
                .insert(AttachmentInsert(note_id: noteId.uuidString.lowercased(), storage_path: path))
                .select().single().execute().value
            let url = try await supabase.storage
                .from("note-images")
                .createSignedURL(path: path, expiresIn: Self.signedTTL)
            return NoteImage(id: row.id, path: path, url: url)
        } catch {
            self.error = error.localizedDescription
            return nil
        }
    }

    /// A note's existing images and videos (id + path + signed URL), oldest first.
    func noteImages(noteId: UUID) async -> [NoteImage] {
        do {
            let rows: [Attachment] = try await supabase
                .from("attachments")
                .select()
                .eq("note_id", value: noteId.uuidString.lowercased())
                .order("created_at", ascending: true)
                .execute()
                .value
            var out: [NoteImage] = []
            for row in rows {
                if let url = try? await supabase.storage
                    .from("note-images")
                    .createSignedURL(path: row.storagePath, expiresIn: Self.signedTTL) {
                    out.append(NoteImage(id: row.id, path: row.storagePath, url: url))
                }
            }
            return out
        } catch {
            return []
        }
    }

    func deleteImage(_ image: NoteImage) async {
        do {
            _ = try await supabase.storage.from("note-images").remove(paths: [image.path])
            try await supabase.from("attachments").delete().eq("id", value: image.id.uuidString.lowercased()).execute()
        } catch {
            self.error = error.localizedDescription
        }
    }

    private func updateFlags(id: UUID, _ payload: NoteFlagsUpdate) async {
        do {
            try await supabase.from("notes").update(payload).eq("id", value: id.uuidString.lowercased()).execute()
            await refresh()
        } catch {
            self.error = error.localizedDescription
        }
    }

    // MARK: Cache

    private func saveCache() {
        do {
            let data = try JSONEncoder().encode(notes)
            try data.write(to: cacheURL, options: .atomic)
        } catch { /* cache is best-effort */ }
    }

    private func loadCache() {
        guard let data = try? Data(contentsOf: cacheURL),
              let cached = try? JSONDecoder().decode([Note].self, from: data) else { return }
        self.notes = cached
    }
}
