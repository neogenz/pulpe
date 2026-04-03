import Accessibility
import AuthenticationServices
import OSLog
import SwiftUI

// MARK: - Social Login Section

struct SocialLoginDependencies: Sendable {
    var appleSignIn: @Sendable () async throws -> (idToken: String, nonce: String)
    var googleSignIn: @Sendable () async throws -> (idToken: String, accessToken: String)
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
            let result: (idToken: String, nonce: String)
            if let dependencies {
                result = try await dependencies.appleSignIn()
            } else {
                result = try await appleCoordinator.signIn()
            }
            let (idToken, nonce) = result

            if let onAuthenticated {
                let user = try await appState.authenticateWithApple(idToken: idToken, nonce: nonce)
                AnalyticsService.shared.capture(.loginCompleted, properties: ["method": "apple_onboarding"])
                await onAuthenticated(user)
            } else {
                try await appState.loginWithApple(idToken: idToken, nonce: nonce)
                AnalyticsService.shared.capture(.loginCompleted, properties: ["method": "apple"])
                onSuccess?()
            }
        } catch AppleSignInError.canceled, AppleSignInError.inProgress {
            // User canceled or flow already in progress — no error
        } catch is ExistingUserRedirectedError {
            AnalyticsService.shared.capture(
                .loginCompleted,
                properties: ["method": "apple", "source": "signup_redirect"]
            )
        } catch {
            Logger.auth.error("Apple sign-in failed: \(error.localizedDescription, privacy: .public)")
            AnalyticsService.shared.captureAuthError(.loginFailed, error: error, method: "apple")
            errorMessage = socialErrorMessage(for: error)
        }
    }

    private func signInWithGoogle() async {
        errorMessage = nil
        do {
            let result: (idToken: String, accessToken: String)
            if let dependencies {
                result = try await dependencies.googleSignIn()
            } else {
                result = try await googleCoordinator.signIn()
            }
            let (idToken, accessToken) = result

            if let onAuthenticated {
                let user = try await appState.authenticateWithGoogle(idToken: idToken, accessToken: accessToken)
                AnalyticsService.shared.capture(.loginCompleted, properties: ["method": "google_onboarding"])
                await onAuthenticated(user)
            } else {
                try await appState.loginWithGoogle(idToken: idToken, accessToken: accessToken)
                AnalyticsService.shared.capture(.loginCompleted, properties: ["method": "google"])
                onSuccess?()
            }
        } catch GoogleSignInError.canceled, GoogleSignInError.inProgress {
            // User canceled or flow already in progress — no error
        } catch is ExistingUserRedirectedError {
            AnalyticsService.shared.capture(
                .loginCompleted,
                properties: ["method": "google", "source": "signup_redirect"]
            )
        } catch {
            Logger.auth.error("Google sign-in failed: \(error.localizedDescription, privacy: .public)")
            AnalyticsService.shared.captureAuthError(.loginFailed, error: error, method: "google")
            errorMessage = socialErrorMessage(for: error)
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
