import SwiftUI

struct PersonalInfoStep: View {
    let state: OnboardingState
    @FocusState private var isFocused: Bool

    var body: some View {
        OnboardingStepView(
            step: .personalInfo,
            state: state,
            canProceed: state.isFirstNameValid,
            onNext: { state.nextStep() }
        ) {
            VStack(alignment: .leading, spacing: 8) {
                Text("Prénom")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)

                TextField("Votre prénom", text: Binding(
                    get: { state.firstName },
                    set: { state.firstName = $0 }
                ))
                .textContentType(.givenName)
                .autocapitalization(.words)
                .focused($isFocused)
                .padding()
                .background(.background)
                .clipShape(RoundedRectangle(cornerRadius: 12))
                .overlay(
                    RoundedRectangle(cornerRadius: 12)
                        .stroke(isFocused ? Color.accentColor : Color.secondary.opacity(0.3), lineWidth: 1)
                )
                .onSubmit {
                    if state.isFirstNameValid {
                        state.nextStep()
                    }
                }
            }
            .onAppear {
                isFocused = true
            }
        }
    }
}

#Preview {
    PersonalInfoStep(state: OnboardingState())
}
