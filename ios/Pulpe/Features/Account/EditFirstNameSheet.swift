import SwiftUI

struct EditFirstNameSheet: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(AppState.self) private var appState
    @FocusState private var focusedField: Field?
    @State private var viewModel: EditFirstNameViewModel
    @State private var submitSuccessTrigger = false

    private enum Field: Hashable {
        case firstName
    }

    init(initialFirstName: String?, dependencies: EditFirstNameDependencies? = nil) {
        _viewModel = State(
            initialValue: EditFirstNameViewModel(
                initialFirstName: initialFirstName,
                dependencies: dependencies
            )
        )
    }

    var body: some View {
        SheetFormContainer(
            title: "Prénom",
            isLoading: viewModel.isSubmitting,
            focus: $focusedField,
            focusOrder: [Field.firstName]
        ) {
            FormTextField(
                hint: "Ton prénom",
                text: $viewModel.draft,
                label: "Prénom",
                accessibilityLabel: "Prénom",
                focusBinding: $focusedField,
                field: Field.firstName,
                textContentType: .givenName
            )

            if let error = viewModel.errorMessage {
                ErrorBanner(message: error)
            }

            Button {
                Task { await save() }
            } label: {
                Text("Enregistrer")
            }
            .primaryButtonStyle(isEnabled: viewModel.canSubmit)
            .disabled(!viewModel.canSubmit)
            .accessibilityIdentifier("editFirstNameSubmit")
        }
        .sensoryFeedback(.success, trigger: submitSuccessTrigger)
    }

    private func save() async {
        await viewModel.submit()
        guard viewModel.isCompleted, let user = viewModel.savedUser else { return }
        appState.currentUser = user
        submitSuccessTrigger.toggle()
        appState.toastManager.show(AppLocale.string("Prénom enregistré"))
        dismiss()
    }
}

#Preview {
    EditFirstNameSheet(initialFirstName: "Marie")
        .environment(AppState())
}
