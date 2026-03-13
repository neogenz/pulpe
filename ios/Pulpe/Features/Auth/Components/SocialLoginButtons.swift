import SwiftUI

// MARK: - Social Login Section

struct SocialLoginSection: View {
    @Environment(AppState.self) private var appState
    @State private var appleCoordinator = AppleSignInCoordinator()
    @State private var googleCoordinator = GoogleSignInCoordinator()
    @State private var isAppleLoading = false
    @State private var isGoogleLoading = false
    @State private var errorMessage: String?

    var onSuccess: (() -> Void)?

    private var isAnyLoading: Bool { isAppleLoading || isGoogleLoading }

    var body: some View {
        VStack(spacing: DesignTokens.Spacing.md) {
            SocialErrorBanner(message: errorMessage)

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
            let (idToken, nonce) = try await appleCoordinator.signIn()
            try await appState.loginWithApple(idToken: idToken, nonce: nonce)
            AnalyticsService.shared.capture(.loginCompleted, properties: ["method": "apple"])
            onSuccess?()
        } catch AppleSignInError.canceled, AppleSignInError.inProgress {
            // User canceled or flow already in progress — no error
        } catch {
            errorMessage = AuthErrorLocalizer.localize(error)
        }
    }

    private func signInWithGoogle() async {
        errorMessage = nil
        do {
            let (idToken, accessToken) = try await googleCoordinator.signIn()
            try await appState.loginWithGoogle(idToken: idToken, accessToken: accessToken)
            AnalyticsService.shared.capture(.loginCompleted, properties: ["method": "google"])
            onSuccess?()
        } catch let error as NSError where error.domain == "com.google.GIDSignIn" && error.code == -5 {
            // GIDSignInError.canceled — no error
        } catch {
            errorMessage = AuthErrorLocalizer.localize(error)
        }
    }
}

// MARK: - Social Error Banner

struct SocialErrorBanner: View {
    let message: String?

    var body: some View {
        if let message {
            HStack(spacing: DesignTokens.Spacing.sm) {
                Image(systemName: "exclamationmark.triangle.fill")
                    .font(PulpeTypography.body)
                    .foregroundStyle(Color.errorPrimary)
                Text(message)
                    .font(PulpeTypography.subheadline)
                    .multilineTextAlignment(.leading)
                    .foregroundStyle(Color.textPrimary)
            }
            .padding(DesignTokens.Spacing.lg)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Color.errorBackground, in: .rect(cornerRadius: DesignTokens.CornerRadius.button))
        }
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
                        .font(.system(size: 18))
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
        .buttonStyle(.plain)
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
                        .frame(width: 20, height: 20)
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
        .buttonStyle(.plain)
        .disabled(isLoading)
        .accessibilityIdentifier("googleSignInButton")
        .accessibilityLabel("Continuer avec Google")
    }
}
