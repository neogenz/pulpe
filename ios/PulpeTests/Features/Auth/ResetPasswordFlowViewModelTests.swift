import Foundation
import Testing
@testable import Pulpe

@MainActor
struct ResetPasswordFlowViewModelTests {

    private let callbackURL = URL(
        string: "pulpe://reset-password#access_token=test&refresh_token=test&type=recovery"
    )!

    @Test func prepare_whenCallbackIsInvalid_setsInvalidLinkMessage() async {
        // Given
        let viewModel = ResetPasswordFlowViewModel(
            dependencies: ResetPasswordDependencies(
                beginPasswordRecovery: { _ in throw NSError(domain: "Test", code: 1) },
                updatePassword: { _ in }
            )
        )

        // When
        await viewModel.prepare(with: callbackURL)

        // Then
        #expect(!viewModel.isPreparing)
        #expect(viewModel.invalidLinkMessage != nil)
        #expect(!viewModel.shouldCleanupOnDismiss)
    }

    @Test func prepare_success_allowsSubmission() async {
        // Given
        let viewModel = makeViewModel()

        // When
        await viewModel.prepare(with: callbackURL)

        // Then
        #expect(!viewModel.isPreparing)
        #expect(viewModel.invalidLinkMessage == nil)
        #expect(viewModel.shouldCleanupOnDismiss)
    }

    @Test func submit_updatesPasswordAndCompletes() async {
        // Given
        var updateCallCount = 0

        let viewModel = ResetPasswordFlowViewModel(
            dependencies: ResetPasswordDependencies(
                beginPasswordRecovery: { _ in Self.testContext },
                updatePassword: { _ in updateCallCount += 1 }
            )
        )

        await viewModel.prepare(with: callbackURL)
        viewModel.newPassword = "newpassword123"
        viewModel.confirmPassword = "newpassword123"

        // When
        await viewModel.submit()

        // Then
        #expect(updateCallCount == 1)
        #expect(viewModel.isCompleted)
        #expect(!viewModel.shouldCleanupOnDismiss)
    }

    @Test func submit_mismatchedPasswordConfirmation_showsError() async {
        // Given
        let viewModel = ResetPasswordFlowViewModel(
            dependencies: ResetPasswordDependencies(
                beginPasswordRecovery: { _ in Self.testContext },
                updatePassword: { _ in Issue.record("updatePassword should not be called") }
            )
        )

        await viewModel.prepare(with: callbackURL)
        viewModel.newPassword = "newpassword123"
        viewModel.confirmPassword = "differentpassword"

        // When
        await viewModel.submit()

        // Then
        #expect(!viewModel.isCompleted)
        #expect(viewModel.errorMessage == "Les mots de passe ne correspondent pas")
    }

    @Test func submit_tooShortPassword_showsError() async {
        // Given
        let viewModel = makeViewModel()

        await viewModel.prepare(with: callbackURL)
        viewModel.newPassword = "short"
        viewModel.confirmPassword = "short"

        // When
        await viewModel.submit()

        // Then
        #expect(!viewModel.isCompleted)
        #expect(viewModel.errorMessage == "8 caractères minimum")
    }

    @Test func submit_networkError_showsConnectionError() async {
        // Given
        let viewModel = ResetPasswordFlowViewModel(
            dependencies: ResetPasswordDependencies(
                beginPasswordRecovery: { _ in Self.testContext },
                updatePassword: { _ in throw APIError.networkError(URLError(.notConnectedToInternet)) }
            )
        )

        await viewModel.prepare(with: callbackURL)
        viewModel.newPassword = "newpassword123"
        viewModel.confirmPassword = "newpassword123"

        // When
        await viewModel.submit()

        // Then
        #expect(!viewModel.isCompleted)
        #expect(viewModel.errorMessage == "Connexion impossible — vérifie ta connexion internet")
    }

    @Test func submit_rateLimited_showsRateLimitError() async {
        // Given
        let viewModel = ResetPasswordFlowViewModel(
            dependencies: ResetPasswordDependencies(
                beginPasswordRecovery: { _ in Self.testContext },
                updatePassword: { _ in throw APIError.rateLimited }
            )
        )

        await viewModel.prepare(with: callbackURL)
        viewModel.newPassword = "newpassword123"
        viewModel.confirmPassword = "newpassword123"

        // When
        await viewModel.submit()

        // Then
        #expect(!viewModel.isCompleted)
        #expect(viewModel.errorMessage == "Trop de tentatives — patiente un moment")
    }

    @Test func cleanupFlag_isActiveAfterRecoverySessionAndInactiveAfterCompletion() async {
        // Given
        let viewModel = makeViewModel()

        // When: prepare establishes recovery session
        await viewModel.prepare(with: callbackURL)

        // Then
        #expect(viewModel.shouldCleanupOnDismiss)

        // When: flow completes
        viewModel.newPassword = "newpassword123"
        viewModel.confirmPassword = "newpassword123"
        await viewModel.submit()

        // Then
        #expect(viewModel.isCompleted)
        #expect(!viewModel.shouldCleanupOnDismiss)
    }

    @Test func interactiveDismiss_beforeRecoverySessionEstablished_doesNotTriggerCleanup() async {
        // Given: invalid link scenario (no recovery session established)
        let viewModel = ResetPasswordFlowViewModel(
            dependencies: ResetPasswordDependencies(
                beginPasswordRecovery: { _ in throw NSError(domain: "Test", code: 1) },
                updatePassword: { _ in }
            )
        )

        await viewModel.prepare(with: callbackURL)

        // Then: cleanup should NOT be required for invalid link
        #expect(!viewModel.shouldCleanupOnDismiss)
        #expect(viewModel.invalidLinkMessage != nil)
    }

    @Test func canSubmit_isFalseWhilePreparing() async {
        // Given
        let viewModel = makeViewModel()
        viewModel.newPassword = "newpassword123"
        viewModel.confirmPassword = "newpassword123"

        // Then: still preparing (prepare not called)
        #expect(!viewModel.canSubmit)
    }

    @Test func canSubmit_isFalseWithEmptyFields() async {
        // Given
        let viewModel = makeViewModel()
        await viewModel.prepare(with: callbackURL)

        // Then
        #expect(!viewModel.canSubmit)
    }

    // MARK: - Helpers

    private static let testContext = PasswordRecoveryContext(
        userId: "user-1",
        email: "test@example.com",
        firstName: nil,
        hasVaultCodeConfigured: true
    )

    private func makeViewModel() -> ResetPasswordFlowViewModel {
        let context = Self.testContext
        return ResetPasswordFlowViewModel(
            dependencies: ResetPasswordDependencies(
                beginPasswordRecovery: { _ in context },
                updatePassword: { _ in }
            )
        )
    }
}
