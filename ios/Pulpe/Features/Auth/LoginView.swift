import SwiftUI

struct LoginView: View {
    @Environment(AppState.self) private var appState
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var viewModel = LoginViewModel()
    @State private var isAppeared = false
    @State private var forgotPasswordPresentation: ForgotPasswordPresentation?
    @FocusState private var focusedField: Field?

    var isPresented: Binding<Bool>?
    var onBiometric: (() -> Void)?

    private enum Field: Hashable {
        case email, password
    }

    var body: some View {
        NavigationStack {
            ZStack {
                Color.loginGradientBackground

                ScrollView {
                    VStack(spacing: DesignTokens.Spacing.xxl) {
                        headerSection
                        Spacer().frame(height: DesignTokens.Spacing.lg)
                        formSection
                        createAccountSection
                        termsFooter
                    }
                    .padding(.horizontal, DesignTokens.Spacing.xxl)
                    .padding(.bottom, DesignTokens.Spacing.xxxl)
                }
                .scrollBounceBehavior(.basedOnSize)
                .scrollDismissesKeyboard(.interactively)
            }
            .toolbar {
                if let isPresented {
                    ToolbarItem(placement: .cancellationAction) {
                        Button("Annuler") {
                            isPresented.wrappedValue = false
                        }
                        .foregroundStyle(Color.textPrimaryOnboarding)
                        .fontWeight(.medium)
                    }
                }
            }
            .trackScreen("Login")
            .dismissKeyboardOnTap()
            .sheet(item: $forgotPasswordPresentation) { _ in
                ForgotPasswordSheet {
                    forgotPasswordPresentation = nil
                }
            }
            .task {
                await viewModel.loadLastUsedEmail()
                if !reduceMotion {
                    try? await Task.sleep(for: .milliseconds(100))
                }
                withAnimation(DesignTokens.Animation.entranceSpring) {
                    isAppeared = true
                }
            }
        }
    }
}

// MARK: - Computed Properties

extension LoginView {
    private var headerSection: some View {
        VStack(spacing: DesignTokens.Spacing.lg) {
            PulpeIcon(size: 72)
                .scaleEffect(isAppeared ? 1 : 0.8)
                .opacity(isAppeared ? 1 : 0)
                .animation(reduceMotion ? nil : DesignTokens.Animation.entranceSpring, value: isAppeared)

            VStack(spacing: DesignTokens.Spacing.xs) {
                Text("Content de te revoir")
                    .font(PulpeTypography.onboardingTitle)
                    .foregroundStyle(Color.textPrimaryOnboarding)

                Text("Connecte-toi pour accéder à ton budget")
                    .font(PulpeTypography.subheadline)
                    .foregroundStyle(Color.textSecondaryOnboarding)
            }
            .multilineTextAlignment(.center)
            .opacity(isAppeared ? 1 : 0)
            .offset(y: isAppeared ? 0 : 10)
            .animation(reduceMotion ? nil : DesignTokens.Animation.entranceSpring.delay(0.1), value: isAppeared)
        }
        .padding(.top, DesignTokens.Spacing.xxxl)
    }

    private var formSection: some View {
        VStack(spacing: DesignTokens.Spacing.xl) {
            errorBanner
            emailField
            passwordField
            forgotPasswordButton
            loginButton
            SocialLoginDivider()
            SocialLoginSection {
                appState.biometricError = nil
                isPresented?.wrappedValue = false
            }
            faceIDButton
        }
        .opacity(isAppeared ? 1 : 0)
        .offset(y: isAppeared ? 0 : 20)
        .animation(reduceMotion ? nil : DesignTokens.Animation.entranceSpring.delay(0.2), value: isAppeared)
    }

