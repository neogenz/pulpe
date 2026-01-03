import SwiftUI

struct RegistrationStep: View {
    let state: OnboardingState
    let onComplete: (UserInfo) -> Void

    @State private var showPassword = false

    var body: some View {
        OnboardingStepView(
            step: .registration,
            state: state,
            canProceed: state.canSubmitRegistration,
            onNext: { Task { await submitRegistration() } }
        ) {
            VStack(spacing: 20) {
                // Email
                VStack(alignment: .leading, spacing: 4) {
                    Text("Email")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)

                    TextField("votre@email.com", text: Binding(
                        get: { state.email },
                        set: { state.email = $0 }
                    ))
                    .textContentType(.emailAddress)
                    .keyboardType(.emailAddress)
                    .autocapitalization(.none)
                    .autocorrectionDisabled()
                    .padding()
                    .background(.background)
                    .clipShape(RoundedRectangle(cornerRadius: 12))
                    .overlay(
                        RoundedRectangle(cornerRadius: 12)
                            .stroke(Color.secondary.opacity(0.3), lineWidth: 1)
                    )
                }

                // Password
                VStack(alignment: .leading, spacing: 4) {
                    Text("Mot de passe")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)

                    HStack {
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

                        Button {
                            showPassword.toggle()
                        } label: {
                            Image(systemName: showPassword ? "eye.slash" : "eye")
                                .foregroundStyle(.secondary)
                        }
                    }
                    .textContentType(.newPassword)
                    .padding()
                    .background(.background)
                    .clipShape(RoundedRectangle(cornerRadius: 12))
                    .overlay(
                        RoundedRectangle(cornerRadius: 12)
                            .stroke(Color.secondary.opacity(0.3), lineWidth: 1)
                    )

                    Text("Minimum 8 caractères")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }

                // Terms acceptance
                Toggle(isOn: Binding(
                    get: { state.acceptTerms },
                    set: { state.acceptTerms = $0 }
                )) {
                    Text("J'accepte les [conditions d'utilisation](https://pulpe.app/terms) et la [politique de confidentialité](https://pulpe.app/privacy)")
                        .font(.caption)
                }
                .toggleStyle(.checkbox)
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

            if !state.isUserCreated {
                user = try await authService.signup(email: state.email, password: state.password)
                state.isUserCreated = true
            } else {
                // User already created, validate session
                guard let existingUser = try await authService.validateSession() else {
                    throw APIError.unauthorized
                }
                user = existingUser
            }

            // Step 2: Create template from onboarding data
            let templateService = TemplateService.shared
            let template = try await templateService.createTemplateFromOnboarding(state.createTemplateData())

            // Step 3: Create initial budget for current month
            let budgetService = BudgetService.shared
            let now = Date()
            let budgetData = BudgetCreate(
                month: now.month,
                year: now.year,
                description: now.monthYearFormatted,
                templateId: template.id
            )
            _ = try await budgetService.createBudget(budgetData)

            // Clear storage and complete
            state.clearStorage()
            state.isLoading = false

            onComplete(user)

        } catch {
            state.error = error
            state.isLoading = false
        }
    }
}

// MARK: - Checkbox Toggle Style

struct CheckboxToggleStyle: ToggleStyle {
    func makeBody(configuration: Configuration) -> some View {
        HStack(alignment: .top, spacing: 12) {
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
    static var checkbox: CheckboxToggleStyle { CheckboxToggleStyle() }
}

#Preview {
    RegistrationStep(state: OnboardingState()) { user in
        print("Completed with user: \(user)")
    }
}
