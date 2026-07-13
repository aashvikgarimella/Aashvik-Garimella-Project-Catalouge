import SwiftUI

@main
struct LynxApp: App {
    @StateObject private var auth = AuthModel()
    @StateObject private var theme = Theme()
    @StateObject private var chat = ChatStore()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(auth)
                .environmentObject(theme)
                .environmentObject(chat)
                .tint(theme.accent)
                .preferredColorScheme(theme.colorScheme)
        }
    }
}

struct RootView: View {
    @EnvironmentObject var auth: AuthModel
    @EnvironmentObject var theme: Theme
    @EnvironmentObject var chat: ChatStore

    var body: some View {
        ZStack {
            theme.bg.ignoresSafeArea()
            if !auth.ready {
                Wordmark(size: 44)
            } else if auth.session == nil {
                LandingView()
            } else {
                NotesListView()
            }
        }
        .onChange(of: auth.session == nil) { _, signedOut in
            // Wipe local data when the session ends, so a different account on this
            // device can't read the previous user's cached notes or chat threads.
            if signedOut && auth.ready {
                chat.clearAll()
                NotesStore.wipeCache()
            }
        }
    }
}

/// The "lynx." wordmark — charcoal/cream text, accent dot.
struct Wordmark: View {
    @EnvironmentObject var theme: Theme
    var size: CGFloat = 26

    var body: some View {
        HStack(spacing: 0) {
            Text("lynx")
                .font(.system(size: size, weight: .bold))
                .foregroundStyle(theme.text)
            Text(".")
                .font(.system(size: size, weight: .bold))
                .foregroundStyle(theme.accent)
        }
        .tracking(-0.5)
    }
}
