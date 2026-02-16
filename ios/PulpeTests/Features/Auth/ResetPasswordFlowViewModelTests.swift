import XCTest
@testable import Pulpe

@MainActor
final class ResetPasswordFlowViewModelTests: XCTestCase {

    private let callbackURL = URL(
        string: "pulpe://reset-password#access_token=test&refresh_token=test&type=recovery"
    )!

    func testPrepare_whenCallbackIsInvalid_setsInvalidLinkMessage() async {
        // Given
        let viewModel = ResetPasswordFlowViewModel(
            dependencies: ResetPasswordDependencies(
                beginPasswordRecovery: { _ in throw NSError(domain: "Test", code: 1) },
                getSalt: {
                    XCTFail("getSalt should not be called")
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
        XCTAssertFalse(viewModel.isPreparing)
        XCTAssertNotNil(viewModel.invalidLinkMessage)
        XCTAssertNil(viewModel.securityContextLoadFailureMessage)
        XCTAssertFalse(viewModel.shouldCleanupOnDismiss)
    }

    func testPrepare_whenSaltLoadFails_setsTechnicalErrorState() async {
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
        XCTAssertFalse(viewModel.isPreparing)
        XCTAssertNil(viewModel.invalidLinkMessage)
        XCTAssertNotNil(viewModel.securityContextLoadFailureMessage)
        XCTAssertTrue(viewModel.shouldCleanupOnDismiss)
    }

    func testSubmit_vaultCodeUser_updatesPasswordOnly() async {
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
        XCTAssertEqual(updateCallCount, 1)
        XCTAssertEqual(recoverCallCount, 0)
        XCTAssertTrue(viewModel.isCompleted)
        XCTAssertFalse(viewModel.showRecoveryKeySheet)
        XCTAssertFalse(viewModel.shouldCleanupOnDismiss)
    }

    func testSubmit_legacyUserWithRecoveryKey_whenSetupFails_setsRetryStateWithoutReplayingRecovery() async {
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
        XCTAssertEqual(updateCallCount, 1)
        XCTAssertEqual(recoverCallCount, 1)
        XCTAssertEqual(storeClientKeyCallCount, 1)
        XCTAssertEqual(setupRecoveryCallCount, 1)
        XCTAssertTrue(viewModel.needsRecoveryKeyGenerationRetry)
        XCTAssertFalse(viewModel.isCompleted)
        XCTAssertFalse(viewModel.showRecoveryKeySheet)
        XCTAssertTrue(viewModel.shouldCleanupOnDismiss)

        // When: retry setup only
        shouldFailSetup = false
        await viewModel.retryRecoveryKeyGeneration()

        // Then: no replay of update/recover, only setup retried
        XCTAssertEqual(updateCallCount, 1)
        XCTAssertEqual(recoverCallCount, 1)
        XCTAssertEqual(storeClientKeyCallCount, 1)
        XCTAssertEqual(setupRecoveryCallCount, 2)
        XCTAssertTrue(viewModel.showRecoveryKeySheet)
        XCTAssertFalse(viewModel.needsRecoveryKeyGenerationRetry)

        viewModel.acknowledgeRecoveryKeySaved()
        XCTAssertTrue(viewModel.isCompleted)
        XCTAssertFalse(viewModel.showRecoveryKeySheet)
        XCTAssertFalse(viewModel.shouldCleanupOnDismiss)
    }

    func testSubmit_legacyUserWithoutRecoveryKey_updatesPasswordOnly() async {
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
        XCTAssertEqual(updateCallCount, 1)
        XCTAssertEqual(recoverCallCount, 0)
        XCTAssertTrue(viewModel.isCompleted)
        XCTAssertFalse(viewModel.showRecoveryKeySheet)
        XCTAssertFalse(viewModel.shouldCleanupOnDismiss)
    }

    func testCleanupFlag_isActiveAfterRecoverySessionAndInactiveAfterCompletion() async {
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
        XCTAssertTrue(viewModel.shouldCleanupOnDismiss)

        // When: flow completes
        viewModel.newPassword = "newpassword123"
        viewModel.confirmPassword = "newpassword123"
        await viewModel.submit()

        // Then
        XCTAssertTrue(viewModel.isCompleted)
        XCTAssertFalse(viewModel.shouldCleanupOnDismiss)
    }

    func testInteractiveDismiss_afterRecoverySessionEstablished_triggersCleanup() async {
        // Given: recovery session has been established
        var cleanupCallCount = 0
        
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
        XCTAssertTrue(viewModel.shouldCleanupOnDismiss)
        
        // When: user interactively dismisses (simulated via onCancel callback)
        let onCancelCalled = expectation(description: "onCancel called")
        Task {
            // Simulate the view's onDisappear calling onCancel
            if viewModel.shouldCleanupOnDismiss {
                cleanupCallCount += 1
                onCancelCalled.fulfill()
            }
        }
        
        // Then: cleanup should be triggered
        await fulfillment(of: [onCancelCalled], timeout: 1.0)
        XCTAssertEqual(cleanupCallCount, 1)
    }

    func testInteractiveDismiss_afterSuccessfulCompletion_doesNotTriggerCleanup() async {
        // Given: recovery session completed successfully
        var cleanupCallCount = 0
        
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
        XCTAssertTrue(viewModel.isCompleted)
        XCTAssertFalse(viewModel.shouldCleanupOnDismiss)
        
        // When: view dismisses after completion
        if viewModel.shouldCleanupOnDismiss {
            cleanupCallCount += 1
        }
        
        // Then: cleanup should NOT be triggered
        XCTAssertEqual(cleanupCallCount, 0)
    }

    func testInteractiveDismiss_beforeRecoverySessionEstablished_doesNotTriggerCleanup() async {
        // Given: invalid link scenario (no recovery session established)
        var cleanupCallCount = 0

        let viewModel = ResetPasswordFlowViewModel(
            dependencies: ResetPasswordDependencies(
                beginPasswordRecovery: { _ in throw NSError(domain: "Test", code: 1) },
                getSalt: {
                    XCTFail("getSalt should not be called")
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
        XCTAssertFalse(viewModel.shouldCleanupOnDismiss)
        XCTAssertNotNil(viewModel.invalidLinkMessage)
        
        // When: view dismisses
        if viewModel.shouldCleanupOnDismiss {
            cleanupCallCount += 1
        }
        
        // Then: cleanup should NOT be triggered
        XCTAssertEqual(cleanupCallCount, 0)
    }
}
