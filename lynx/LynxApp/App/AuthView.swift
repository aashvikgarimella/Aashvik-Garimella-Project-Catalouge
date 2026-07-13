import SwiftUI

struct AuthView: View {
    enum Mode: Identifiable { case signIn, signUp; var id: Int { self == .signIn ? 0 : 1 } }

    var initialMode: Mode = .signIn

    @EnvironmentObject var auth: AuthModel
    @EnvironmentObject var theme: Theme
    @State private var email = ""
    @State private var password = ""
    @State private var mode: Mode = .signIn
    @FocusState private var focus: Field?

    enum Field { case email, password }

    var body: some View {
        ZStack {
            theme.bg.ignoresSafeArea()
            VStack(spacing: 22) {
                Spacer()
                Wordmark(size: 48)
                Text(mode == .signIn ? "Welcome back" : "Create your account")
                    .font(.headline)
                    .foregroundStyle(theme.muted)

                VStack(spacing: 12) {
                    field("Email", text: $email, secure: false)
                        .keyboardType(.emailAddress)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .focused($focus, equals: .email)
                        .submitLabel(.next)
                        .onSubmit { focus = .password }
                    field("Password", text: $password, secure: true)
                        .focused($focus, equals: .password)
                        .submitLabel(.go)
                        .onSubmit(submit)
                }

                if let err = auth.errorMessage {
                    Text(err)
                        .font(.footnote)
                        .foregroundStyle(theme.accent)
                        .multilineTextAlignment(.center)
                }

                Button(action: submit) {
                    HStack {
                        if auth.working { ProgressView().tint(.white) }
                        Text(mode == .signIn ? "Sign in" : "Sign up").fontWeight(.semibold)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 14)
                    .background(theme.accent)
                    .foregroundStyle(.white)
                    .clipShape(RoundedRectangle(cornerRadius: 14))
                }
                .disabled(auth.working || email.isEmpty || password.isEmpty)
                .opacity(email.isEmpty || password.isEmpty ? 0.6 : 1)

                HStack(spacing: 10) {
                    Rectangle().fill(theme.border).frame(height: 1)
                    Text("or").font(.footnote).foregroundStyle(theme.muted)
                    Rectangle().fill(theme.border).frame(height: 1)
                }
                .padding(.vertical, 2)

                Button {
                    Task { await auth.signInWithGoogle() }
                } label: {
                    HStack(spacing: 10) {
                        Text("G")
                            .font(.system(size: 17, weight: .bold))
                            .foregroundStyle(Color(hex: 0x4285F4))
                        Text("Continue with Google").fontWeight(.medium)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 14)
                    .background(theme.surface)
                    .foregroundStyle(theme.text)
                    .overlay(RoundedRectangle(cornerRadius: 14).stroke(theme.border, lineWidth: 1))
                    .clipShape(RoundedRectangle(cornerRadius: 14))
                }
                .disabled(auth.working)

                Button {
                    withAnimation { mode = mode == .signIn ? .signUp : .signIn }
                    auth.errorMessage = nil
                } label: {
                    Text(mode == .signIn ? "No account? Sign up" : "Have an account? Sign in")
                        .font(.subheadline)
                        .foregroundStyle(theme.muted)
                }
                Spacer()
            }
            .padding(.horizontal, 28)
        }
        .onAppear { mode = initialMode; focus = .email }
    }

    private func field(_ placeholder: String, text: Binding<String>, secure: Bool) -> some View {
        Group {
            if secure { SecureField(placeholder, text: text) }
            else { TextField(placeholder, text: text) }
        }
        .padding(14)
        .background(theme.surface)
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(theme.border, lineWidth: 1))
        .clipShape(RoundedRectangle(cornerRadius: 14))
        .foregroundStyle(theme.text)
    }

    private func submit() {
        Task {
            if mode == .signIn { await auth.signIn(email: email, password: password) }
            else { await auth.signUp(email: email, password: password) }
        }
    }
}
