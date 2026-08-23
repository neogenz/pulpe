import Foundation
@testable import Pulpe
import Testing

@MainActor
struct EditFirstNameViewModelTests {
    private enum PersistStubError: Error {
        case network
    }

    @Test func canSubmit_falseWhenDraftIsBlank() {
        let viewModel = EditFirstNameViewModel(
            initialFirstName: "   ",
            dependencies: EditFirstNameDependencies(updateFirstName: { _ in
                Issue.record("update should not run")
                return UserInfo(id: "1", email: "a@b.com")
            })
        )
        #expect(!viewModel.canSubmit)
    }

    @Test func init_prefillsCurrentFirstNameAndIgnoresEmail() {
        let viewModel = EditFirstNameViewModel(
            initialFirstName: "Marie",
            dependencies: EditFirstNameDependencies(updateFirstName: { _ in
                Issue.record("update should not run")
                return UserInfo(id: "1", email: "marie@example.com")
            })
        )
        #expect(viewModel.draft == "Marie")
        #expect(!viewModel.draft.contains("@"))
    }

    @Test func submit_whenPersistSucceeds_updatesSavedUser() async {
        let viewModel = EditFirstNameViewModel(
            initialFirstName: "  Marie  ",
            dependencies: EditFirstNameDependencies(updateFirstName: { name in
                #expect(name == "  Marie  ")
                return UserInfo(id: "1", email: "a@b.com", firstName: "Marie")
            })
        )

        await viewModel.submit()

        #expect(viewModel.isCompleted)
        #expect(viewModel.errorMessage == nil)
        #expect(viewModel.savedUser?.firstName == "Marie")
        #expect(viewModel.draft == "Marie")
    }

    @Test func submit_whenPersistFails_keepsDraftForRetry() async {
        let viewModel = EditFirstNameViewModel(
            initialFirstName: "Marie",
            dependencies: EditFirstNameDependencies(updateFirstName: { _ in
                throw PersistStubError.network
            })
        )

        await viewModel.submit()

        #expect(!viewModel.isCompleted)
        #expect(viewModel.errorMessage != nil)
        #expect(viewModel.draft == "Marie")
        #expect(viewModel.savedUser == nil)
        #expect(viewModel.canSubmit)
    }

    @Test func submit_doesNotDeriveANameFromRelayEmail() async {
        let viewModel = EditFirstNameViewModel(
            initialFirstName: nil,
            dependencies: EditFirstNameDependencies(updateFirstName: { _ in
                Issue.record("blank draft must not persist")
                return UserInfo(
                    id: "1",
                    email: "xyz@privaterelay.appleid.com",
                    firstName: "xyz"
                )
            })
        )
        viewModel.draft = ""

        await viewModel.submit()

        #expect(!viewModel.isCompleted)
        #expect(viewModel.savedUser == nil)
    }
}
