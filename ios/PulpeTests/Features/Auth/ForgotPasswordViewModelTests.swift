import Foundation
import Testing
@testable import Pulpe

@MainActor
struct ForgotPasswordViewModelTests {

    @Test func submit_withInvalidEmail_setsValidationError() async {
        // Given
        let viewModel = ForgotPasswordViewModel(
            dependencies: ForgotPasswordDependencies(
                requestPasswordReset: { _ in
                    Issue.record("requestPasswordReset should not be called for invalid email")
                }
            )
        )
        viewModel.email = "invalid-email"

        // When
        await viewModel.submit()

        // Then
        #expect(viewModel.errorMessage == "Cette adresse email ne semble pas valide")
        #expect(!viewModel.isSuccess)
    }

    @Test func submit_whenAPIThrows_setsErrorAndKeepsFailureState() async {
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
        #expect(!viewModel.isSuccess)
        #expect(viewModel.errorMessage != nil)
        #expect(!viewModel.isSubmitting)
    }

    @Test func submit_whenSuccess_setsSuccessState() async {
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
        #expect(requestedEmail == "john@doe.com")
        #expect(viewModel.isSuccess)
        #expect(viewModel.errorMessage == nil)
        #expect(!viewModel.isSubmitting)
    }
}
