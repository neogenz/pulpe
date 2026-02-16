import XCTest
@testable import Pulpe

@MainActor
final class ForgotPasswordViewModelTests: XCTestCase {

    func testSubmit_withInvalidEmail_setsValidationError() async {
        // Given
        let viewModel = ForgotPasswordViewModel(
            dependencies: ForgotPasswordDependencies(
                requestPasswordReset: { _ in
                    XCTFail("requestPasswordReset should not be called for invalid email")
                }
            )
        )
        viewModel.email = "invalid-email"

        // When
        await viewModel.submit()

        // Then
        XCTAssertEqual(viewModel.errorMessage, "Cette adresse email ne semble pas valide")
        XCTAssertFalse(viewModel.isSuccess)
    }

    func testSubmit_whenAPIThrows_setsErrorAndKeepsFailureState() async {
        // Given
        let expectedError = NSError(domain: "Test", code: 1)
        let viewModel = ForgotPasswordViewModel(
            dependencies: ForgotPasswordDependencies(
                requestPasswordReset: { _ in
                    throw expectedError
                }
            )
        )
        viewModel.email = "john@doe.com"

        // When
        await viewModel.submit()

        // Then
        XCTAssertFalse(viewModel.isSuccess)
        XCTAssertNotNil(viewModel.errorMessage)
        XCTAssertFalse(viewModel.isSubmitting)
    }

    func testSubmit_whenSuccess_setsSuccessState() async {
        // Given
        var requestedEmail: String?
        let viewModel = ForgotPasswordViewModel(
            dependencies: ForgotPasswordDependencies(
                requestPasswordReset: { email in
                    requestedEmail = email
                }
            )
        )
        viewModel.email = "john@doe.com"

        // When
        await viewModel.submit()

        // Then
        XCTAssertEqual(requestedEmail, "john@doe.com")
        XCTAssertTrue(viewModel.isSuccess)
        XCTAssertNil(viewModel.errorMessage)
        XCTAssertFalse(viewModel.isSubmitting)
    }
}
