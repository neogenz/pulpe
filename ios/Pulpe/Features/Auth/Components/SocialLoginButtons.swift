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
    let onAuthenticated: ((UserInfo, Error?) async -> Void)?
    /// On the forest welcome the buttons are plain white; on a light card they carry a hairline.
    let onForest: Bool

    init(
        dependencies: SocialLoginDependencies? = nil,
        onSuccess: (() -> Void)? = nil,
        onAuthenticated: ((UserInfo, Error?) async -> Void)? = nil,
        onForest: Bool = false
    ) {
        self.onForest = onForest
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

            AppleSignInButtonView(isLoading: isAppleLoading, isDisabled: isAnyLoading, onForest: onForest) {
                isAppleLoading = true
                await signInWithApple()
                isAppleLoading = false
            }

            GoogleSignInButtonView(isLoading: isGoogleLoading, isDisabled: isAnyLoading, onForest: onForest) {
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
                // Onboarding context: the tap is a signup intent. Fire signup_started now
                // (matching the email funnel which fires on button tap in WelcomeStep).
                AnalyticsService.shared.capture(.signupStarted, properties: ["method": "apple"])
                let result = try await appState.authenticateWithApple(idToken: idToken, nonce: nonce)
                switch result {
                case .newUser(var user):
                    let persistError = await patchFirstName(on: &user, from: givenName)
                    AnalyticsService.shared.captureSignupCompleted(user: user, method: "apple")
                    await onAuthenticated(user, persistError)
                case .existingUserRedirected:
                    // Already had a vault — this was a login disguised as signup.
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
                // Onboarding context: the tap is a signup intent. Fire signup_started now
                // (matching the email funnel which fires on button tap in WelcomeStep).
                AnalyticsService.shared.capture(.signupStarted, properties: ["method": "google"])
                let result = try await appState.authenticateWithGoogle(idToken: idToken, accessToken: accessToken)
                switch result {
                case .newUser(var user):
                    let persistError = await patchFirstName(on: &user, from: givenName)
                    AnalyticsService.shared.captureSignupCompleted(user: user, method: "google")
                    await onAuthenticated(user, persistError)
                case .existingUserRedirected:
                    // Already had a vault — this was a login disguised as signup.
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
    /// that Supabase didn't capture in metadata. Awaits persist; keeps the name
    /// in memory and returns the error when the network write fails.
    /// Login must not call this — an existing `firstName` must not be overwritten.
    private func patchFirstName(
        on user: inout UserInfo,
        from givenName: String?
    ) async -> Error? {
        if FirstNameResolver.normalized(user.firstName) != nil {
            return nil
        }
        user = FirstNameResolver.applyingProviderGivenName(givenName, to: user)
        guard let name = FirstNameResolver.normalized(user.firstName) else {
            return nil
        }
        do {
            user = FirstNameResolver.coalescing(
                try await AuthService.shared.updateUserFirstName(name),
                fallbackFirstName: name
            )
            return nil
        } catch {
            Logger.auth.warning(
                "Failed to persist firstName: \(error.localizedDescription, privacy: .public)"
            )
            return error
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
    var onForest = false

    var body: some View {
        HStack(spacing: DesignTokens.Spacing.md) {
            dividerLine
            Text("ou")
                .font(PulpeTypography.subheadline)
                .foregroundStyle(onForest ? Color.heroInkSecondary : Color.textSecondary)
            dividerLine
        }
        .padding(.vertical, DesignTokens.Spacing.md)
    }

    private var dividerLine: some View {
        Rectangle()
            .fill(onForest ? Color.heroInk.opacity(DesignTokens.Opacity.secondary) : Color.outlineVariant)
            .frame(height: DesignTokens.FrameHeight.separator)
    }
}

// MARK: - Apple Sign In Button (uses system SignInWithAppleButton for HIG compliance)

struct AppleSignInButtonView: View {
    let isLoading: Bool
    let isDisabled: Bool
    var onForest = false
    let action: () async -> Void

    var body: some View {
        if isLoading {
            // Show loading state as a custom view (SignInWithAppleButton doesn't support loading)
            HStack(spacing: DesignTokens.Spacing.sm) {
                ProgressView()
                    .tint(.black)
                Text("Connexion en cours…")
                    .font(PulpeTypography.buttonPrimary)
            }
            .foregroundStyle(.black)
            .frame(maxWidth: .infinity)
            .frame(height: DesignTokens.FrameHeight.button)
            .background(.white)
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
            // `.whiteOutline` strokes a rounded rect that the capsule clip cuts into black
            // slivers; the hairline is drawn on the capsule instead, as on the Google button.
            .signInWithAppleButtonStyle(.white)
            .frame(height: DesignTokens.FrameHeight.button)
            .clipShape(Capsule())
            .overlay(
                Capsule()
                    .strokeBorder(onForest ? Color.clear : Color.outline, lineWidth: DesignTokens.BorderWidth.thin)
            )
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
    @Environment(\.colorScheme) private var colorScheme
    let isLoading: Bool
    let isDisabled: Bool
    var onForest = false
    let action: () async -> Void

    var body: some View {
        Button {
            Task { await action() }
        } label: {
            HStack(spacing: DesignTokens.Spacing.sm) {
                if isLoading {
                    ProgressView()
                        .tint(Color.textPrimary)
                } else {
                    Image("google-logo")
                        .resizable()
                        .scaledToFit()
                        .frame(width: DesignTokens.IconSize.socialButton, height: DesignTokens.IconSize.socialButton)
                }
                Text(isLoading ? "Connexion en cours…" : "Continuer avec Google")
                    .font(PulpeTypography.buttonPrimary)
                    .foregroundStyle(Color.textPrimary)
            }
            .frame(maxWidth: .infinity)
            .frame(height: DesignTokens.FrameHeight.button)
            .background(Color.surface)
            .clipShape(Capsule())
            .overlay(
                Capsule()
                    .strokeBorder(onForest ? Color.clear : Color.outline, lineWidth: DesignTokens.BorderWidth.thin)
            )
        }
        .plainPressedButtonStyle()
        .contentShape(Capsule())
        // A white button on the forest, whose dark scheme would turn `surface` near-black.
        .environment(\.colorScheme, onForest ? .light : colorScheme)
        .disabled(isDisabled)
        .accessibilityIdentifier("googleSignInButton")
        .accessibilityLabel("Continuer avec Google")
        .accessibilityValue(isLoading ? "Connexion en cours" : "")
    }
}
