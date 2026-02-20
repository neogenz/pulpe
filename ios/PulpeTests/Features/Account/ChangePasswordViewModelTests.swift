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

        // Then - empty form
        #expect(!viewModel.canSubmit)

        // Too short (< 8 chars)
        viewModel.currentPassword = "current-password"
        viewModel.newPassword = "short1"
        viewModel.confirmPassword = "short1"
        #expect(!viewModel.canSubmit)
        
        // No numbers
        viewModel.newPassword = "longpassword"
        viewModel.confirmPassword = "longpassword"
        #expect(!viewModel.canSubmit)
        
        // No letters
        viewModel.newPassword = "12345678"
        viewModel.confirmPassword = "12345678"
        #expect(!viewModel.canSubmit)
        
        // Valid password format but mismatch
        viewModel.newPassword = "password123"
        viewModel.confirmPassword = "password456"
        #expect(!viewModel.canSubmit)
    }
    
    @Test func canSubmit_whenFormIsValid_returnsTrue() {
        // Given
        let viewModel = ChangePasswordViewModel(
            dependencies: ChangePasswordDependencies(
                verifyPassword: { _, _ in },
                updatePassword: { _ in }
            )
        )
        
        viewModel.currentPassword = "current-password"
        viewModel.newPassword = "newpassword123"
        viewModel.confirmPassword = "newpassword123"
        
        // Then
        #expect(viewModel.canSubmit)
    }
    
    @Test func passwordValidation_checksRequirements() {
        // Given
        let viewModel = ChangePasswordViewModel(
            dependencies: ChangePasswordDependencies(
                verifyPassword: { _, _ in },
                updatePassword: { _ in }
            )
        )
        
        // Empty password
        viewModel.newPassword = ""
        #expect(!viewModel.hasLetter)
        #expect(!viewModel.hasNumber)
        #expect(!viewModel.isNewPasswordValid)
        
        // Only letters
        viewModel.newPassword = "abcdefgh"
        #expect(viewModel.hasLetter)
        #expect(!viewModel.hasNumber)
        #expect(!viewModel.isNewPasswordValid)
        
        // Only numbers
        viewModel.newPassword = "12345678"
        #expect(!viewModel.hasLetter)
        #expect(viewModel.hasNumber)
        #expect(!viewModel.isNewPasswordValid)
        
        // Letters + numbers but too short
        viewModel.newPassword = "abc123"
        #expect(viewModel.hasLetter)
        #expect(viewModel.hasNumber)
        #expect(!viewModel.isNewPasswordValid)
        
        // Valid: 8+ chars with letters and numbers
        viewModel.newPassword = "password123"
        #expect(viewModel.hasLetter)
        #expect(viewModel.hasNumber)
        #expect(viewModel.isNewPasswordValid)
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
