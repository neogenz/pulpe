import OSLog
import SwiftUI

// MARK: - Social Login Section

struct SocialLoginDependencies {
    var appleSignIn: () async throws -> (idToken: String, nonce: String)
    var googleSignIn: () async throws -> (idToken: String, accessToken: String)
}

struct SocialLoginSection: View {
    @Environment(AppState.self) private var appState
    @State private var appleCoordinator = AppleSignInCoordinator()
    @State private var googleCoordinator = GoogleSignInCoordinator()
    @State private var isAppleLoading = false
    @State private var isGoogleLoading = false
    @State private var errorMessage: String?

    private let dependencies: SocialLoginDependencies?
    var onSuccess: (() -> Void)?

    init(dependencies: SocialLoginDependencies? = nil, onSuccess: (() -> Void)? = nil) {
        self.dependencies = dependencies
        self.onSuccess = onSuccess
    }

    private var isAnyLoading: Bool { isAppleLoading || isGoogleLoading }

    var body: some View {
        VStack(spacing: DesignTokens.Spacing.md) {
            if let errorMessage {
                ErrorBanner(message: errorMessage)
            }

            AppleSignInButtonView(isLoading: isAppleLoading) {
                guard !isAnyLoading else { return }
                isAppleLoading = true
                await signInWithApple()
                isAppleLoading = false
            }

            GoogleSignInButtonView(isLoading: isGoogleLoading) {
                guard !isAnyLoading else { return }
                isGoogleLoading = true
                await signInWithGoogle()
                isGoogleLoading = false
            }
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
            try await appState.loginWithApple(idToken: idToken, nonce: nonce)
            AnalyticsService.shared.capture(.loginCompleted, properties: ["method": "apple"])
            onSuccess?()
        } catch AppleSignInError.canceled, AppleSignInError.inProgress {
            // User canceled or flow already in progress — no error
        } catch {
            Logger.auth.error("Apple sign-in failed: \(error.localizedDescription, privacy: .public)")
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
            try await appState.loginWithGoogle(idToken: idToken, accessToken: accessToken)
            AnalyticsService.shared.capture(.loginCompleted, properties: ["method": "google"])
            onSuccess?()
        } catch GoogleSignInError.canceled {
            // User canceled — no error
        } catch {
            Logger.auth.error("Google sign-in failed: \(error.localizedDescription, privacy: .public)")
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
                .font(.subheadline)
                .foregroundStyle(Color.textSecondaryOnboarding)
            dividerLine
        }
        .padding(.vertical, DesignTokens.Spacing.md)
    }

    private var dividerLine: some View {
        Rectangle()
            .fill(Color.pulpeTextTertiary.opacity(0.3))
            .frame(height: 1)
    }
}

// MARK: - Apple Sign In Button (visual only — auth handled by coordinator)

struct AppleSignInButtonView: View {
    let isLoading: Bool
    let action: () async -> Void

    var body: some View {
        Button {
            Task { await action() }
        } label: {
            HStack(spacing: DesignTokens.Spacing.sm) {
                if isLoading {
                    ProgressView()
                        .tint(.white)
                } else {
                    Image(systemName: "apple.logo")
                        .font(.system(size: DesignTokens.IconSize.socialButton))
                }
                Text(isLoading ? "Connexion en cours…" : "Continuer avec Apple")
                    .font(PulpeTypography.buttonPrimary)
            }
            .foregroundStyle(.white)
            .frame(maxWidth: .infinity)
            .frame(height: DesignTokens.FrameHeight.button)
            .background(.black)
            .clipShape(Capsule())
        }
        .plainPressedButtonStyle()
        .disabled(isLoading)
        .accessibilityIdentifier("appleSignInButton")
        .accessibilityLabel("Continuer avec Apple")
    }
}

// MARK: - Google Sign In Button

struct GoogleSignInButtonView: View {
    let isLoading: Bool
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
                    .strokeBorder(Color.authInputBorder, lineWidth: 1.5)
            )
        }
        .plainPressedButtonStyle()
        .disabled(isLoading)
        .accessibilityIdentifier("googleSignInButton")
        .accessibilityLabel("Continuer avec Google")
    }
}
