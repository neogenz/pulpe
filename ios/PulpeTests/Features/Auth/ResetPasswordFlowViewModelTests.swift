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
                getSalt: {
                    Issue.record("getSalt should not be called")
                    return .init(salt: "", kdfIterations: 1, hasRecoveryKey: false)
                },
                updatePassword: { _ in },
                recoverEncryption: { _, _ in },
                setupRecoveryKey: { "unused" },
                deriveClientKey: { _, _, _ in "" },
                storeClientKey: { _ in }
            )
        )

        // When
        await viewModel.prepare(with: callbackURL)

        // Then
        #expect(!viewModel.isPreparing)
        #expect(viewModel.invalidLinkMessage != nil)
        #expect(viewModel.securityContextLoadFailureMessage == nil)
        #expect(!viewModel.shouldCleanupOnDismiss)
    }

    @Test func prepare_whenSaltLoadFails_setsTechnicalErrorState() async {
        // Given
        let context = PasswordRecoveryContext(
            userId: "user-1",
            email: "john@doe.com",
            firstName: nil,
            hasVaultCodeConfigured: false
        )

        let viewModel = ResetPasswordFlowViewModel(
            dependencies: ResetPasswordDependencies(
                beginPasswordRecovery: { _ in context },
                getSalt: { throw APIError.networkError(URLError(.timedOut)) },
                updatePassword: { _ in },
                recoverEncryption: { _, _ in },
                setupRecoveryKey: { "unused" },
                deriveClientKey: { _, _, _ in "" },
                storeClientKey: { _ in }
            )
        )

        // When
        await viewModel.prepare(with: callbackURL)

        // Then
        #expect(!viewModel.isPreparing)
        #expect(viewModel.invalidLinkMessage == nil)
        #expect(viewModel.securityContextLoadFailureMessage != nil)
        #expect(viewModel.shouldCleanupOnDismiss)
    }

    @Test func prepare_success_allowsSubmission() async {
        // Given
        let context = PasswordRecoveryContext(
            userId: "user-valid",
            email: "valid@test.com",
            firstName: nil,
            hasVaultCodeConfigured: false
        )

        let viewModel = ResetPasswordFlowViewModel(
            dependencies: ResetPasswordDependencies(
                beginPasswordRecovery: { _ in context },
                getSalt: { .init(salt: "abcd", kdfIterations: 600000, hasRecoveryKey: true) },
                updatePassword: { _ in },
                recoverEncryption: { _, _ in },
                setupRecoveryKey: { "ABCD-EFGH-IJKL-MNOP" },
                deriveClientKey: { _, _, _ in String(repeating: "ab", count: 32) },
                storeClientKey: { _ in }
            )
        )

        // When
        await viewModel.prepare(with: callbackURL)

        // Then
        #expect(!viewModel.isPreparing)
        #expect(viewModel.invalidLinkMessage == nil)
        #expect(viewModel.securityContextLoadFailureMessage == nil)
        #expect(viewModel.shouldCleanupOnDismiss)
        #expect(viewModel.requiresRecoveryKey)
    }

    @Test func submit_vaultCodeUser_updatesPasswordOnly() async {
        // Given
        var updateCallCount = 0
        var recoverCallCount = 0

        let context = PasswordRecoveryContext(
            userId: "user-vault",
            email: "vault@test.com",
            firstName: nil,
            hasVaultCodeConfigured: true
        )

        let viewModel = ResetPasswordFlowViewModel(
            dependencies: ResetPasswordDependencies(
                beginPasswordRecovery: { _ in context },
                getSalt: { .init(salt: "abcd", kdfIterations: 600000, hasRecoveryKey: true) },
                updatePassword: { _ in updateCallCount += 1 },
                recoverEncryption: { _, _ in recoverCallCount += 1 },
                setupRecoveryKey: { "unused" },
                deriveClientKey: { _, _, _ in String(repeating: "ab", count: 32) },
                storeClientKey: { _ in }
            )
        )

        await viewModel.prepare(with: callbackURL)
        viewModel.newPassword = "newpassword123"
        viewModel.confirmPassword = "newpassword123"

        // When
        await viewModel.submit()

        // Then
        #expect(updateCallCount == 1)
        #expect(recoverCallCount == 0)
        #expect(viewModel.isCompleted)
        #expect(!viewModel.showRecoveryKeySheet)
        #expect(!viewModel.shouldCleanupOnDismiss)
    }

    @Test func submit_mismatchedPasswordConfirmation_showsError() async {
        // Given
        let context = PasswordRecoveryContext(
            userId: "user-mismatch",
            email: "mismatch@test.com",
            firstName: nil,
            hasVaultCodeConfigured: true
        )

        let viewModel = ResetPasswordFlowViewModel(
            dependencies: ResetPasswordDependencies(
                beginPasswordRecovery: { _ in context },
                getSalt: { .init(salt: "abcd", kdfIterations: 600000, hasRecoveryKey: false) },
                updatePassword: { _ in Issue.record("updatePassword should not be called") },
                recoverEncryption: { _, _ in },
                setupRecoveryKey: { "unused" },
                deriveClientKey: { _, _, _ in String(repeating: "ab", count: 32) },
                storeClientKey: { _ in }
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

    @Test func submit_legacyUserWithRecoveryKey_whenSetupFails_setsRetryStateWithoutReplayingRecovery() async {
        // Given
        var updateCallCount = 0
        var recoverCallCount = 0
        var storeClientKeyCallCount = 0
        var setupRecoveryCallCount = 0
        var shouldFailSetup = true

        let context = PasswordRecoveryContext(
            userId: "user-legacy",
            email: "legacy@test.com",
            firstName: nil,
            hasVaultCodeConfigured: false
        )

        let viewModel = ResetPasswordFlowViewModel(
            dependencies: ResetPasswordDependencies(
                beginPasswordRecovery: { _ in context },
                getSalt: { .init(salt: "abcd", kdfIterations: 600000, hasRecoveryKey: true) },
                updatePassword: { _ in updateCallCount += 1 },
                recoverEncryption: { _, _ in recoverCallCount += 1 },
                setupRecoveryKey: {
                    setupRecoveryCallCount += 1
                    if shouldFailSetup {
                        throw APIError.networkError(URLError(.cannotConnectToHost))
                    }
                    return "ABCD-EFGH-IJKL-MNOP"
                },
                deriveClientKey: { _, _, _ in String(repeating: "ab", count: 32) },
                storeClientKey: { _ in storeClientKeyCallCount += 1 }
            )
        )

        await viewModel.prepare(with: callbackURL)
        viewModel.newPassword = "newpassword123"
        viewModel.confirmPassword = "newpassword123"
        viewModel.updateRecoveryKey(String(repeating: "A", count: 52))

        // When: first submit (setup recovery key fails)
        await viewModel.submit()

        // Then
        #expect(updateCallCount == 1)
        #expect(recoverCallCount == 1)
        #expect(storeClientKeyCallCount == 1)
        #expect(setupRecoveryCallCount == 1)
        #expect(viewModel.needsRecoveryKeyGenerationRetry)
        #expect(!viewModel.isCompleted)
        #expect(!viewModel.showRecoveryKeySheet)
        #expect(viewModel.shouldCleanupOnDismiss)

        // When: retry setup only
        shouldFailSetup = false
        await viewModel.retryRecoveryKeyGeneration()

        // Then: no replay of update/recover, only setup retried
        #expect(updateCallCount == 1)
        #expect(recoverCallCount == 1)
        #expect(storeClientKeyCallCount == 1)
        #expect(setupRecoveryCallCount == 2)
        #expect(viewModel.showRecoveryKeySheet)
        #expect(!viewModel.needsRecoveryKeyGenerationRetry)

        viewModel.acknowledgeRecoveryKeySaved()
        #expect(viewModel.isCompleted)
        #expect(!viewModel.showRecoveryKeySheet)
        #expect(!viewModel.shouldCleanupOnDismiss)
    }

    @Test func retryRecoveryKeyGeneration_networkError_showsErrorMessage() async {
        // Given
        var setupCallCount = 0

        let context = PasswordRecoveryContext(
            userId: "user-retry",
            email: "retry@test.com",
            firstName: nil,
            hasVaultCodeConfigured: false
        )

        let viewModel = ResetPasswordFlowViewModel(
            dependencies: ResetPasswordDependencies(
                beginPasswordRecovery: { _ in context },
                getSalt: { .init(salt: "abcd", kdfIterations: 600000, hasRecoveryKey: true) },
                updatePassword: { _ in },
                recoverEncryption: { _, _ in },
                setupRecoveryKey: {
                    setupCallCount += 1
                    throw APIError.networkError(URLError(.notConnectedToInternet))
                },
                deriveClientKey: { _, _, _ in String(repeating: "ab", count: 32) },
                storeClientKey: { _ in }
            )
        )

        await viewModel.prepare(with: callbackURL)
        viewModel.newPassword = "newpassword123"
        viewModel.confirmPassword = "newpassword123"
        viewModel.updateRecoveryKey(String(repeating: "A", count: 52))

        // When: first submit fails
        await viewModel.submit()
        #expect(viewModel.needsRecoveryKeyGenerationRetry)

        // When: retry also fails
        await viewModel.retryRecoveryKeyGeneration()

        // Then
        #expect(setupCallCount == 2)
        #expect(viewModel.needsRecoveryKeyGenerationRetry)
        #expect(viewModel.errorMessage != nil)
        #expect(!viewModel.isCompleted)
    }

    @Test func submit_legacyUserWithoutRecoveryKey_updatesPasswordOnly() async {
        // Given
        var updateCallCount = 0
        var recoverCallCount = 0

        let context = PasswordRecoveryContext(
            userId: "user-no-key",
            email: "legacy-no-key@test.com",
            firstName: nil,
            hasVaultCodeConfigured: false
        )

        let viewModel = ResetPasswordFlowViewModel(
            dependencies: ResetPasswordDependencies(
                beginPasswordRecovery: { _ in context },
                getSalt: { .init(salt: "abcd", kdfIterations: 600000, hasRecoveryKey: false) },
                updatePassword: { _ in updateCallCount += 1 },
                recoverEncryption: { _, _ in recoverCallCount += 1 },
                setupRecoveryKey: { "unused" },
                deriveClientKey: { _, _, _ in String(repeating: "ab", count: 32) },
                storeClientKey: { _ in }
            )
        )

        await viewModel.prepare(with: callbackURL)
        viewModel.newPassword = "newpassword123"
        viewModel.confirmPassword = "newpassword123"

        // When
        await viewModel.submit()

        // Then
        #expect(updateCallCount == 1)
        #expect(recoverCallCount == 0)
        #expect(viewModel.isCompleted)
        #expect(!viewModel.showRecoveryKeySheet)
        #expect(!viewModel.shouldCleanupOnDismiss)
    }

    @Test func cleanupFlag_isActiveAfterRecoverySessionAndInactiveAfterCompletion() async {
        // Given
        let context = PasswordRecoveryContext(
            userId: "user-cleanup",
            email: "cleanup@test.com",
            firstName: nil,
            hasVaultCodeConfigured: false
        )

        let viewModel = ResetPasswordFlowViewModel(
            dependencies: ResetPasswordDependencies(
                beginPasswordRecovery: { _ in context },
                getSalt: { .init(salt: "abcd", kdfIterations: 600000, hasRecoveryKey: false) },
                updatePassword: { _ in },
                recoverEncryption: { _, _ in },
                setupRecoveryKey: { "unused" },
                deriveClientKey: { _, _, _ in String(repeating: "ab", count: 32) },
                storeClientKey: { _ in }
            )
        )

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

    @Test func interactiveDismiss_afterRecoverySessionEstablished_triggersCleanup() async {
        // Given: recovery session has been established
        let context = PasswordRecoveryContext(
            userId: "user-dismiss",
            email: "dismiss@test.com",
            firstName: nil,
            hasVaultCodeConfigured: false
        )

        let viewModel = ResetPasswordFlowViewModel(
            dependencies: ResetPasswordDependencies(
                beginPasswordRecovery: { _ in context },
                getSalt: { .init(salt: "abcd", kdfIterations: 600000, hasRecoveryKey: false) },
                updatePassword: { _ in },
                recoverEncryption: { _, _ in },
                setupRecoveryKey: { "unused" },
                deriveClientKey: { _, _, _ in String(repeating: "ab", count: 32) },
                storeClientKey: { _ in }
            )
        )

        await viewModel.prepare(with: callbackURL)

        // Then: cleanup should be required
        #expect(viewModel.shouldCleanupOnDismiss)
    }

    @Test func interactiveDismiss_afterSuccessfulCompletion_doesNotTriggerCleanup() async {
        // Given: recovery session completed successfully
        let context = PasswordRecoveryContext(
            userId: "user-complete",
            email: "complete@test.com",
            firstName: nil,
            hasVaultCodeConfigured: false
        )

        let viewModel = ResetPasswordFlowViewModel(
            dependencies: ResetPasswordDependencies(
                beginPasswordRecovery: { _ in context },
                getSalt: { .init(salt: "abcd", kdfIterations: 600000, hasRecoveryKey: false) },
                updatePassword: { _ in },
                recoverEncryption: { _, _ in },
                setupRecoveryKey: { "unused" },
                deriveClientKey: { _, _, _ in String(repeating: "ab", count: 32) },
                storeClientKey: { _ in }
            )
        )

        await viewModel.prepare(with: callbackURL)
        viewModel.newPassword = "newpassword123"
        viewModel.confirmPassword = "newpassword123"
        await viewModel.submit()

        // Then: cleanup flag should be cleared after successful completion
        #expect(viewModel.isCompleted)
        #expect(!viewModel.shouldCleanupOnDismiss)
    }

    @Test func interactiveDismiss_beforeRecoverySessionEstablished_doesNotTriggerCleanup() async {
        // Given: invalid link scenario (no recovery session established)
        let viewModel = ResetPasswordFlowViewModel(
            dependencies: ResetPasswordDependencies(
                beginPasswordRecovery: { _ in throw NSError(domain: "Test", code: 1) },
                getSalt: {
                    Issue.record("getSalt should not be called")
                    return .init(salt: "", kdfIterations: 1, hasRecoveryKey: false)
                },
                updatePassword: { _ in },
                recoverEncryption: { _, _ in },
                setupRecoveryKey: { "unused" },
                deriveClientKey: { _, _, _ in "" },
                storeClientKey: { _ in }
            )
        )

        await viewModel.prepare(with: callbackURL)

        // Then: cleanup should NOT be required for invalid link
        #expect(!viewModel.shouldCleanupOnDismiss)
        #expect(viewModel.invalidLinkMessage != nil)
    }
}
