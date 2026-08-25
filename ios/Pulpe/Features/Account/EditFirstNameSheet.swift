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
            title: AppLocale.string("Prénom"),
            isLoading: viewModel.isSubmitting,
            focus: $focusedField,
            focusOrder: [Field.firstName]
        ) {
            FormTextField(
                hint: AppLocale.string("Ton prénom"),
                text: $viewModel.draft,
                label: AppLocale.string("Prénom"),
                accessibilityLabel: AppLocale.string("Prénom"),
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
                Text(AppLocale.string("Enregistrer"))
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

struct EditFirstNameDependencies: Sendable {
    var updateFirstName: @Sendable (String) async throws -> UserInfo

    static let live = EditFirstNameDependencies(
        updateFirstName: { name in
            try await AuthService.shared.updateUserFirstName(name)
        }
    )
}

@Observable @MainActor
final class EditFirstNameViewModel {
    var draft: String
    var isSubmitting = false
    var errorMessage: String?
    var isCompleted = false
    private(set) var savedUser: UserInfo?

    private let dependencies: EditFirstNameDependencies

    init(initialFirstName: String?, dependencies: EditFirstNameDependencies? = nil) {
        draft = initialFirstName ?? ""
        self.dependencies = dependencies ?? .live
    }

    var canSubmit: Bool {
        FirstNameResolver.normalized(draft) != nil && !isSubmitting
    }

    func submit() async {
        guard canSubmit else { return }

        isSubmitting = true
        errorMessage = nil
        defer { isSubmitting = false }

        do {
            guard let name = FirstNameResolver.normalized(draft) else { return }
            let user = FirstNameResolver.coalescing(
                try await dependencies.updateFirstName(name),
                fallbackFirstName: name
            )
            savedUser = user
            if let persisted = FirstNameResolver.normalized(user.firstName) {
                draft = persisted
            }
            isCompleted = true
        } catch {
            errorMessage = AuthErrorLocalizer.localize(error)
        }
    }
}

#Preview {
    EditFirstNameSheet(initialFirstName: "Marie")
        .environment(AppState())
}
