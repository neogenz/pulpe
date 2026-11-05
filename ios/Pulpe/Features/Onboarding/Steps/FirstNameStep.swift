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
            subtitle: AppLocale.string("Je l'utilise pour te saluer, rien d'autre."),
            onNext: { Task { await persistIfAuthenticatedThenAdvance() } },
            zone: { greeting },
            content: {
                VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
                    // Required marker via Text concatenation: `*` keeps the secondary tone
                    // (never colour the asterisk red, red is reserved for errors).
                    (
                        Text("Prénom")
                        + Text(" *").foregroundStyle(Color.textSecondary)
                    )
                    .font(PulpeTypography.inputLabel)
                    .foregroundStyle(Color.textPrimary)

                    AuthTextField(
                        prompt: AppLocale.string("Ton prénom"),
                        text: $state.firstName,
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

    /// The zone answers what is typed: "Enchanté, Léa", live.
    private var greeting: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.xs) {
            Text("Enchanté,")
                .font(PulpeTypography.sectionTitle)
                .foregroundStyle(Color.heroAccentPositive)
            Text(FirstNameResolver.normalized(state.firstName) ?? AppLocale.string("toi"))
                .font(PulpeTypography.entryGreeting)
                .foregroundStyle(Color.heroInk.opacity(state.isFirstNameValid ? 1 : DesignTokens.Opacity.heavy))
                .lineLimit(1)
                .minimumScaleFactor(DesignTokens.TextScale.compact)
                .contentTransition(.interpolate)
            Text("Dans 2 minutes, ton budget est prêt.")
                .font(PulpeTypography.onboardingSubtitle)
                .foregroundStyle(Color.heroInkSecondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityElement(children: .combine)
    }

    private func persistIfAuthenticatedThenAdvance() async {
        guard state.isAuthenticated else {
            state.nextStep()
            return
        }

        state.isLoading = true
        state.error = nil
        defer {
            state.isLoading = false
            state.nextStep()
        }
        do {
            try await state.persistFirstName { name in
                try await AuthService.shared.updateUserFirstName(name)
            }
        } catch {
            state.error = APIError.serverError(message: AuthErrorLocalizer.localize(error))
        }
    }
}

#Preview {
    FirstNameStep(state: OnboardingState())
}
