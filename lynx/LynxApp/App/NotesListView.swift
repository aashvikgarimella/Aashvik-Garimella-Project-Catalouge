import SwiftUI

struct NotesListView: View {
    @EnvironmentObject var auth: AuthModel
    @EnvironmentObject var theme: Theme
    @EnvironmentObject var chat: ChatStore
    @StateObject private var store = NotesStore()
    @State private var search = ""
    @State private var selectedCategory: UUID?
    @State private var path: [UUID] = []
    @State private var showSettings = false
    @AppStorage("lynx-grouping") private var grouping = "date"  // "date" | "category"
    @AppStorage("lynx-open-recent") private var openRecent = false
    @State private var didAutoOpen = false

    private var filtered: [Note] {
        store.notes.filter { n in
            (selectedCategory == nil || n.categoryId == selectedCategory) &&
            (search.isEmpty
                || n.title.localizedCaseInsensitiveContains(search)
                || n.contentText.localizedCaseInsensitiveContains(search))
        }
    }

    private struct NoteSection: Identifiable { let id: String; let title: String; let notes: [Note] }

    private var sections: [NoteSection] {
        let items = filtered
        if grouping == "category" {
            var result: [NoteSection] = []
            for cat in store.categories {
                let ns = items.filter { $0.categoryId == cat.id }
                if !ns.isEmpty { result.append(NoteSection(id: cat.id.uuidString, title: cat.name, notes: ns)) }
            }
            let none = items.filter { $0.categoryId == nil }
            if !none.isEmpty { result.append(NoteSection(id: "none", title: "Uncategorized", notes: none)) }
            return result
        } else {
            let cal = Calendar.current
            let titles = ["Today", "Yesterday", "Previous 7 days", "Earlier"]
            func bucket(_ d: Date) -> Int {
                if cal.isDateInToday(d) { return 0 }
                if cal.isDateInYesterday(d) { return 1 }
                if let days = cal.dateComponents([.day], from: d, to: Date()).day, days < 7 { return 2 }
                return 3
            }
            var groups: [Int: [Note]] = [:]
            for n in items { groups[bucket(n.updatedDate), default: []].append(n) }
            return (0..<4).compactMap { i in
                groups[i].map { NoteSection(id: titles[i], title: titles[i], notes: $0) }
            }
        }
    }

    private func categoryName(_ id: UUID?) -> String? {
        guard let id else { return nil }
        return store.categories.first { $0.id == id }?.name
    }

    private func categoryColor(_ id: UUID?) -> Color? {
        guard let id, let cat = store.categories.first(where: { $0.id == id }) else { return nil }
        return CategoryPalette.color(cat.color)
    }

    var body: some View {
        NavigationStack(path: $path) {
            ZStack(alignment: .bottomTrailing) {
                theme.bg.ignoresSafeArea()
                VStack(spacing: 0) {
                    header
                    searchField
                    if !store.categories.isEmpty { categoryChips }
                    notesList
                }
                newNoteButton
            }
            .toolbar(.hidden, for: .navigationBar)
            .navigationDestination(for: UUID.self) { id in
                NoteEditorView(noteId: id, store: store)
                    .environmentObject(theme)
                    .environmentObject(chat)
            }
            .sheet(isPresented: $showSettings) {
                SettingsView(store: store).environmentObject(auth).environmentObject(theme)
            }
        }
        .onAppear { store.start() }
        .onChange(of: store.notes.count) { maybeAutoOpen() }
    }

    /// If enabled, jump straight to the most recently edited note on launch (once).
    private func maybeAutoOpen() {
        guard openRecent, !didAutoOpen, path.isEmpty, !store.notes.isEmpty else { return }
        didAutoOpen = true
        if let recent = store.notes.max(by: { $0.updatedDate < $1.updatedDate }) {
            path.append(recent.id)
        }
    }

    private var header: some View {
        HStack(spacing: 12) {
            Wordmark(size: 24)
            Spacer()
            Menu {
                Picker("Sort", selection: $grouping) {
                    Label("By date", systemImage: "calendar").tag("date")
                    Label("By category", systemImage: "folder").tag("category")
                }
            } label: {
                Image(systemName: "arrow.up.arrow.down")
                    .font(.subheadline)
                    .foregroundStyle(theme.text)
                    .frame(width: 40, height: 40)
                    .background(theme.surface).clipShape(Circle())
                    .overlay(Circle().stroke(theme.border, lineWidth: 1))
            }
            Button { showSettings = true } label: {
                Image(systemName: "line.3.horizontal")
                    .font(.title3).foregroundStyle(theme.text)
                    .frame(width: 40, height: 40)
                    .background(theme.surface).clipShape(Circle())
                    .overlay(Circle().stroke(theme.border, lineWidth: 1))
            }
        }
        .padding(.horizontal, 18).padding(.top, 6).padding(.bottom, 10)
    }

