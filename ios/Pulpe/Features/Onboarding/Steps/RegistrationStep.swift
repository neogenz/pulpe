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
            VStack(spacing: DesignTokens.Spacing.xxl) {
                Text("Crée ton compte pour sauvegarder ton budget")
                    .font(.body.weight(.medium))
                    .foregroundStyle(Color.textPrimaryOnboarding)
                    .multilineTextAlignment(.center)
                    .padding(.bottom, DesignTokens.Spacing.sm)

                // Email
                VStack(alignment: .leading, spacing: DesignTokens.Spacing.xs) {
                    Text("Email")
                        .font(.subheadline.weight(.medium))
                        .foregroundStyle(Color.textPrimaryOnboarding)

                    TextField("ton@email.com", text: Binding(
                        get: { state.email },
                        set: { state.email = $0 }
                    ))
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
                }

                // Password
                VStack(alignment: .leading, spacing: DesignTokens.Spacing.xs) {
                    Text("Mot de passe")
                        .font(.subheadline.weight(.medium))
                        .foregroundStyle(Color.textPrimaryOnboarding)

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
                        .font(.body)
                        .foregroundStyle(Color.authInputText)

                        Button {
                            withAnimation(.spring(response: 0.2, dampingFraction: 0.6)) {
                                showPassword.toggle()
                            }
                        } label: {
                            Image(systemName: showPassword ? "eye.slash.fill" : "eye.fill")
                                .font(.body)
                                .foregroundStyle(Color.authInputText.opacity(0.6))
                                .contentTransition(.symbolEffect(.replace))
                        }
                        .accessibilityLabel(showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe")
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

                    HStack(spacing: 6) {
                        Image(systemName: "info.circle.fill")
                            .font(.caption)
                            .foregroundStyle(Color.pulpePrimary.opacity(0.7))
                        Text("8 caractères minimum, dont une majuscule et un chiffre")
                            .font(.caption)
                            .foregroundStyle(Color.textSecondaryOnboarding)
                    }
                }

                // Password confirmation
                VStack(alignment: .leading, spacing: DesignTokens.Spacing.xs) {
                    Text("Confirmer le mot de passe")
                        .font(.subheadline.weight(.medium))
                        .foregroundStyle(Color.textPrimaryOnboarding)

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
                        .font(.body)
                        .foregroundStyle(Color.authInputText)

                        Button {
                            withAnimation(.spring(response: 0.2, dampingFraction: 0.6)) {
                                showPasswordConfirmation.toggle()
                            }
                        } label: {
                            Image(systemName: showPasswordConfirmation ? "eye.slash.fill" : "eye.fill")
                                .font(.body)
                                .foregroundStyle(Color.authInputText.opacity(0.6))
                                .contentTransition(.symbolEffect(.replace))
                        }
                        .accessibilityLabel(showPasswordConfirmation ? "Masquer le mot de passe" : "Afficher le mot de passe")
                    }
                    .padding(.horizontal, DesignTokens.Spacing.lg)
                    .frame(height: DesignTokens.FrameHeight.button)
                    .background {
                        RoundedRectangle(cornerRadius: 14, style: .continuous)
                            .fill(passwordMismatch ? Color.errorBackground : Color.authInputBackground)
                            .overlay {
                                RoundedRectangle(cornerRadius: 14, style: .continuous)
                                    .strokeBorder(
                                        passwordMismatch ? Color.errorPrimary.opacity(0.5) :
                                        focusedField == .passwordConfirmation ? Color.pulpePrimary.opacity(0.6) : Color.authInputBorder,
                                        lineWidth: focusedField == .passwordConfirmation || passwordMismatch ? 2 : 1
                                    )
                            }
                    }
                    .shadow(
                        color: focusedField == .passwordConfirmation ? Color.pulpePrimary.opacity(0.2) : Color.black.opacity(0.05),
                        radius: focusedField == .passwordConfirmation ? 12 : 4,
                        y: 4
                    )
                    .scaleEffect(focusedField == .passwordConfirmation ? 1.01 : 1)
                    .animation(.spring(response: 0.3, dampingFraction: 0.7), value: focusedField)

                    if passwordMismatch {
                        Text("Les mots de passe ne correspondent pas")
                            .font(.caption)
                            .foregroundStyle(Color.errorPrimary)
                    }
                }

                // Terms acceptance - modern checkbox
                Button {
                    state.acceptTerms.toggle()
                } label: {
                    HStack(alignment: .top, spacing: DesignTokens.Spacing.md) {
                        ZStack {
                            RoundedRectangle(cornerRadius: 6, style: .continuous)
                                .strokeBorder(state.acceptTerms ? Color.pulpePrimary : Color.authInputBorder, lineWidth: 2)
                                .frame(width: 24, height: 24)
                            
                            if state.acceptTerms {
                                Image(systemName: "checkmark")
                                    .font(.caption.weight(.bold))
                                    .foregroundStyle(Color.pulpePrimary)
                                    .transition(.scale.combined(with: .opacity))
                            }
                        }
                        .animation(.spring(response: 0.3, dampingFraction: 0.6), value: state.acceptTerms)
                        
                        Text("J'accepte les [conditions d'utilisation](https://pulpe.app/terms) et la [politique de confidentialité](https://pulpe.app/privacy)")
                            .font(.footnote)
                            .foregroundStyle(Color.textPrimaryOnboarding)
                            .multilineTextAlignment(.leading)
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }
                }
                .buttonStyle(.plain)
            }
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

#Preview {
    RegistrationStep(state: OnboardingState()) { user in
        print("Completed with user: \(user)")
    }
}
