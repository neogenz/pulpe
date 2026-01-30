import SwiftUI

struct RegistrationStep: View {
    let state: OnboardingState
    let onComplete: (UserInfo) -> Void

    @State private var showPassword = false
    @State private var showPasswordConfirmation = false
    @FocusState private var focusedField: Field?

    private enum Field: Hashable {
        case email, password, passwordConfirmation
    }

    private var passwordMismatch: Bool {
        !state.passwordConfirmation.isEmpty && state.password != state.passwordConfirmation
    }

    var body: some View {
        OnboardingStepView(
            step: .registration,
            state: state,
            canProceed: state.canSubmitRegistration,
            onNext: { Task { await submitRegistration() } }
        ) {
            VStack(spacing: DesignTokens.Spacing.xl) {
                // Email
                VStack(alignment: .leading, spacing: DesignTokens.Spacing.xs) {
                    Text("Email")
                        .font(PulpeTypography.inputLabel)
                        .foregroundStyle(Color.textSecondaryOnboarding)

                    TextField("ton@email.com", text: Binding(
                        get: { state.email },
                        set: { state.email = $0 }
                    ))
                    .textContentType(.emailAddress)
                    .keyboardType(.emailAddress)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .focused($focusedField, equals: .email)
                    .font(PulpeTypography.bodyLarge)
                    .padding(.horizontal, DesignTokens.Spacing.lg)
                    .frame(height: DesignTokens.FrameHeight.button)
                    .background(Color.inputBackgroundSoft)
                    .clipShape(.rect(cornerRadius: DesignTokens.CornerRadius.button))
                    .shadow(
                        color: focusedField == .email ? Color.inputFocusGlow : Color.black.opacity(0.04),
                        radius: focusedField == .email ? 8 : 4,
                        y: focusedField == .email ? 2 : 1
                    )
                    .scaleEffect(focusedField == .email ? 1.01 : 1)
                    .animation(.spring(response: 0.3, dampingFraction: 0.7), value: focusedField)
                }

                // Password
                VStack(alignment: .leading, spacing: DesignTokens.Spacing.xs) {
                    Text("Mot de passe")
                        .font(PulpeTypography.inputLabel)
                        .foregroundStyle(Color.textSecondaryOnboarding)

                    HStack(spacing: DesignTokens.Spacing.md) {
                        Group {
                            if showPassword {
                                TextField("••••••••", text: Binding(
                                    get: { state.password },
                                    set: { state.password = $0 }
                                ))
                            } else {
                                SecureField("••••••••", text: Binding(
                                    get: { state.password },
                                    set: { state.password = $0 }
                                ))
                            }
                        }
                        .textContentType(.newPassword)
                        .focused($focusedField, equals: .password)
                        .font(PulpeTypography.bodyLarge)

                        Button {
                            withAnimation(.spring(response: 0.2, dampingFraction: 0.6)) {
                                showPassword.toggle()
                            }
                        } label: {
                            Image(systemName: showPassword ? "eye.slash.fill" : "eye.fill")
                                .font(PulpeTypography.bodyLarge)
                                .foregroundStyle(Color.textTertiaryOnboarding)
                                .contentTransition(.symbolEffect(.replace))
                        }
                        .accessibilityLabel(showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe")
                    }
                    .padding(.horizontal, DesignTokens.Spacing.lg)
                    .frame(height: DesignTokens.FrameHeight.button)
                    .background(Color.inputBackgroundSoft)
                    .clipShape(.rect(cornerRadius: DesignTokens.CornerRadius.button))
                    .shadow(
                        color: focusedField == .password ? Color.inputFocusGlow : Color.black.opacity(0.04),
                        radius: focusedField == .password ? 8 : 4,
                        y: focusedField == .password ? 2 : 1
                    )
                    .scaleEffect(focusedField == .password ? 1.01 : 1)
                    .animation(.spring(response: 0.3, dampingFraction: 0.7), value: focusedField)

                    Text("8 caractères minimum, dont une majuscule et un chiffre")
                        .font(.caption)
                        .foregroundStyle(Color.textTertiaryOnboarding)
                }

                // Password confirmation
                VStack(alignment: .leading, spacing: DesignTokens.Spacing.xs) {
                    Text("Confirmer le mot de passe")
                        .font(PulpeTypography.inputLabel)
                        .foregroundStyle(Color.textSecondaryOnboarding)

                    HStack(spacing: DesignTokens.Spacing.md) {
                        Group {
                            if showPasswordConfirmation {
                                TextField("••••••••", text: Binding(
                                    get: { state.passwordConfirmation },
                                    set: { state.passwordConfirmation = $0 }
                                ))
                            } else {
                                SecureField("••••••••", text: Binding(
                                    get: { state.passwordConfirmation },
                                    set: { state.passwordConfirmation = $0 }
                                ))
                            }
                        }
                        .textContentType(.newPassword)
                        .focused($focusedField, equals: .passwordConfirmation)
                        .font(PulpeTypography.bodyLarge)

                        Button {
                            withAnimation(.spring(response: 0.2, dampingFraction: 0.6)) {
                                showPasswordConfirmation.toggle()
                            }
                        } label: {
                            Image(systemName: showPasswordConfirmation ? "eye.slash.fill" : "eye.fill")
                                .font(PulpeTypography.bodyLarge)
                                .foregroundStyle(Color.textTertiaryOnboarding)
                                .contentTransition(.symbolEffect(.replace))
                        }
                        .accessibilityLabel(showPasswordConfirmation ? "Masquer le mot de passe" : "Afficher le mot de passe")
                    }
                    .padding(.horizontal, DesignTokens.Spacing.lg)
                    .frame(height: DesignTokens.FrameHeight.button)
                    .background(passwordMismatch ? Color.errorBackground : Color.inputBackgroundSoft)
                    .clipShape(.rect(cornerRadius: DesignTokens.CornerRadius.button))
                    .shadow(
                        color: focusedField == .passwordConfirmation ? Color.inputFocusGlow : Color.black.opacity(0.04),
                        radius: focusedField == .passwordConfirmation ? 8 : 4,
                        y: focusedField == .passwordConfirmation ? 2 : 1
                    )
                    .scaleEffect(focusedField == .passwordConfirmation ? 1.01 : 1)
                    .animation(.spring(response: 0.3, dampingFraction: 0.7), value: focusedField)

                    if passwordMismatch {
                        Text("Les mots de passe ne correspondent pas")
                            .font(.caption)
                            .foregroundStyle(Color.errorPrimary)
                    }
                }

                // Terms acceptance
                Toggle(isOn: Binding(
                    get: { state.acceptTerms },
                    set: { state.acceptTerms = $0 }
                )) {
                    Text("J'accepte les [conditions d'utilisation](https://pulpe.app/terms) et la [politique de confidentialité](https://pulpe.app/privacy)")
                        .font(.caption)
                }
                .toggleStyle(.pulpeCheckbox)
            }
            .padding(DesignTokens.Spacing.xxl)
            .pulpeCardBackground(cornerRadius: 24)
        }
    }

    private func submitRegistration() async {
        state.isLoading = true
        state.error = nil

        do {
            // Step 1: Create user account (if not already created)
            let authService = AuthService.shared
            var user: UserInfo

            switch state.signupProgress {
            case .notStarted:
                user = try await authService.signup(email: state.email, password: state.password)
                state.signupProgress = .userCreated
            case .userCreated, .templateCreated:
                guard let existingUser = try await authService.validateSession() else {
                    throw APIError.unauthorized
                }
                user = existingUser
            }

            // Step 2: Create template (if not already created)
            let templateId: String
            if case .templateCreated(let existingId) = state.signupProgress {
                templateId = existingId
            } else {
                let templateService = TemplateService.shared
                let template = try await templateService.createTemplateFromOnboarding(state.createTemplateData())
                templateId = template.id
                state.signupProgress = .templateCreated(templateId: templateId)
            }

            // Step 3: Create initial budget for current month
            let budgetService = BudgetService.shared
            let now = Date()
            let budgetData = BudgetCreate(
                month: now.month,
                year: now.year,
                description: now.monthYearFormatted,
                templateId: templateId
            )
            _ = try await budgetService.createBudget(budgetData)

            // Clear sensitive data and storage
            state.password = ""
            state.passwordConfirmation = ""
            state.clearStorage()
            state.isLoading = false

            onComplete(user)

        } catch let apiError as APIError {
            state.error = apiError
            state.isLoading = false
        } catch {
            let localizedMessage = AuthErrorLocalizer.localize(error)
            state.error = APIError.serverError(message: localizedMessage)
            state.isLoading = false
        }
    }
}

// MARK: - Checkbox Toggle Style

struct CheckboxToggleStyle: ToggleStyle {
    func makeBody(configuration: Configuration) -> some View {
        HStack(alignment: .top, spacing: DesignTokens.Spacing.md) {
            Image(systemName: configuration.isOn ? "checkmark.square.fill" : "square")
                .font(.title3)
                .foregroundStyle(configuration.isOn ? Color.accentColor : Color.secondary)
                .onTapGesture {
                    configuration.isOn.toggle()
                }

            configuration.label
        }
    }
}

extension ToggleStyle where Self == CheckboxToggleStyle {
    static var pulpeCheckbox: CheckboxToggleStyle { CheckboxToggleStyle() }
}

#Preview {
    RegistrationStep(state: OnboardingState()) { user in
        print("Completed with user: \(user)")
    }
}
