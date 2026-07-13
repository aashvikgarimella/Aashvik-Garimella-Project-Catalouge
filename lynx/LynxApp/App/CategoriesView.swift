import SwiftUI

struct CategoriesView: View {
    @ObservedObject var store: NotesStore
    @EnvironmentObject var theme: Theme
    @State private var editing: Category?
    @State private var creating = false

    var body: some View {
        ZStack {
            theme.bg.ignoresSafeArea()
            ScrollView {
                VStack(spacing: 10) {
                    ForEach(store.categories) { cat in
                        Button { editing = cat } label: { row(cat) }
                            .buttonStyle(.plain)
                    }
                    if store.categories.isEmpty {
                        Text("No categories yet").foregroundStyle(theme.muted).padding(.top, 30)
                    }
                    Button { creating = true } label: {
                        HStack(spacing: 8) {
                            Image(systemName: "plus.circle.fill")
                            Text("New category").fontWeight(.medium)
                        }
                        .foregroundStyle(theme.accent)
                        .frame(maxWidth: .infinity).padding(.vertical, 14)
                        .background(theme.surface)
                        .overlay(RoundedRectangle(cornerRadius: 14).stroke(theme.border, lineWidth: 1))
                        .clipShape(RoundedRectangle(cornerRadius: 14))
                    }
                    .padding(.top, 4)
                }
                .padding(16)
            }
        }
        .navigationTitle("Categories")
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(theme.bg, for: .navigationBar)
        .sheet(item: $editing) { cat in
            CategoryEditor(store: store, category: cat).environmentObject(theme)
        }
        .sheet(isPresented: $creating) {
            CategoryEditor(store: store, category: nil).environmentObject(theme)
        }
    }

    private func row(_ cat: Category) -> some View {
        HStack(spacing: 12) {
            Circle().fill(CategoryPalette.color(cat.color)).frame(width: 16, height: 16)
            Text(cat.name).foregroundStyle(theme.text)
            Spacer()
            Image(systemName: "chevron.right").font(.caption).foregroundStyle(theme.muted)
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(theme.surface)
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(theme.border, lineWidth: 1))
        .clipShape(RoundedRectangle(cornerRadius: 14))
    }
}

struct CategoryEditor: View {
    @ObservedObject var store: NotesStore
    @EnvironmentObject var theme: Theme
    @Environment(\.dismiss) private var dismiss
    let category: Category?

    @State private var name = ""
    @State private var color = "orange"

    private let columns = Array(repeating: GridItem(.flexible()), count: 4)

    var body: some View {
        NavigationStack {
            ZStack {
                theme.bg.ignoresSafeArea()
                VStack(alignment: .leading, spacing: 20) {
                    TextField("Category name", text: $name)
                        .padding(14)
                        .background(theme.surface)
                        .overlay(RoundedRectangle(cornerRadius: 14).stroke(theme.border, lineWidth: 1))
                        .clipShape(RoundedRectangle(cornerRadius: 14))
                        .foregroundStyle(theme.text)

                    Text("Color").font(.caption).foregroundStyle(theme.muted)
                    LazyVGrid(columns: columns, spacing: 14) {
                        ForEach(CategoryPalette.options, id: \.name) { opt in
                            Circle()
                                .fill(opt.color)
                                .frame(height: 44)
                                .overlay(Circle().stroke(theme.text.opacity(color == opt.name ? 0.7 : 0), lineWidth: 3))
                                .onTapGesture { color = opt.name }
                        }
                    }

                    Spacer()

                    if category != nil {
                        Button(role: .destructive) {
                            Task { if let c = category { await store.deleteCategory(id: c.id) }; dismiss() }
                        } label: {
                            Text("Delete category").frame(maxWidth: .infinity).padding(.vertical, 12)
                                .foregroundStyle(Color(hex: 0xD7263D))
                        }
                    }
                }
                .padding(24)
            }
            .navigationTitle(category == nil ? "New category" : "Edit category")
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(theme.bg, for: .navigationBar)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Cancel") { dismiss() }.foregroundStyle(theme.muted)
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Save") { save() }
                        .fontWeight(.semibold).foregroundStyle(theme.accent)
                        .disabled(name.trimmingCharacters(in: .whitespaces).isEmpty)
                }
            }
            .onAppear {
                if let category { name = category.name; color = category.color }
            }
        }
    }

    private func save() {
        let trimmed = name.trimmingCharacters(in: .whitespaces)
        guard !trimmed.isEmpty else { return }
        Task {
            if let category {
                await store.updateCategory(id: category.id, name: trimmed, color: color)
            } else {
                await store.createCategory(name: trimmed, color: color)
            }
            dismiss()
        }
    }
}
