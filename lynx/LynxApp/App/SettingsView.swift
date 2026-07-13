import SwiftUI

struct SettingsView: View {
    @ObservedObject var store: NotesStore
    @EnvironmentObject var auth: AuthModel
    @EnvironmentObject var theme: Theme
    @Environment(\.dismiss) private var dismiss
    @AppStorage("lynx-open-recent") private var openRecent = false

    private let presets: [UInt] = [0xE8772E, 0xD7263D, 0xE2A60B, 0x2E9E5B, 0x3B82F6, 0x8B5CF6, 0xEC4899, 0x111111]

    var body: some View {
        NavigationStack {
            ZStack {
                theme.bg.ignoresSafeArea()
                ScrollView {
                    VStack(spacing: 18) {
                        Wordmark(size: 34).padding(.top, 16)

                        if let email = auth.session?.user.email {
                            VStack(spacing: 4) {
                                Text("Signed in as").font(.caption).foregroundStyle(theme.muted)
                                Text(email).font(.subheadline.weight(.medium)).foregroundStyle(theme.text)
                            }
                            .frame(maxWidth: .infinity).padding(.vertical, 16)
                            .background(theme.surface)
                            .overlay(RoundedRectangle(cornerRadius: 14).stroke(theme.border, lineWidth: 1))
                            .clipShape(RoundedRectangle(cornerRadius: 14))
                        }

                        card {
                            Text("Appearance").font(.caption).foregroundStyle(theme.muted)
                            Picker("Appearance", selection: $theme.mode) {
                                ForEach(AppTheme.allCases) { Text($0.label).tag($0) }
                            }
                            .pickerStyle(.segmented)
                        }

                        card {
                            HStack {
                                Text("Accent").font(.caption).foregroundStyle(theme.muted)
                                Spacer()
                                ColorPicker("", selection: Binding(
                                    get: { theme.accent },
                                    set: { theme.accentHex = $0.hexValue }
                                ), supportsOpacity: false)
                                .labelsHidden()
                            }
                            HStack(spacing: 10) {
                                ForEach(presets, id: \.self) { hex in
                                    Circle()
                                        .fill(Color(hex: hex))
                                        .frame(width: 28, height: 28)
                                        .overlay(Circle().stroke(theme.text.opacity(theme.accentHex == hex ? 0.6 : 0), lineWidth: 2))
                                        .onTapGesture { theme.accentHex = hex }
                                }
                            }
                        }

                        card {
                            Toggle(isOn: $theme.dynamicIcon) {
                                Text("App icon follows theme").foregroundStyle(theme.text)
                            }
                            .tint(theme.accent)
                            Text("Off by default — iOS may show a one-time alert each time the icon changes.")
                                .font(.caption2).foregroundStyle(theme.muted)
                        }

                        card {
                            Toggle(isOn: $openRecent) {
                                Text("Open most recent note on launch").foregroundStyle(theme.text)
                            }
                            .tint(theme.accent)
                        }

                        NavigationLink {
                            CategoriesView(store: store).environmentObject(theme)
                        } label: {
                            HStack {
                                Text("Categories").foregroundStyle(theme.text)
                                Spacer()
                                Text("\(store.categories.count)").foregroundStyle(theme.muted)
                                Image(systemName: "chevron.right").font(.caption).foregroundStyle(theme.muted)
                            }
                            .padding(16)
                            .background(theme.surface)
                            .overlay(RoundedRectangle(cornerRadius: 14).stroke(theme.border, lineWidth: 1))
                            .clipShape(RoundedRectangle(cornerRadius: 14))
                        }

                        HStack {
                            Text("\(store.notes.count) notes")
                            Spacer()
                            if store.loading { ProgressView() }
                        }
                        .foregroundStyle(theme.muted).padding(.horizontal, 4)

                        Button {
                            Task { await auth.signOut(); dismiss() }
                        } label: {
                            Text("Sign out")
                                .fontWeight(.semibold)
                                .frame(maxWidth: .infinity).padding(.vertical, 14)
                                .background(theme.pill)
                                .foregroundStyle(theme.text)
                                .clipShape(RoundedRectangle(cornerRadius: 14))
                        }
                        .padding(.top, 6)
                    }
                    .padding(24)
                }
            }
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }.foregroundStyle(theme.accent)
                }
            }
            .toolbarBackground(theme.bg, for: .navigationBar)
        }
    }

    @ViewBuilder
    private func card<Content: View>(@ViewBuilder _ content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 12) { content() }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(16)
            .background(theme.surface)
            .overlay(RoundedRectangle(cornerRadius: 14).stroke(theme.border, lineWidth: 1))
            .clipShape(RoundedRectangle(cornerRadius: 14))
    }
}
