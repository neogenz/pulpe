import XCTest
@testable import Pulpe

@MainActor
final class ChangePasswordViewModelTests: XCTestCase {

    func testCanSubmit_whenFormIsInvalid_returnsFalse() {
        // Given
        let viewModel = ChangePasswordViewModel(
            dependencies: ChangePasswordDependencies(
                verifyPassword: { _, _ in },
                updatePassword: { _ in }
            )
        )

        // Then
        XCTAssertFalse(viewModel.canSubmit)

        viewModel.currentPassword = "current-password"
        viewModel.newPassword = "short"
        viewModel.confirmPassword = "short"
        XCTAssertFalse(viewModel.canSubmit)
    }

    func testSubmit_whenFormIsInvalid_setsValidationError() async {
        // Given
        let viewModel = ChangePasswordViewModel(
            dependencies: ChangePasswordDependencies(
                verifyPassword: { _, _ in XCTFail("verifyPassword should not be called") },
                updatePassword: { _ in XCTFail("updatePassword should not be called") }
            )
        )
        viewModel.currentPassword = ""
        viewModel.newPassword = "newpassword123"
        viewModel.confirmPassword = "newpassword123"

        // When
        await viewModel.submit(email: "john@doe.com")

        // Then
        XCTAssertEqual(viewModel.errorMessage, "Le mot de passe actuel est requis")
        XCTAssertFalse(viewModel.isCompleted)
    }

    func testSubmit_whenCurrentPasswordIsWrong_setsSpecificErrorFromClassification() async {
        // Given
        let viewModel = ChangePasswordViewModel(
            dependencies: ChangePasswordDependencies(
                verifyPassword: { _, _ in throw APIError.invalidCredentials },
                updatePassword: { _ in XCTFail("updatePassword should not be called") }
            )
        )
        viewModel.currentPassword = "wrong-password"
        viewModel.newPassword = "newpassword123"
        viewModel.confirmPassword = "newpassword123"

        // When
        await viewModel.submit(email: "john@doe.com")

        // Then
        XCTAssertEqual(viewModel.errorMessage, "Mot de passe actuel incorrect")
        XCTAssertFalse(viewModel.isCompleted)
    }

    func testSubmit_whenPasswordUpdateFails_setsError() async {
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
        XCTAssertNotNil(viewModel.errorMessage)
        XCTAssertFalse(viewModel.isCompleted)
    }

    func testSubmit_whenVerificationAndUpdateSucceed_marksCompleted() async {
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
        XCTAssertEqual(verifyCallCount, 1)
        XCTAssertEqual(updateCallCount, 1)
        XCTAssertTrue(viewModel.isCompleted)
        XCTAssertNil(viewModel.errorMessage)
    }
}
