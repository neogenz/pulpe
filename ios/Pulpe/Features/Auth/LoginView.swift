import SwiftUI

struct LoginView: View {
    @Environment(AppState.self) private var appState
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var viewModel = LoginViewModel()
    @State private var canRetryBiometric = false
    @State private var isAppeared = false
    @FocusState private var focusedField: Field?

    var isPresented: Binding<Bool>?

    private enum Field: Hashable {
        case email, password
    }

    var body: some View {
        NavigationStack {
            ZStack {
                // Full-screen gradient background
                Color.authGradientBackground
                
                ScrollView {
                    VStack(spacing: 0) {
                        headerSection
                        formCard
                        createAccountSection
                        Spacer(minLength: 40)
                    }
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
        VStack(spacing: DesignTokens.Spacing.xl) {
            // Icon with subtle glow
            ZStack {
                Circle()
                    .fill(Color.white.opacity(0.15))
                    .frame(width: 100, height: 100)
                    .blur(radius: 20)
                
                PulpeIcon(size: 88)
            }
            .scaleEffect(isAppeared ? 1 : 0.8)
            .opacity(isAppeared ? 1 : 0)

            VStack(spacing: DesignTokens.Spacing.sm) {
                Text("Pulpe")
                    .font(.system(size: 36, weight: .bold, design: .rounded))
                    .tracking(1)
                    .foregroundStyle(Color.textPrimaryOnboarding)

                Text("Content de te revoir")
                    .font(PulpeTypography.onboardingSubtitle)
                    .foregroundStyle(Color.textSecondaryOnboarding)
            }
            .opacity(isAppeared ? 1 : 0)
            .offset(y: isAppeared ? 0 : 10)
        }
        .padding(.top, 64)
        .padding(.bottom, 48)
        .animation(reduceMotion ? nil : .spring(response: 0.6, dampingFraction: 0.8), value: isAppeared)
    }

    // MARK: - Form Card

    private var formCard: some View {
        VStack(spacing: DesignTokens.Spacing.xl) {
            errorBanner
            biometricSection
            emailField
            passwordField
            loginButton
        }
        .padding(DesignTokens.Spacing.xxl)
        .background {
            ZStack {
                // Glass-morphic background
                RoundedRectangle(cornerRadius: 28, style: .continuous)
                    .fill(Color.authCardGlass)
                
                // Subtle border
                RoundedRectangle(cornerRadius: 28, style: .continuous)
                    .strokeBorder(Color.white.opacity(0.2), lineWidth: 1)
            }
            .shadow(color: .black.opacity(0.08), radius: 30, y: 15)
        }
        .padding(.horizontal, DesignTokens.Spacing.xl)
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
                    .font(.body)
                    .foregroundStyle(Color.errorPrimary)
                Text(errorMessage)
                    .font(.subheadline)
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
                        .font(.title3)
                    Text("Continuer avec \(BiometricService.shared.biometryDisplayName)")
                        .fontWeight(.semibold)
                }
                .frame(maxWidth: .infinity)
                .frame(height: DesignTokens.FrameHeight.button)
                .background(Color.textPrimaryOnboarding)
                .foregroundStyle(Color.onboardingBackground)
                .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                .shadow(color: .black.opacity(0.12), radius: 12, y: 6)
            }

            HStack(spacing: DesignTokens.Spacing.lg) {
                Rectangle()
                    .fill(Color.textSecondaryOnboarding.opacity(0.3))
                    .frame(height: DesignTokens.FrameHeight.separator)
                Text("ou")
                    .font(.footnote.weight(.medium))
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
            Text("Adresse e-mail")
                .font(.subheadline.weight(.medium))
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
            .font(.body)
            .foregroundStyle(Color.authInputText)
            .padding(.horizontal, DesignTokens.Spacing.lg)
            .frame(height: DesignTokens.FrameHeight.button)
            .background {
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .fill(Color.authInputBackground)
                    .overlay {
                        RoundedRectangle(cornerRadius: 14, style: .continuous)
                            .strokeBorder(
                                focusedField == .email ? Color.pulpePrimary.opacity(0.6) : Color.authInputBorder,
                                lineWidth: focusedField == .email ? 2 : 1
                            )
                    }
            }
            .shadow(
                color: focusedField == .email ? Color.pulpePrimary.opacity(0.2) : Color.black.opacity(0.05),
                radius: focusedField == .email ? 12 : 4,
                y: 4
            )
            .scaleEffect(focusedField == .email ? 1.01 : 1)
            .animation(.spring(response: 0.3, dampingFraction: 0.7), value: focusedField)
            .accessibilityIdentifier("email")
        }
    }

    // MARK: - Password Field

    private var passwordField: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
            Text("Mot de passe")
                .font(.subheadline.weight(.medium))
                .foregroundStyle(Color.textPrimaryOnboarding)

            HStack(spacing: DesignTokens.Spacing.md) {
                Group {
                    if viewModel.showPassword {
                        TextField(
                            "",
                            text: $viewModel.password,
                            prompt: Text("Votre mot de passe")
                                .foregroundStyle(Color.authInputPlaceholder)
                        )
                    } else {
                        SecureField(
                            "",
                            text: $viewModel.password,
                            prompt: Text("Votre mot de passe")
                                .foregroundStyle(Color.authInputPlaceholder)
                        )
                    }
                }
                .textContentType(.password)
                .focused($focusedField, equals: .password)
                .font(.body)
                .foregroundStyle(Color.authInputText)
                .accessibilityIdentifier("password")

                Button {
                    withAnimation(.spring(response: 0.2, dampingFraction: 0.6)) {
                        viewModel.showPassword.toggle()
                    }
                } label: {
                    Image(systemName: viewModel.showPassword ? "eye.slash.fill" : "eye.fill")
                        .font(.body)
                        .foregroundStyle(Color.authInputText.opacity(0.6))
                        .contentTransition(.symbolEffect(.replace))
                }
                .accessibilityLabel(viewModel.showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe")
            }
            .padding(.horizontal, DesignTokens.Spacing.lg)
            .frame(height: DesignTokens.FrameHeight.button)
            .background {
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .fill(Color.authInputBackground)
                    .overlay {
                        RoundedRectangle(cornerRadius: 14, style: .continuous)
                            .strokeBorder(
                                focusedField == .password ? Color.pulpePrimary.opacity(0.6) : Color.authInputBorder,
                                lineWidth: focusedField == .password ? 2 : 1
                            )
                    }
            }
            .shadow(
                color: focusedField == .password ? Color.pulpePrimary.opacity(0.2) : Color.black.opacity(0.05),
                radius: focusedField == .password ? 12 : 4,
                y: 4
            )
            .scaleEffect(focusedField == .password ? 1.01 : 1)
            .animation(.spring(response: 0.3, dampingFraction: 0.7), value: focusedField)
        }
    }