    private var searchField: some View {
        HStack(spacing: 8) {
            Image(systemName: "magnifyingglass").foregroundStyle(theme.muted)
            TextField("Search notes", text: $search)
                .foregroundStyle(theme.text).autocorrectionDisabled()
            if !search.isEmpty {
                Button { search = "" } label: {
                    Image(systemName: "xmark.circle.fill").foregroundStyle(theme.muted)
                }
            }
        }
        .padding(.horizontal, 14).padding(.vertical, 10)
        .background(theme.surface)
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(theme.border, lineWidth: 1))
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .padding(.horizontal, 16).padding(.bottom, 10)
    }

    private var notesList: some View {
        Group {
            if filtered.isEmpty {
                VStack(spacing: 8) {
                    Spacer()
                    Image(systemName: "note.text").font(.largeTitle).foregroundStyle(theme.muted)
                    Text(search.isEmpty ? "No notes yet" : "No matches").foregroundStyle(theme.muted)
                    if search.isEmpty {
                        Text("Tap + to write your first one").font(.footnote).foregroundStyle(theme.muted)
                    }
                    Spacer()
                }
                .frame(maxWidth: .infinity)
            } else {
                List {
                    ForEach(sections) { section in
                        Section {
                            ForEach(section.notes) { note in
                                Button { path.append(note.id) } label: {
                                    NoteRow(note: note,
                                            categoryName: grouping == "date" ? categoryName(note.categoryId) : nil,
                                            categoryColor: grouping == "date" ? categoryColor(note.categoryId) : nil,
                                            reminder: store.remindersByNote[note.id]?.remindDate)
                                }
                                .buttonStyle(.plain)
                                .listRowBackground(Color.clear)
                                .listRowSeparator(.hidden)
                                .listRowInsets(EdgeInsets(top: 4, leading: 16, bottom: 4, trailing: 16))
                                .swipeActions(edge: .trailing, allowsFullSwipe: true) {
                                    Button(role: .destructive) {
                                        Task { await store.delete(id: note.id) }
                                    } label: { Label("Delete", systemImage: "trash") }
                                    Button { Task { await store.archive(id: note.id) } } label: {
                                        Label("Archive", systemImage: "archivebox")
                                    }.tint(theme.muted)
                                }
                                .swipeActions(edge: .leading) {
                                    Button { Task { await store.setPinned(id: note.id, !note.pinned) } } label: {
                                        Label(note.pinned ? "Unpin" : "Pin", systemImage: "pin")
                                    }.tint(theme.accent)
                                }
                            }
                        } header: {
                            Text(section.title)
                                .font(.caption).fontWeight(.semibold)
                                .foregroundStyle(theme.muted)
                                .textCase(nil)
                        }
                    }
                }
                .listStyle(.plain)
                .scrollContentBackground(.hidden)
                .scrollIndicators(.hidden)
                .refreshable { await store.refresh() }
            }
        }
    }

    private var categoryChips: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                chip("All", color: nil, active: selectedCategory == nil) { selectedCategory = nil }
                ForEach(store.categories) { cat in
                    chip(cat.name, color: CategoryPalette.color(cat.color), active: selectedCategory == cat.id) {
                        selectedCategory = cat.id
                    }
                }
            }
            .padding(.horizontal, 16)
        }
        .padding(.bottom, 10)
    }

    private func chip(_ label: String, color: Color?, active: Bool, _ tap: @escaping () -> Void) -> some View {
        Button(action: tap) {
            HStack(spacing: 6) {
                if let color, !active { Circle().fill(color).frame(width: 7, height: 7) }
                Text(label)
            }
            .font(.subheadline)
            .padding(.horizontal, 14).padding(.vertical, 7)
            .background(active ? theme.accent : theme.pill)
            .foregroundStyle(active ? .white : theme.text)
            .clipShape(Capsule())
        }
        .buttonStyle(.plain)
    }

    private var newNoteButton: some View {
        Button {
            Task { if let note = await store.create() { path.append(note.id) } }
        } label: {
            Image(systemName: "plus")
                .font(.title2.weight(.semibold)).foregroundStyle(.white)
                .frame(width: 58, height: 58)
                .background(theme.accent).clipShape(Circle())
                .shadow(color: .black.opacity(0.18), radius: 10, y: 4)
        }
        .padding(.trailing, 22).padding(.bottom, 28)
    }
}

struct NoteRow: View {
    @EnvironmentObject var theme: Theme
    let note: Note
    var categoryName: String?
    var categoryColor: Color?
    var reminder: Date?

    var body: some View {
        VStack(alignment: .leading, spacing: 5) {
            HStack {
                Text(note.title.isEmpty ? "Untitled" : note.title)
                    .font(.headline).foregroundStyle(theme.text).lineLimit(1)
                Spacer()
                if note.pinned { Circle().fill(theme.accent).frame(width: 7, height: 7) }
            }
            if !note.contentText.isEmpty {
                Text(note.contentText).font(.subheadline).foregroundStyle(theme.muted).lineLimit(2)
            }
            HStack(spacing: 8) {
                Text(note.updatedDate, format: .relative(presentation: .named))
                    .foregroundStyle(theme.muted.opacity(0.85))
                if let categoryName {
                    HStack(spacing: 4) {
                        Circle().fill(categoryColor ?? theme.muted).frame(width: 6, height: 6)
                        Text(categoryName)
                    }
                    .foregroundStyle(theme.muted.opacity(0.85))
                }
                if let reminder {
                    HStack(spacing: 3) {
                        Image(systemName: "bell.fill")
                        Text(reminder, format: .dateTime.month().day().hour().minute())
                    }
                    .foregroundStyle(theme.accent)
                }
            }
            .font(.caption2)
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(theme.surface)
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(theme.border, lineWidth: 1))
        .clipShape(RoundedRectangle(cornerRadius: 16))
    }
}
