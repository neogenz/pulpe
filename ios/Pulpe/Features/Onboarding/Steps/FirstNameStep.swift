import SwiftUI

struct FirstNameStep: View {
    private enum FormField: Hashable {
        case firstName
    }

    @Bindable var state: OnboardingState
    @FocusState private var focusedField: FormField?

    var body: some View {
        OnboardingStepView(
            step: .firstName,
            state: state,
            canProceed: state.isFirstNameValid,
            onNext: { Task { await persistIfAuthenticatedThenAdvance() } },
            content: {
                VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
                    // Required marker via Text concatenation: `*` keeps the
                    // secondary tone (Practical UI: never colour the asterisk
                    // red — red is reserved for errors).
                    (
                        Text("Prénom")
                        + Text(" *").foregroundStyle(Color.textSecondaryOnboarding)
                    )
                    .font(PulpeTypography.inputLabel)
                    .foregroundStyle(Color.textPrimaryOnboarding)

                    AuthTextField(
                        prompt: AppLocale.string("Ton prénom"),
                        text: $state.firstName,
                        systemImage: "person",
                        isFilled: state.isFirstNameValid,
                        focusBinding: $focusedField,
                        focusField: .firstName
                    )
                    .textContentType(.givenName)
                    .textInputAutocapitalization(.words)
                    .accessibilityLabel("Prénom, requis")
                    .accessibilityHint("Saisis ton prénom")
                }
                .task {
                    focusedField = .firstName
                }
            }
        )
        .trackScreen("Onboarding_FirstName")
    }

    private func persistIfAuthenticatedThenAdvance() async {
        guard state.isAuthenticated else {
            state.nextStep()
            return
        }

        state.isLoading = true
        state.error = nil
        do {
            try await state.persistFirstName { name in
                try await AuthService.shared.updateUserFirstName(name)
            }
            state.isLoading = false
            state.nextStep()
        } catch {
            state.error = APIError.serverError(message: AuthErrorLocalizer.localize(error))
            state.isLoading = false
            state.nextStep()
        }
    }
}

#Preview {
    FirstNameStep(state: OnboardingState())
}
