import Accessibility
import AuthenticationServices
import OSLog
import SwiftUI

// MARK: - Social Login Section

struct SocialLoginDependencies: Sendable {
    var appleSignIn: @Sendable () async throws -> AppleSignInResult
    var googleSignIn: @Sendable () async throws -> GoogleSignInResult
}

struct SocialLoginSection: View {
    @Environment(AppState.self) private var appState
    @State private var appleCoordinator = AppleSignInCoordinator()
    @State private var googleCoordinator = GoogleSignInCoordinator()
    @State private var isAppleLoading = false
    @State private var isGoogleLoading = false
    @State private var errorMessage: String?

    private let dependencies: SocialLoginDependencies?
    let onSuccess: (() -> Void)?
    let onAuthenticated: ((UserInfo) async -> Void)?

    init(
        dependencies: SocialLoginDependencies? = nil,
        onSuccess: (() -> Void)? = nil,
        onAuthenticated: ((UserInfo) async -> Void)? = nil
    ) {
        self.dependencies = dependencies
        self.onSuccess = onSuccess
        self.onAuthenticated = onAuthenticated
    }

    private var isAnyLoading: Bool { isAppleLoading || isGoogleLoading }

    var body: some View {
        VStack(spacing: DesignTokens.Spacing.md) {
            if let errorMessage {
                ErrorBanner(message: errorMessage) {
                    self.errorMessage = nil
                }
                .accessibilityAddTraits(.isStaticText)
            }

            AppleSignInButtonView(isLoading: isAppleLoading, isDisabled: isAnyLoading) {
                isAppleLoading = true
                await signInWithApple()
                isAppleLoading = false
            }

            GoogleSignInButtonView(isLoading: isGoogleLoading, isDisabled: isAnyLoading) {
                isGoogleLoading = true
                await signInWithGoogle()
                isGoogleLoading = false
            }
        }
        .onChange(of: errorMessage) { _, newValue in
            guard let message = newValue else { return }
            AccessibilityNotification.Announcement(message).post()
        }
    }

    // MARK: - Social Login Actions

    private func signInWithApple() async {
        errorMessage = nil
        do {
            let idToken: String
            let nonce: String
            var givenName: String?

            if let dependencies {
                let result = try await dependencies.appleSignIn()
                idToken = result.idToken
                nonce = result.nonce
                givenName = result.givenName
            } else {
                let result = try await appleCoordinator.signIn()
                idToken = result.idToken
                nonce = result.nonce
                givenName = result.givenName
            }

            if let onAuthenticated {
                let result = try await appState.authenticateWithApple(idToken: idToken, nonce: nonce)
                switch result {
                case .newUser(var user):
                    patchFirstName(on: &user, from: givenName)
                    AnalyticsService.shared.capture(.loginCompleted, properties: ["method": "apple_onboarding"])
                    await onAuthenticated(user)
                case .existingUserRedirected:
                    AnalyticsService.shared.capture(
                        .loginCompleted,
                        properties: ["method": "apple", "source": "signup_redirect"]
                    )
                }
            } else {
                try await appState.loginWithApple(idToken: idToken, nonce: nonce)
                AnalyticsService.shared.capture(.loginCompleted, properties: ["method": "apple"])
                onSuccess?()
            }
        } catch AppleSignInError.canceled, AppleSignInError.inProgress {
            // User canceled or flow already in progress — no error
        } catch {
            Logger.auth.error("Apple sign-in failed: \(error.localizedDescription, privacy: .public)")
            AnalyticsService.shared.captureAuthError(.loginFailed, error: error, method: "apple")
            errorMessage = socialErrorMessage(for: error)
        }
    }

    private func signInWithGoogle() async {
        errorMessage = nil
        do {
            let idToken: String
            let accessToken: String
            var givenName: String?

            if let dependencies {
                let result = try await dependencies.googleSignIn()
                idToken = result.idToken
                accessToken = result.accessToken
                givenName = result.givenName
            } else {
                let result = try await googleCoordinator.signIn()
                idToken = result.idToken
                accessToken = result.accessToken
                givenName = result.givenName
            }

            if let onAuthenticated {
                let result = try await appState.authenticateWithGoogle(idToken: idToken, accessToken: accessToken)
                switch result {
                case .newUser(var user):
                    patchFirstName(on: &user, from: givenName)
                    AnalyticsService.shared.capture(.loginCompleted, properties: ["method": "google_onboarding"])
                    await onAuthenticated(user)
                case .existingUserRedirected:
                    AnalyticsService.shared.capture(
                        .loginCompleted,
                        properties: ["method": "google", "source": "signup_redirect"]
                    )
                }
            } else {
                try await appState.loginWithGoogle(idToken: idToken, accessToken: accessToken)
                AnalyticsService.shared.capture(.loginCompleted, properties: ["method": "google"])
                onSuccess?()
            }
        } catch GoogleSignInError.canceled, GoogleSignInError.inProgress {
            // User canceled or flow already in progress — no error
        } catch {
            Logger.auth.error("Google sign-in failed: \(error.localizedDescription, privacy: .public)")
            AnalyticsService.shared.captureAuthError(.loginFailed, error: error, method: "google")
            errorMessage = socialErrorMessage(for: error)
        }
    }

