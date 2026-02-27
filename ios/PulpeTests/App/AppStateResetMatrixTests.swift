import Foundation
@testable import Pulpe
import Testing

/// Parameterized tests verifying all auth reset scenarios produce the correct state transitions.
/// Acts as a safety net before any refactoring of cleanup methods.
@Suite(.serialized)
@MainActor
struct AppStateResetMatrixTests {
    // MARK: - Reset Scenarios

    enum ResetScenario: String, CaseIterable, CustomStringConvertible, Sendable {
        case userLogout
        case systemLogout
        case sessionExpiry
        case recoverySessionExpiry
        case passwordReset

        var description: String { rawValue }
    }

    // MARK: - UserDefaults Keys

    private static let manualBiometricRetryRequiredKey = "pulpe-manual-biometric-retry-required"

    init() {
        UserDefaults.standard.removeObject(forKey: Self.manualBiometricRetryRequiredKey)
    }

    // MARK: - Helpers

    private func executeReset(_ sut: AppState, scenario: ResetScenario) async {
        // Ensure authenticated first
        let user = UserInfo(id: "matrix-user", email: "matrix@pulpe.app", firstName: "Matrix")
        await sut.resolvePostAuth(user: user)

        switch scenario {
        case .userLogout:
            await sut.logout(source: .userInitiated)
        case .systemLogout:
            await sut.logout(source: .system)
        case .sessionExpiry:
            await sut.handleSessionExpired()
        case .recoverySessionExpiry:
            await sut.handleRecoverySessionExpired()
        case .passwordReset:
            await sut.completePasswordResetFlow()
        }
    }

    // MARK: - Core Reset (all scenarios)

    @Test(arguments: ResetScenario.allCases)
    func resetAlwaysClearsCore(_ scenario: ResetScenario) async {
        let sut = AppState(
            postAuthResolver: MockPostAuthResolver(destination: .authenticated(needsRecoveryKeyConsent: false)),
            biometricPreferenceStore: AppStateTestFactory.biometricDisabledStore(),
            biometricCapability: { false }
        )

        await executeReset(sut, scenario: scenario)

        #expect(sut.authState == .unauthenticated, "\(scenario): authState must be .unauthenticated")
        #expect(sut.currentUser == nil, "\(scenario): currentUser must be nil")
    }

    // MARK: - Navigation Reset

    @Test(arguments: [ResetScenario.userLogout, .systemLogout, .passwordReset])
    func resetClearsNavigation(_ scenario: ResetScenario) async {
        let sut = AppState(
            postAuthResolver: MockPostAuthResolver(destination: .authenticated(needsRecoveryKeyConsent: false)),
            biometricPreferenceStore: AppStateTestFactory.biometricDisabledStore(),
            biometricCapability: { false }
        )

        let user = UserInfo(id: "nav-user", email: "nav@pulpe.app", firstName: "Nav")
        await sut.resolvePostAuth(user: user)
        sut.selectedTab = .budgets
        sut.budgetPath.append("test-budget")

        await executeReset(sut, scenario: scenario)

        #expect(sut.budgetPath.isEmpty, "\(scenario): budgetPath must be empty")
        #expect(sut.selectedTab == .currentMonth, "\(scenario): selectedTab must be .currentMonth")
    }

    @Test(arguments: [ResetScenario.sessionExpiry, .recoverySessionExpiry])
    func resetPreservesNavigation(_ scenario: ResetScenario) async {
        let sut = AppState(
            postAuthResolver: MockPostAuthResolver(destination: .authenticated(needsRecoveryKeyConsent: false)),
            biometricPreferenceStore: AppStateTestFactory.biometricDisabledStore(),
            biometricCapability: { false }
        )

        let user = UserInfo(id: "nav-preserve", email: "navp@pulpe.app", firstName: "NavP")
        await sut.resolvePostAuth(user: user)
        sut.selectedTab = .budgets
        sut.budgetPath.append("keep-budget")

        await executeReset(sut, scenario: scenario)

        #expect(sut.selectedTab == .budgets, "\(scenario): selectedTab must be preserved")
        #expect(sut.budgetPath.count == 1, "\(scenario): budgetPath must be preserved")
    }

    // MARK: - showPostAuthError

    @Test(arguments: [ResetScenario.userLogout, .systemLogout])
    func resetClearsPostAuthError(_ scenario: ResetScenario) async {
        let sut = AppState(
            postAuthResolver: MockPostAuthResolver(destination: .authenticated(needsRecoveryKeyConsent: false)),
            biometricPreferenceStore: AppStateTestFactory.biometricDisabledStore(),
            biometricCapability: { false }
        )

        let user = UserInfo(id: "err-user", email: "err@pulpe.app", firstName: "Err")
        await sut.resolvePostAuth(user: user)
        sut.showPostAuthError = true

        await executeReset(sut, scenario: scenario)

        #expect(sut.showPostAuthError == false, "\(scenario): showPostAuthError must be cleared")
    }

    // MARK: - Manual Biometric Retry Flag

    @Test func sessionExpiry_resetsRecoveryFlowCoordinator() async {
        let sut = AppState(
            postAuthResolver: MockPostAuthResolver(destination: .authenticated(needsRecoveryKeyConsent: true)),
            biometricPreferenceStore: AppStateTestFactory.biometricDisabledStore(),
            biometricCapability: { false }
        )

        let user = UserInfo(id: "session-expiry", email: "session@pulpe.app", firstName: "Session")
        await sut.resolvePostAuth(user: user)

        #expect(sut.isRecoveryConsentVisible == true, "Recovery consent should be visible before session expiry")

        await sut.handleSessionExpired()

        #expect(sut.isRecoveryConsentVisible == false, "Recovery consent must be dismissed after session expiry")
    }

