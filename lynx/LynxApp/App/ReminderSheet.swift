import SwiftUI

struct ReminderSheet: View {
    @ObservedObject var store: NotesStore
    @EnvironmentObject var theme: Theme
    @Environment(\.dismiss) private var dismiss
    let noteId: UUID
    let noteTitle: String

    @State private var date = Date().addingTimeInterval(3600)

    private var existing: Reminder? { store.remindersByNote[noteId] }

    var body: some View {
        NavigationStack {
            ZStack {
                theme.bg.ignoresSafeArea()
                VStack(spacing: 18) {
                    DatePicker("", selection: $date, in: Date()..., displayedComponents: [.date, .hourAndMinute])
                        .datePickerStyle(.graphical)
                        .tint(theme.accent)
                        .labelsHidden()
                        .padding(8)
                        .background(theme.surface)
                        .overlay(RoundedRectangle(cornerRadius: 16).stroke(theme.border, lineWidth: 1))
                        .clipShape(RoundedRectangle(cornerRadius: 16))

                    Button { Task { await setReminder() } } label: {
                        Text(existing == nil ? "Set reminder" : "Update reminder")
                            .fontWeight(.semibold)
                            .frame(maxWidth: .infinity).padding(.vertical, 14)
                            .background(theme.accent).foregroundStyle(.white)
                            .clipShape(RoundedRectangle(cornerRadius: 14))
                    }

                    if existing != nil {
                        Button(role: .destructive) {
                            Task { await store.removeReminder(noteId: noteId); dismiss() }
                        } label: {
                            Text("Remove reminder").frame(maxWidth: .infinity).padding(.vertical, 10)
                                .foregroundStyle(Color(hex: 0xD7263D))
                        }
                    }
                    Spacer()
                }
                .padding(20)
            }
            .navigationTitle("Reminder")
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(theme.bg, for: .navigationBar)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }.foregroundStyle(theme.accent)
                }
            }
            .onAppear { if let e = existing { date = e.remindDate } }
        }
    }

    private func setReminder() async {
        await Notifications.ensureAuthorized()
        await store.setReminder(noteId: noteId, date: date, title: noteTitle)
        dismiss()
    }
}
