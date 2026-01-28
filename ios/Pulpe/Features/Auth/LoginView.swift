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
            ScrollView {
                VStack(spacing: 0) {
                    // Logo and title
                    VStack(spacing: DesignTokens.Spacing.xl) {
                        PulpeIcon(size: 88)
                            .scaleEffect(isAppeared ? 1 : 0.8)
                            .opacity(isAppeared ? 1 : 0)

                        VStack(spacing: DesignTokens.Spacing.sm) {
                            Text("Pulpe")
                                .font(PulpeTypography.brandTitle)
                                .tracking(1)
                                .foregroundStyle(Color.pulpePrimary)

                            Text("Content de te revoir")
                                .font(PulpeTypography.onboardingSubtitle)
                                .foregroundStyle(Color.textSecondaryOnboarding)
                        }
                        .opacity(isAppeared ? 1 : 0)
                        .offset(y: isAppeared ? 0 : 10)
                    }
                    .padding(.top, 56)
                    .padding(.bottom, 44)
                    .animation(reduceMotion ? nil : .spring(response: 0.6, dampingFraction: 0.8), value: isAppeared)

                    // Form card
                    VStack(spacing: DesignTokens.Spacing.xl) {
                        // Error message
                        if let errorMessage = viewModel.errorMessage {
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
                            .background(Color.errorBackground, in: RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.md))
                        }

                        // Biometric button
                        if canRetryBiometric {
                            Button {
                                Task {
                                    await appState.retryBiometricLogin()
                                }
                            } label: {
                                HStack(spacing: DesignTokens.Spacing.md) {
                                    Image(systemName: biometricIcon)
                                        .font(.title3)
                                    Text("Continuer avec \(BiometricService.shared.biometryDisplayName)")
                                        .fontWeight(.medium)
                                }
                                .frame(maxWidth: .infinity)
                                .frame(height: DesignTokens.FrameHeight.button)
                                .background(Color.onboardingGradient)
                                .foregroundStyle(Color.textOnPrimary)
                                .clipShape(RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.button))
                                .shadow(color: Color.pulpePrimary.opacity(0.25), radius: 8, y: 4)
                            }

                            // Divider
                            HStack(spacing: DesignTokens.Spacing.lg) {
                                Rectangle()
                                    .fill(Color.secondary.opacity(0.2))
                                    .frame(height: DesignTokens.FrameHeight.separator)
                                Text("ou")
                                    .font(.footnote)
                                    .foregroundStyle(.secondary)
                                Rectangle()
                                    .fill(Color.secondary.opacity(0.2))
                                    .frame(height: DesignTokens.FrameHeight.separator)
                            }
                            .padding(.vertical, DesignTokens.Spacing.xs)
                        }

                        // Email field
                        VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
                            Text("Adresse e-mail")
                                .font(PulpeTypography.inputLabel)
                                .foregroundStyle(Color.textSecondaryOnboarding)

                            TextField(
                                "",
                                text: $viewModel.email,
                                prompt: Text("exemple@email.com")
                                    .foregroundStyle(Color.textTertiaryOnboarding)
                            )
                            .textContentType(.emailAddress)
                            .keyboardType(.emailAddress)
                            .textInputAutocapitalization(.never)
                            .autocorrectionDisabled()
                            .focused($focusedField, equals: .email)
                            .font(PulpeTypography.bodyLarge)
                            .padding(.horizontal, DesignTokens.Spacing.lg)
                            .frame(height: DesignTokens.FrameHeight.button)
                            .background(Color.inputBackgroundSoft)
                            .clipShape(RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.button))
                            .shadow(
                                color: focusedField == .email ? Color.inputFocusGlow : Color.black.opacity(0.04),
                                radius: focusedField == .email ? 8 : 4,
                                y: focusedField == .email ? 2 : 1
                            )
                            .scaleEffect(focusedField == .email ? 1.01 : 1)
                            .animation(.spring(response: 0.3, dampingFraction: 0.7), value: focusedField)
                            .accessibilityIdentifier("email")
                        }

                        // Password field
                        VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
                            Text("Mot de passe")
                                .font(PulpeTypography.inputLabel)
                                .foregroundStyle(Color.textSecondaryOnboarding)

                            HStack(spacing: DesignTokens.Spacing.md) {
                                Group {
                                    if viewModel.showPassword {
                                        TextField(
                                            "",
                                            text: $viewModel.password,
                                            prompt: Text("Votre mot de passe")
                                                .foregroundStyle(Color.textTertiaryOnboarding)
                                        )
                                    } else {
                                        SecureField(
                                            "",
                                            text: $viewModel.password,
                                            prompt: Text("Votre mot de passe")
                                                .foregroundStyle(Color.textTertiaryOnboarding)
                                        )
                                    }
                                }
                                .textContentType(.password)
                                .focused($focusedField, equals: .password)
                                .font(PulpeTypography.bodyLarge)
                                .accessibilityIdentifier("password")

                                Button {
                                    withAnimation(.spring(response: 0.2, dampingFraction: 0.6)) {
                                        viewModel.showPassword.toggle()
                                    }
                                } label: {
                                    Image(systemName: viewModel.showPassword ? "eye.slash.fill" : "eye.fill")
                                        .font(PulpeTypography.bodyLarge)
                                        .foregroundStyle(Color.textTertiaryOnboarding)
                                        .contentTransition(.symbolEffect(.replace))
                                }
                                .accessibilityLabel(viewModel.showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe")
                            }
                            .padding(.horizontal, DesignTokens.Spacing.lg)
                            .frame(height: DesignTokens.FrameHeight.button)
                            .background(Color.inputBackgroundSoft)
                            .clipShape(RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.button))
                            .shadow(
                                color: focusedField == .password ? Color.inputFocusGlow : Color.black.opacity(0.04),
                                radius: focusedField == .password ? 8 : 4,
                                y: focusedField == .password ? 2 : 1
                            )
                            .scaleEffect(focusedField == .password ? 1.01 : 1)
                            .animation(.spring(response: 0.3, dampingFraction: 0.7), value: focusedField)
                        }

                        // Login button
                        Button {
                            Task {
                                await login()
                            }
                        } label: {
                            HStack(spacing: DesignTokens.Spacing.sm) {
                                if viewModel.isLoading {
                                    ProgressView()
                                        .tint(Color.textOnPrimary)
                                        .accessibilityLabel("Connexion en cours")
                                } else {
                                    Text("Se connecter")
                                        .fontWeight(.semibold)
                                    Image(systemName: "arrow.right")
                                        .font(PulpeTypography.inputLabel)
                                }
                            }
                            .frame(maxWidth: .infinity)
                            .frame(height: DesignTokens.FrameHeight.button)
                            .background(viewModel.canSubmit ? Color.onboardingGradient : nil)
                            .background(viewModel.canSubmit ? nil : Color.secondary.opacity(0.3))
                            .foregroundStyle(viewModel.canSubmit ? Color.textOnPrimary : Color.secondary)
                            .clipShape(RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.button))
                            .shadow(
                                color: viewModel.canSubmit ? Color.pulpePrimary.opacity(0.25) : .clear,
                                radius: 8,
                                y: 4
                            )
                        }
                        .disabled(!viewModel.canSubmit)
                        .animation(.easeInOut(duration: 0.2), value: viewModel.canSubmit)
                        .accessibilityIdentifier("loginButton")
                        .padding(.top, DesignTokens.Spacing.sm)
                    }
                    .padding(DesignTokens.Spacing.xxl)
                    .background(Color.onboardingCardBackground)
                    .clipShape(RoundedRectangle(cornerRadius: 24))
                    .shadow(color: Color.black.opacity(0.08), radius: 24, y: 10)
                    .padding(.horizontal, DesignTokens.Spacing.xl)
                    .opacity(isAppeared ? 1 : 0)
                    .offset(y: isAppeared ? 0 : 20)
                    .animation(reduceMotion ? nil : .spring(response: 0.6, dampingFraction: 0.8).delay(0.1), value: isAppeared)

                    // Create account link
                    VStack(spacing: DesignTokens.Spacing.sm) {
                        Text("Nouveau sur Pulpe ?")
                            .font(PulpeTypography.stepSubtitle)
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
                                .font(PulpeTypography.labelLarge)
                                .foregroundStyle(Color.pulpePrimary)
                        }
                    }
                    .padding(.top, 32)
                    .opacity(isAppeared ? 1 : 0)
                    .animation(reduceMotion ? nil : .easeOut(duration: 0.4).delay(0.2), value: isAppeared)

                    Spacer(minLength: 40)
                }
            }
            .scrollBounceBehavior(.basedOnSize)
            .background(Color.onboardingBackground)
            .toolbar {
                if let isPresented {
                    ToolbarItem(placement: .cancellationAction) {
                        Button("Annuler") {
                            isPresented.wrappedValue = false
                        }
                        .foregroundStyle(Color.pulpePrimary)
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
            isPresented?.wrappedValue = false
        } catch {
            viewModel.errorMessage = AuthErrorLocalizer.localize(error)
            viewModel.isLoading = false
        }
    }
}

@Observable @MainActor
final class LoginViewModel {
    var email = ""
    var password = ""
    var showPassword = false
    var isLoading = false
    var errorMessage: String?

    var isEmailValid: Bool {
        let pattern = /^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$/
        return email.wholeMatch(of: pattern) != nil
    }

    var isPasswordValid: Bool {
        password.count >= 8
    }

    var canSubmit: Bool {
        isEmailValid && isPasswordValid && !isLoading
    }
}

#Preview {
    LoginView()
        .environment(AppState())
}