    // MARK: - Login Button

    private var loginButton: some View {
        Button {
            Task {
                await login()
            }
        } label: {
            HStack(spacing: DesignTokens.Spacing.sm) {
                if viewModel.isLoading {
                    ProgressView()
                        .tint(Color.pulpePrimary)
                        .accessibilityLabel("Connexion en cours")
                } else {
                    Text("Se connecter")
                        .fontWeight(.semibold)
                    Image(systemName: "arrow.right")
                        .font(.subheadline.weight(.semibold))
                }
            }
            .frame(maxWidth: .infinity)
            .frame(height: DesignTokens.FrameHeight.button)
            .background(viewModel.canSubmit ? Color.white : Color.authInputBackground)
            .foregroundStyle(viewModel.canSubmit ? Color.pulpePrimary : Color.authInputPlaceholder)
            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
            .shadow(
                color: viewModel.canSubmit ? .black.opacity(0.15) : .black.opacity(0.05),
                radius: viewModel.canSubmit ? 16 : 8,
                y: viewModel.canSubmit ? 8 : 4
            )
        }
        .disabled(!viewModel.canSubmit)
        .animation(.easeInOut(duration: DesignTokens.Animation.fast), value: viewModel.canSubmit)
        .accessibilityIdentifier("loginButton")
        .padding(.top, DesignTokens.Spacing.sm)
    }

    // MARK: - Create Account

    private var createAccountSection: some View {
        VStack(spacing: DesignTokens.Spacing.md) {
            Text("Nouveau sur Pulpe ?")
                .font(.callout)
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
                    .font(.body.weight(.semibold))
                    .foregroundStyle(Color.textPrimaryOnboarding)
                    .padding(.horizontal, DesignTokens.Spacing.xxl)
                    .padding(.vertical, DesignTokens.Spacing.md)
                    .background {
                        Capsule()
                            .fill(Color.white.opacity(0.3))
                            .overlay {
                                Capsule()
                                    .strokeBorder(Color.white.opacity(0.4), lineWidth: 1)
                            }
                    }
            }
        }
        .padding(.top, DesignTokens.Spacing.xxxl)
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

#Preview {
    LoginView()
        .environment(AppState())
}
