import Foundation
import Testing
@testable import Pulpe

@MainActor
struct ChangePasswordViewModelTests {

    @Test func canSubmit_whenFormIsInvalid_returnsFalse() {
        // Given
        let viewModel = ChangePasswordViewModel(
            dependencies: ChangePasswordDependencies(
                verifyPassword: { _, _ in },
                updatePassword: { _ in }
            )
        )

        // Then
        #expect(!viewModel.canSubmit)

        viewModel.currentPassword = "current-password"
        viewModel.newPassword = "short"
        viewModel.confirmPassword = "short"
        #expect(!viewModel.canSubmit)
    }

    @Test func submit_whenFormIsInvalid_setsValidationError() async {
        // Given
        let viewModel = ChangePasswordViewModel(
            dependencies: ChangePasswordDependencies(
                verifyPassword: { _, _ in Issue.record("verifyPassword should not be called") },
                updatePassword: { _ in Issue.record("updatePassword should not be called") }
            )
        )
        viewModel.currentPassword = ""
        viewModel.newPassword = "newpassword123"
        viewModel.confirmPassword = "newpassword123"

        // When
        await viewModel.submit(email: "john@doe.com")

        // Then
        #expect(viewModel.errorMessage == "Le mot de passe actuel est requis")
        #expect(!viewModel.isCompleted)
    }

    @Test func submit_whenCurrentPasswordIsWrong_setsSpecificErrorFromClassification() async {
        // Given
        let viewModel = ChangePasswordViewModel(
            dependencies: ChangePasswordDependencies(
                verifyPassword: { _, _ in throw APIError.invalidCredentials },
                updatePassword: { _ in Issue.record("updatePassword should not be called") }
            )
        )
        viewModel.currentPassword = "wrong-password"
        viewModel.newPassword = "newpassword123"
        viewModel.confirmPassword = "newpassword123"

        // When
        await viewModel.submit(email: "john@doe.com")

        // Then
        #expect(viewModel.errorMessage == "Mot de passe actuel incorrect")
        #expect(!viewModel.isCompleted)
    }

    @Test func submit_whenPasswordUpdateFails_setsError() async {
        // Given
        let updateError = NSError(
            domain: "Test",
            code: 2,
            userInfo: [NSLocalizedDescriptionKey: "Network error"]
        )

        let viewModel = ChangePasswordViewModel(
            dependencies: ChangePasswordDependencies(
                verifyPassword: { _, _ in },
                updatePassword: { _ in throw updateError }
            )
        )
        viewModel.currentPassword = "current-password"
        viewModel.newPassword = "newpassword123"
        viewModel.confirmPassword = "newpassword123"

        // When
        await viewModel.submit(email: "john@doe.com")

        // Then
        #expect(viewModel.errorMessage != nil)
        #expect(!viewModel.isCompleted)
    }

    @Test func submit_whenVerificationAndUpdateSucceed_marksCompleted() async {
        // Given
        var verifyCallCount = 0
        var updateCallCount = 0

        let viewModel = ChangePasswordViewModel(
            dependencies: ChangePasswordDependencies(
                verifyPassword: { _, _ in verifyCallCount += 1 },
                updatePassword: { _ in updateCallCount += 1 }
            )
        )
        viewModel.currentPassword = "current-password"
        viewModel.newPassword = "newpassword123"
        viewModel.confirmPassword = "newpassword123"

        // When
        await viewModel.submit(email: "john@doe.com")

        // Then
        #expect(verifyCallCount == 1)
        #expect(updateCallCount == 1)
        #expect(viewModel.isCompleted)
        #expect(viewModel.errorMessage == nil)
    }
}