    /// Patches firstName on a new social user if the provider gave us a name
    /// that Supabase didn't capture in metadata. Persists to user_metadata.
    private func patchFirstName(
        on user: inout UserInfo,
        from givenName: String?
    ) {
        guard user.firstName?.isEmpty != false,
              let name = givenName, !name.isEmpty else { return }
        user.firstName = name
        Task {
            do {
                try await AuthService.shared.updateUserFirstName(name)
            } catch {
                Logger.auth.warning(
                    "Failed to persist firstName: \(error.localizedDescription, privacy: .public)"
                )
            }
        }
    }

    /// OAuth errors have their own French messages — use them directly.
    /// For Supabase errors, fall back to AuthErrorLocalizer.
    private func socialErrorMessage(for error: Error) -> String {
        if error is GoogleSignInError || error is AppleSignInError {
            return error.localizedDescription
        }
        return AuthErrorLocalizer.localize(error)
    }
}

// MARK: - Social Login Divider

struct SocialLoginDivider: View {
    var body: some View {
        HStack(spacing: DesignTokens.Spacing.md) {
            dividerLine
            Text("ou")
                .font(PulpeTypography.subheadline)
                .foregroundStyle(Color.textSecondaryOnboarding)
            dividerLine
        }
        .padding(.vertical, DesignTokens.Spacing.md)
    }

    private var dividerLine: some View {
        Rectangle()
            .fill(Color.textTertiary.opacity(0.3))
            .frame(height: 1)
    }
}

// MARK: - Apple Sign In Button (uses system SignInWithAppleButton for HIG compliance)

struct AppleSignInButtonView: View {
    let isLoading: Bool
    let isDisabled: Bool
    let action: () async -> Void

    var body: some View {
        if isLoading {
            // Show loading state as a custom view (SignInWithAppleButton doesn't support loading)
            HStack(spacing: DesignTokens.Spacing.sm) {
                ProgressView()
                    .tint(.white)
                Text("Connexion en cours…")
                    .font(PulpeTypography.buttonPrimary)
            }
            .foregroundStyle(.white)
            .frame(maxWidth: .infinity)
            .frame(height: DesignTokens.FrameHeight.button)
            .background(.black)
            .clipShape(Capsule())
            .accessibilityLabel("Connexion avec Apple en cours")
            .accessibilityValue("Connexion en cours")
        } else {
            SignInWithAppleButton(.continue) { _ in
                // Request configuration is handled by the coordinator, not here.
                // We just trigger the action which calls the coordinator.
            } onCompletion: { _ in
                // Completion is handled by the coordinator's delegate.
            }
            .signInWithAppleButtonStyle(.black)
            .frame(height: DesignTokens.FrameHeight.button)
            .clipShape(Capsule())
            .disabled(isDisabled)
            .accessibilityHidden(true)
            .overlay {
                // Intercept taps to use our coordinator-based flow
                Button {
                    Task { await action() }
                } label: {
                    Color.clear
                }
                .accessibilityIdentifier("appleSignInButton")
                .accessibilityLabel("Continuer avec Apple")
                .disabled(isDisabled)
            }
        }
    }
}

// MARK: - Google Sign In Button

struct GoogleSignInButtonView: View {
    let isLoading: Bool
    let isDisabled: Bool
    let action: () async -> Void

    var body: some View {
        Button {
            Task { await action() }
        } label: {
            HStack(spacing: DesignTokens.Spacing.sm) {
                if isLoading {
                    ProgressView()
                        .tint(Color.textPrimaryOnboarding)
                } else {
                    Image("google-logo")
                        .resizable()
                        .scaledToFit()
                        .frame(width: DesignTokens.IconSize.socialButton, height: DesignTokens.IconSize.socialButton)
                }
                Text(isLoading ? "Connexion en cours…" : "Continuer avec Google")
                    .font(PulpeTypography.buttonPrimary)
                    .foregroundStyle(Color.textPrimaryOnboarding)
            }
            .frame(maxWidth: .infinity)
            .frame(height: DesignTokens.FrameHeight.button)
            .background(Color.surface)
            .clipShape(Capsule())
            .overlay(
                Capsule()
                    .strokeBorder(Color.authInputBorder, lineWidth: DesignTokens.BorderWidth.medium)
            )
        }
        .plainPressedButtonStyle()
        .contentShape(Capsule())
        .disabled(isDisabled)
        .accessibilityIdentifier("googleSignInButton")
        .accessibilityLabel("Continuer avec Google")
        .accessibilityValue(isLoading ? "Connexion en cours" : "")
    }
}
