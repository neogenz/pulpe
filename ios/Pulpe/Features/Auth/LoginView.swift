import SwiftUI

struct LoginView: View {
    @Environment(AppState.self) private var appState
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var viewModel = LoginViewModel()
    @State private var canRetryBiometric = false
    @State private var isAppeared = false
    @State private var forgotPasswordPresentation: ForgotPasswordPresentation?
    @FocusState private var focusedField: Field?

    var isPresented: Binding<Bool>?

    private enum Field: Hashable {
        case email, password
    }

    var body: some View {
        NavigationStack {
            ZStack {
                Color.authGradientBackground

                ScrollView {
                    VStack(spacing: DesignTokens.Spacing.xxl) {
                        headerSection
                        formSection
                        createAccountSection
                    }
                    .padding(.horizontal, DesignTokens.Spacing.xxl)
                    .padding(.bottom, DesignTokens.Spacing.xxxl)
                }
                .scrollBounceBehavior(.basedOnSize)
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
            .dismissKeyboardOnTap()
            .sheet(item: $forgotPasswordPresentation) { _ in
                ForgotPasswordSheet {
                    forgotPasswordPresentation = nil
                }
            }
            .task {
                canRetryBiometric = await appState.canRetryBiometric()
                if !reduceMotion {
                    try? await Task.sleep(for: .milliseconds(100))
                }
                withAnimation {
                    isAppeared = true
                }
            }
        }
    }

    // MARK: - Header

    private var headerSection: some View {
        VStack(spacing: DesignTokens.Spacing.lg) {
            PulpeIcon(size: 64)
                .scaleEffect(isAppeared ? 1 : 0.8)
                .opacity(isAppeared ? 1 : 0)

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
        }
        .padding(.top, DesignTokens.Spacing.xxxl)
        .animation(reduceMotion ? nil : .spring(response: 0.6, dampingFraction: 0.8), value: isAppeared)
    }

    // MARK: - Form

    private var formSection: some View {
        VStack(spacing: DesignTokens.Spacing.xl) {
            errorBanner
            biometricSection
            emailField
            passwordField
            forgotPasswordButton
            loginButton
        }
        .opacity(isAppeared ? 1 : 0)
        .offset(y: isAppeared ? 0 : 20)
        .animation(reduceMotion ? nil : .spring(response: 0.6, dampingFraction: 0.8).delay(0.1), value: isAppeared)
    }

    // MARK: - Error Banner

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
            .background(Color.errorBackground, in: .rect(cornerRadius: DesignTokens.CornerRadius.md))
        }
    }

    // MARK: - Biometric Section

    @ViewBuilder
    private var biometricSection: some View {
        if canRetryBiometric && appState.biometricError == nil {
            Button {
                Task {
                    await appState.retryBiometricLogin()
                    canRetryBiometric = await appState.canRetryBiometric()
                }
            } label: {
                HStack(spacing: DesignTokens.Spacing.md) {
                    Image(systemName: biometricIcon)
                        .font(PulpeTypography.title3)
                    Text("Continuer avec \(BiometricService.shared.biometryDisplayName)")
                        .font(PulpeTypography.headline)
                }
                .frame(maxWidth: .infinity)
                .frame(height: DesignTokens.FrameHeight.button)
                .background(Color.textPrimaryOnboarding)
                .foregroundStyle(Color.onboardingBackground)
                .clipShape(RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.lg, style: .continuous))
                .shadow(color: .black.opacity(0.12), radius: 12, y: 6)
            }

            HStack(spacing: DesignTokens.Spacing.lg) {
                Rectangle()
                    .fill(Color.textSecondaryOnboarding.opacity(0.3))
                    .frame(height: DesignTokens.FrameHeight.separator)
                Text("ou")
                    .font(PulpeTypography.labelMedium)
                    .foregroundStyle(Color.textSecondaryOnboarding)
                Rectangle()
                    .fill(Color.textSecondaryOnboarding.opacity(0.3))
                    .frame(height: DesignTokens.FrameHeight.separator)
            }
            .padding(.vertical, DesignTokens.Spacing.xs)
        }
    }

    // MARK: - Email Field

    private var emailField: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
            Text("E-mail")
                .font(PulpeTypography.buttonSecondary)
                .foregroundStyle(Color.textPrimaryOnboarding)

            TextField(
                "",
                text: $viewModel.email,
                prompt: Text("exemple@email.com")
                    .foregroundStyle(Color.authInputPlaceholder)
            )
            .textContentType(.emailAddress)
            .keyboardType(.emailAddress)
            .textInputAutocapitalization(.never)
            .autocorrectionDisabled()
            .focused($focusedField, equals: .email)
            .font(PulpeTypography.body)
            .foregroundStyle(Color.authInputText)
            .padding(.horizontal, DesignTokens.Spacing.lg)
            .frame(height: DesignTokens.FrameHeight.button)
            .background {
                RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.button, style: .continuous)
                    .fill(Color.authInputBackground)
                    .overlay {
                        RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.button, style: .continuous)
                            .strokeBorder(
                                focusedField == .email ? Color.pulpePrimary.opacity(0.6) : Color.authInputBorder,
                                lineWidth: focusedField == .email ? 2 : 1
                            )
                    }
            }
            .animation(.easeInOut(duration: 0.2), value: focusedField)
            .accessibilityIdentifier("email")
            .accessibilityLabel("Adresse e-mail")
            .accessibilityHint("Saisis ton adresse e-mail")
        }
    }

    // MARK: - Password Field

    private var passwordField: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
            Text("Mot de passe")
                .font(PulpeTypography.buttonSecondary)
                .foregroundStyle(Color.textPrimaryOnboarding)

            HStack(spacing: DesignTokens.Spacing.md) {
                Group {
                    if viewModel.showPassword {
                        TextField(
                            "",
                            text: $viewModel.password,
                            prompt: Text("Ton mot de passe")
                                .foregroundStyle(Color.authInputPlaceholder)
                        )
                    } else {
                        SecureField(
                            "",
                            text: $viewModel.password,
                            prompt: Text("Ton mot de passe")
                                .foregroundStyle(Color.authInputPlaceholder)
                        )
                    }
                }
                .textContentType(.password)
                .focused($focusedField, equals: .password)
                .font(PulpeTypography.body)
                .foregroundStyle(Color.authInputText)
                .accessibilityIdentifier("password")

                Button {
                    withAnimation(.spring(response: 0.2, dampingFraction: 0.6)) {
                        viewModel.showPassword.toggle()
                    }
                } label: {
                    Image(systemName: viewModel.showPassword ? "eye.slash.fill" : "eye.fill")
                        .font(PulpeTypography.body)
                        .foregroundStyle(Color.authInputText.opacity(0.6))
                        .contentTransition(.symbolEffect(.replace))
                }
                .accessibilityLabel(viewModel.showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe")
            }
            .padding(.horizontal, DesignTokens.Spacing.lg)
            .frame(height: DesignTokens.FrameHeight.button)
            .background {
                RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.button, style: .continuous)
                    .fill(Color.authInputBackground)
                    .overlay {
                        RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.button, style: .continuous)
                            .strokeBorder(
                                focusedField == .password ? Color.pulpePrimary.opacity(0.6) : Color.authInputBorder,
                                lineWidth: focusedField == .password ? 2 : 1
                            )
                    }
            }
            .animation(.easeInOut(duration: 0.2), value: focusedField)
            .accessibilityLabel("Mot de passe")
            .accessibilityHint("Saisis ton mot de passe")
        }
    }

    // MARK: - Login Button

    private var forgotPasswordButton: some View {
        HStack {
            Spacer()
            Button("Mot de passe oublié ?") {
                forgotPasswordPresentation = ForgotPasswordPresentation()
            }
            .font(PulpeTypography.labelMedium)
            .foregroundStyle(Color.textPrimaryOnboarding.opacity(0.9))
            .accessibilityIdentifier("forgotPasswordButton")
        }
    }

    private var loginButton: some View {
        Button {
            Task {
                await login()
            }
        } label: {
            Group {
                if viewModel.isLoading {
                    ProgressView()
                        .tint(.white)
                        .accessibilityLabel("Connexion en cours")
                } else {
                    Text("Se connecter")
                        .font(PulpeTypography.buttonPrimary)
                }
            }
            .frame(maxWidth: .infinity)
            .frame(height: DesignTokens.FrameHeight.button)
            .background(viewModel.canSubmit ? Color.pulpePrimary : Color.pulpePrimary.opacity(0.4))
            .foregroundStyle(.white)
            .clipShape(RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.lg, style: .continuous))
        }
        .disabled(!viewModel.canSubmit)
        .animation(.easeInOut(duration: DesignTokens.Animation.fast), value: viewModel.canSubmit)
        .accessibilityIdentifier("loginButton")
        .padding(.top, DesignTokens.Spacing.sm)
    }

    // MARK: - Create Account

    private var createAccountSection: some View {
        HStack(spacing: DesignTokens.Spacing.xs) {
            Text("Nouveau sur Pulpe ?")
                .font(PulpeTypography.subheadline)
                .foregroundStyle(Color.textSecondaryOnboarding)

            Button {
                if let isPresented {
                    isPresented.wrappedValue = false
                } else {
                    OnboardingState.clearPersistedData()
                    appState.hasCompletedOnboarding = false
                }
            } label: {
                Text("Créer un compte")
                    .font(PulpeTypography.subheadline.weight(.semibold))
                    .foregroundStyle(Color.pulpePrimary)
            }
        }
        .padding(.top, DesignTokens.Spacing.md)
        .opacity(isAppeared ? 1 : 0)
        .animation(reduceMotion ? nil : .easeOut(duration: 0.4).delay(0.2), value: isAppeared)
    }

    private var biometricIcon: String {
        switch BiometricService.shared.biometryType {
        case .faceID:
            return "faceid"
        case .touchID:
            return "touchid"
        case .opticID:
            return "opticid"
        default:
            return "lock.fill"
        }
    }

    private func login() async {
        focusedField = nil
        viewModel.isLoading = true
        viewModel.errorMessage = nil

        do {
            try await appState.login(email: viewModel.email, password: viewModel.password)
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
