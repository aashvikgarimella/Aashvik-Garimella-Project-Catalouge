import Foundation
import Supabase
import AuthenticationServices
import UIKit

/// Presents the OAuth web flow in a secure system sheet and returns the redirect URL.
@MainActor
final class WebAuthenticator: NSObject, ASWebAuthenticationPresentationContextProviding {
    func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        let scene = UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .first { $0.activationState == .foregroundActive }
        return scene?.keyWindow ?? ASPresentationAnchor()
    }

    func start(url: URL, scheme: String) async throws -> URL {
        try await withCheckedThrowingContinuation { continuation in
            let session = ASWebAuthenticationSession(url: url, callbackURLScheme: scheme) { callback, error in
                if let callback {
                    continuation.resume(returning: callback)
                } else {
                    continuation.resume(throwing: error ?? URLError(.userCancelledAuthentication))
                }
            }
            session.presentationContextProvider = self
            session.prefersEphemeralWebBrowserSession = false
            session.start()
        }
    }
}

@MainActor
final class AuthModel: ObservableObject {
    @Published var session: Session?
    @Published var ready = false       // first auth state resolved (persisted session checked)
    @Published var working = false
    @Published var errorMessage: String?

    private let webAuth = WebAuthenticator()
    private let oauthRedirect = URL(string: "com.garimella.lynx://login-callback")!
    private let callbackScheme = "com.garimella.lynx"

    init() {
        Task { await listen() }
    }

    func signInWithGoogle() async {
        working = true; errorMessage = nil
        do {
            try await supabase.auth.signInWithOAuth(
                provider: .google,
                redirectTo: oauthRedirect
            ) { [webAuth, callbackScheme] url in
                try await webAuth.start(url: url, scheme: callbackScheme)
            }
        } catch {
            if let e = error as? ASWebAuthenticationSessionError, e.code == .canceledLogin {
                // user dismissed the sheet — not an error
            } else {
                errorMessage = readable(error)
            }
        }
        working = false
    }

    /// Drives the whole app: emits the persisted session on launch, then every change.
    private func listen() async {
        for await change in supabase.auth.authStateChanges {
            self.session = change.session
            self.ready = true
        }
    }

    func signIn(email: String, password: String) async {
        working = true; errorMessage = nil
        do {
            try await supabase.auth.signIn(email: trim(email), password: password)
        } catch {
            errorMessage = readable(error)
        }
        working = false
    }

    func signUp(email: String, password: String) async {
        working = true; errorMessage = nil
        do {
            try await supabase.auth.signUp(email: trim(email), password: password)
            if session == nil {
                errorMessage = "Check your email to confirm, then sign in."
            }
        } catch {
            errorMessage = readable(error)
        }
        working = false
    }

    func signOut() async {
        try? await supabase.auth.signOut()
    }

    private func trim(_ s: String) -> String {
        s.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private func readable(_ error: Error) -> String {
        let d = error.localizedDescription
        if d.localizedCaseInsensitiveContains("invalid") { return "Wrong email or password." }
        return d
    }
}