    @ViewBuilder
    private var errorBanner: some View {
        if let errorMessage = viewModel.errorMessage ?? appState.biometricError {
            HStack(spacing: DesignTokens.Spacing.sm) {
                Image(systemName: "exclamationmark.triangle.fill")
                    .font(PulpeTypography.body)
                    .foregroundStyle(Color.errorPrimary)
                Text(errorMessage)
                    .font(PulpeTypography.subheadline)
                    .multilineTextAlignment(.leading)
                    .foregroundStyle(Color.textPrimary)
            }
            .padding(DesignTokens.Spacing.lg)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Color.errorBackground, in: .rect(cornerRadius: DesignTokens.CornerRadius.button))
        }
    }

    private var emailField: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
            Text("E-mail")
                .font(PulpeTypography.inputLabel)
                .foregroundStyle(Color.textPrimaryOnboarding)

            AuthTextField(
                prompt: "Adresse e-mail",
                text: $viewModel.email,
                systemImage: "envelope",
                isFocused: focusedField == .email,
                isFilled: viewModel.isEmailValid
            )
            .textContentType(.emailAddress)
            .keyboardType(.emailAddress)
            .textInputAutocapitalization(.never)
            .autocorrectionDisabled()
            .focused($focusedField, equals: .email)
            .accessibilityIdentifier("email")
            .accessibilityLabel("Adresse e-mail")
            .accessibilityHint("Saisis ton adresse e-mail")
        }
    }

    private var passwordField: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
            Text("Mot de passe")
                .font(PulpeTypography.inputLabel)
                .foregroundStyle(Color.textPrimaryOnboarding)

            AuthSecureField(
                prompt: "Ton mot de passe",
                text: $viewModel.password,
                isVisible: $viewModel.showPassword,
                systemImage: "lock",
                isFocused: focusedField == .password
            )
            .textContentType(.password)
            .focused($focusedField, equals: .password)
            .accessibilityIdentifier("password")
            .accessibilityLabel("Mot de passe")
            .accessibilityHint("Saisis ton mot de passe")
        }
    }

    private var forgotPasswordButton: some View {
        HStack {
            Spacer()
            Button("Mot de passe oublié ?") {
                forgotPasswordPresentation = ForgotPasswordPresentation()
            }
            .font(PulpeTypography.labelMedium)
            .foregroundStyle(Color.pulpePrimary)
            .textLinkButtonStyle()
            .accessibilityIdentifier("forgotPasswordButton")
        }
    }

    private var loginButton: some View {
        Button {
            Task { await login() }
        } label: {
            if viewModel.isLoading {
                ProgressView()
                    .tint(.white)
                    .accessibilityLabel("Connexion en cours")
            } else {
                Text("Se connecter")
            }
        }
        .primaryButtonStyle(isEnabled: viewModel.canSubmit)
        .disabled(!viewModel.canSubmit)
        .animation(.easeInOut(duration: DesignTokens.Animation.fast), value: viewModel.canSubmit)
        .accessibilityIdentifier("loginButton")
        .padding(.top, DesignTokens.Spacing.sm)
    }

    @ViewBuilder
    private var faceIDButton: some View {
        if let onBiometric {
            Button {
                onBiometric()
            } label: {
                HStack(spacing: DesignTokens.Spacing.sm) {
                    Image(systemName: "faceid")
                        .font(PulpeTypography.body)
                    Text("Face ID")
                }
            }
            .secondaryButtonStyle()
            .accessibilityIdentifier("faceIDButton")
        }
    }

    private var termsFooter: some View {
        HStack(spacing: DesignTokens.Spacing.xs) {
            Link("CGU", destination: AppURLs.terms)
                .underline()
            Text("&")
            Link("Politique de confidentialité", destination: AppURLs.privacy)
                .underline()
        }
        .font(PulpeTypography.labelMedium)
        .foregroundStyle(Color.textSecondaryOnboarding)
    }

    private var createAccountSection: some View {
        HStack(spacing: DesignTokens.Spacing.xs) {
            Text("Nouveau sur Pulpe ?")
                .font(PulpeTypography.subheadline)
                .foregroundStyle(Color.textSecondaryOnboarding)

            Button {
                if let isPresented {
                    isPresented.wrappedValue = false
                } else {
                    appState.enterSignupFlow()
                }
            } label: {
                Text("Créer un compte")
                    .font(PulpeTypography.subheadline.weight(.semibold))
                    .foregroundStyle(Color.pulpePrimary)
            }
            .textLinkButtonStyle()
        }
        .padding(.top, DesignTokens.Spacing.md)
        .opacity(isAppeared ? 1 : 0)
        .animation(reduceMotion ? nil : .easeOut(duration: 0.4).delay(0.35), value: isAppeared)
    }

    private func login() async {
        focusedField = nil
        viewModel.isLoading = true
        viewModel.errorMessage = nil

        do {
            try await appState.login(email: viewModel.email, password: viewModel.password)
            AnalyticsService.shared.capture(.loginCompleted, properties: ["method": "email"])
            appState.biometricError = nil
            isPresented?.wrappedValue = false
        } catch {
            viewModel.errorMessage = AuthErrorLocalizer.localize(error)
            viewModel.isLoading = false
        }
    }
}

struct ForgotPasswordPresentation: Identifiable {
    let id = UUID()
}

#Preview {
    LoginView()
        .environment(AppState())
}
