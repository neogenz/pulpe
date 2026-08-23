import Foundation

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
            let user = FirstNameResolver.coalescing(
                try await dependencies.updateFirstName(draft),
                fallbackFirstName: draft
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