    @Test func recoverySessionExpiry_resetsRecoveryFlowCoordinator() async {
        let sut = AppState(
            postAuthResolver: MockPostAuthResolver(destination: .authenticated(needsRecoveryKeyConsent: true)),
            biometricPreferenceStore: AppStateTestFactory.biometricDisabledStore(),
            biometricCapability: { false }
        )

        let user = UserInfo(id: "recovery-user", email: "recovery@pulpe.app", firstName: "Recovery")
        await sut.resolvePostAuth(user: user)

        // Verify consent modal is visible before expiry
        #expect(sut.isRecoveryConsentVisible == true, "Recovery consent should be visible before expiry")

        await sut.handleRecoverySessionExpired()

        // Recovery flow coordinator must be reset - consent modal dismissed
        #expect(sut.isRecoveryConsentVisible == false, "Recovery consent must be dismissed after recoverySessionExpiry")
    }

    @Test func recoverySessionExpiry_setsManualBiometricRetry() async {
        let sut = AppState(
            postAuthResolver: MockPostAuthResolver(destination: .authenticated(needsRecoveryKeyConsent: false)),
            biometricPreferenceStore: AppStateTestFactory.biometricDisabledStore(),
            biometricCapability: { false }
        )

        let user = UserInfo(id: "retry-user", email: "retry@pulpe.app", firstName: "Retry")
        await sut.resolvePostAuth(user: user)

        await sut.handleRecoverySessionExpired()

        let flag = UserDefaults.standard.bool(forKey: Self.manualBiometricRetryRequiredKey)
        #expect(flag == true, "recoverySessionExpiry must set manualBiometricRetryRequired")
    }

    @Test(arguments: [ResetScenario.userLogout, .systemLogout, .sessionExpiry, .passwordReset])
    func otherResets_doNotSetManualBiometricRetry(_ scenario: ResetScenario) async {
        let sut = AppState(
            postAuthResolver: MockPostAuthResolver(destination: .authenticated(needsRecoveryKeyConsent: false)),
            biometricPreferenceStore: AppStateTestFactory.biometricDisabledStore(),
            biometricCapability: { false }
        )

        UserDefaults.standard.removeObject(forKey: Self.manualBiometricRetryRequiredKey)

        await executeReset(sut, scenario: scenario)

        let flag = UserDefaults.standard.bool(forKey: Self.manualBiometricRetryRequiredKey)
        #expect(flag == false, "\(scenario): must NOT set manualBiometricRetryRequired")
    }

    // MARK: - biometricError

    @Test(arguments: [ResetScenario.userLogout, .systemLogout, .passwordReset])
    func resetClearsBiometricError(_ scenario: ResetScenario) async {
        let sut = AppState(
            postAuthResolver: MockPostAuthResolver(destination: .authenticated(needsRecoveryKeyConsent: false)),
            biometricPreferenceStore: AppStateTestFactory.biometricDisabledStore(),
            biometricCapability: { false }
        )

        let user = UserInfo(id: "bio-err", email: "bioerr@pulpe.app", firstName: "BioErr")
        await sut.resolvePostAuth(user: user)
        sut.biometricError = "Some error"

        await executeReset(sut, scenario: scenario)

        #expect(sut.biometricError == nil, "\(scenario): biometricError must be nil")
    }

    @Test(arguments: [ResetScenario.sessionExpiry, .recoverySessionExpiry])
    func expirySetsBiometricError(_ scenario: ResetScenario) async {
        let sut = AppState(
            postAuthResolver: MockPostAuthResolver(destination: .authenticated(needsRecoveryKeyConsent: false)),
            biometricPreferenceStore: AppStateTestFactory.biometricDisabledStore(),
            biometricCapability: { false }
        )

        await executeReset(sut, scenario: scenario)

        #expect(sut.biometricError != nil, "\(scenario): biometricError must be set with expiry message")
    }

    // MARK: - Late Callback Guard (Race Condition)

    @Test func acceptRecoveryConsent_sessionExpiryDuringOperation_doesNotTransitionToAuthenticated() async {
        let operationStarted = AtomicFlag()
        let continueOperation = AtomicFlag()

        let sut = AppState(
            postAuthResolver: MockPostAuthResolver(destination: .authenticated(needsRecoveryKeyConsent: true)),
            biometricPreferenceStore: AppStateTestFactory.biometricDisabledStore(),
            biometricCapability: { false },
            setupRecoveryKey: {
                operationStarted.set()
                // Wait for session expiry to occur mid-operation
                while !continueOperation.value {
                    try await Task.sleep(for: .milliseconds(10))
                }
                return "GENERATED-KEY"
            }
        )

        let user = UserInfo(id: "late-callback", email: "late@pulpe.app", firstName: "Late")
        await sut.resolvePostAuth(user: user)
        #expect(sut.isRecoveryConsentVisible == true)

        // Start the consent acceptance in background
        let acceptTask = Task {
            await sut.acceptRecoveryKeyRepairConsent()
        }

        // Wait for operation to start
        await waitForCondition(timeout: .milliseconds(500), "operation must start") {
            operationStarted.value
        }

        // Session expires mid-operation
        await sut.handleSessionExpired()
        #expect(sut.authState == .unauthenticated)

        // Allow operation to complete
        continueOperation.set()
        await acceptTask.value

        // Critical: auth state must remain unauthenticated, not transition back to authenticated
        #expect(
            sut.authState == .unauthenticated,
            "Late callback must NOT transition to authenticated after session expiry"
        )
    }
}
