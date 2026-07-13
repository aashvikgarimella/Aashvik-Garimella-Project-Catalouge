import SwiftUI

/// Mobile landing — the website's animated intro adapted for phone: big wordmark,
/// tagline, and Sign up / Log in that open the auth form.
struct LandingView: View {
    @EnvironmentObject var theme: Theme
    @State private var appear = false
    @State private var float = false
    @State private var authMode: AuthView.Mode?

    var body: some View {
        ZStack {
            theme.bg.ignoresSafeArea()

            // Soft accent glow behind the mark.
            Circle()
                .fill(theme.accent.opacity(theme.mode == .dark ? 0.16 : 0.12))
                .frame(width: 320, height: 320)
                .blur(radius: 60)
                .offset(y: float ? -180 : -160)
                .animation(.easeInOut(duration: 4).repeatForever(autoreverses: true), value: float)

            VStack(spacing: 0) {
                Spacer()

                Wordmark(size: 72)
                    .opacity(appear ? 1 : 0)
                    .offset(y: appear ? (float ? -6 : 0) : 24)
                    .animation(.easeInOut(duration: 3.5).repeatForever(autoreverses: true), value: float)

                Text("Personal Vault")
                    .font(.title3)
                    .multilineTextAlignment(.center)
                    .foregroundStyle(theme.muted)
                    .padding(.top, 18)
                    .opacity(appear ? 1 : 0)
                    .offset(y: appear ? 0 : 16)

                Spacer()

                VStack(spacing: 12) {
                    Button {
                        authMode = .signUp
                    } label: {
                        Text("Sign up")
                            .fontWeight(.semibold)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 16)
                            .background(theme.accent)
                            .foregroundStyle(.white)
                            .clipShape(RoundedRectangle(cornerRadius: 16))
                    }

                    Button {
                        authMode = .signIn
                    } label: {
                        Text("Log in")
                            .fontWeight(.semibold)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 16)
                            .background(theme.surface)
                            .foregroundStyle(theme.text)
                            .overlay(RoundedRectangle(cornerRadius: 16).stroke(theme.border, lineWidth: 1))
                            .clipShape(RoundedRectangle(cornerRadius: 16))
                    }
                }
                .padding(.horizontal, 28)
                .padding(.bottom, 40)
                .opacity(appear ? 1 : 0)
                .offset(y: appear ? 0 : 20)
            }
        }
        .onAppear {
            withAnimation(.easeOut(duration: 0.7)) { appear = true }
            float = true
        }
        .sheet(item: $authMode) { mode in
            AuthView(initialMode: mode)
                .environmentObject(theme)
        }
    }
}
