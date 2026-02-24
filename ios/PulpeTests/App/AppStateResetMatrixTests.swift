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
}
