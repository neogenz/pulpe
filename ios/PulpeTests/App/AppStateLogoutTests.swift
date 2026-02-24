import Foundation
@testable import Pulpe
import Testing

/// Tests for `AppState.logout()` method to verify proper state reset.
/// Ensures all sensitive state is cleared and navigation is reset when user logs out.
@MainActor
@Suite(.serialized)
struct AppStateLogoutTests {
    // MARK: - Helpers

    private static func makeAuthenticatedSUT(
        destination: PostAuthDestination = .authenticated(needsRecoveryKeyConsent: false),
        biometricEnabled: Bool = false,
        biometricCapability: @escaping @Sendable () -> Bool = { false },
        syncBiometricCredentials: (@Sendable () async -> Bool)? = nil
    ) -> AppState {
        AppState(
            postAuthResolver: MockPostAuthResolver(destination: destination),
            biometricPreferenceStore: biometricEnabled
                ? AppStateTestFactory.biometricEnabledStore()
                : AppStateTestFactory.biometricDisabledStore(),
            biometricCapability: biometricCapability,
            syncBiometricCredentials: syncBiometricCredentials
        )
    }

    // MARK: - Basic Logout Tests

    @Test("logout sets authState to unauthenticated")
    func logout_setsAuthStateToUnauthenticated() async throws {
        let user = UserInfo(id: "user-1", email: "logout@pulpe.app", firstName: "Max")
        let sut = Self.makeAuthenticatedSUT()

        await sut.resolvePostAuth(user: user)
        try #require(sut.authState == .authenticated, "Setup: should start authenticated")

        await sut.logout()

        #expect(
            sut.authState == .unauthenticated,
            "authState must be set to unauthenticated after logout"
        )
    }

    @Test("logout clears currentUser")
    func logout_clearsCurrentUser() async throws {
        let user = UserInfo(id: "user-test-clear", email: "clear@pulpe.app", firstName: "Test")
        let sut = Self.makeAuthenticatedSUT()

        await sut.resolvePostAuth(user: user)
        try #require(sut.currentUser?.id == "user-test-clear", "Setup: user should be set")

        await sut.logout()

        #expect(
            sut.currentUser == nil,
            "currentUser must be cleared after logout"
        )
    }

    @Test("logout resets navigation state")
    func logout_resetsNavigationState() async throws {
        let user = UserInfo(id: "user-nav", email: "nav@pulpe.app", firstName: "Nav")
        let sut = Self.makeAuthenticatedSUT()

        await sut.resolvePostAuth(user: user)
        await sut.completePinEntry()

        sut.selectedTab = .budgets
        sut.budgetPath.append("budget-id-1")
        sut.templatePath.append("template-id-1")

        try #require(sut.selectedTab == .budgets, "Setup: tab should be budgets")
        try #require(sut.budgetPath.count == 1, "Setup: budgetPath should have 1 item")
        try #require(sut.templatePath.count == 1, "Setup: templatePath should have 1 item")

        await sut.logout()

        #expect(
            sut.selectedTab == .currentMonth,
            "selectedTab must be reset to .currentMonth after logout"
        )
        #expect(
            sut.budgetPath.isEmpty,
            "budgetPath must be empty after logout"
        )
        #expect(
            sut.templatePath.isEmpty,
            "templatePath must be empty after logout"
        )
    }

    @Test("logout clears biometric enrollment flag")
    func logout_clearsBiometricEnrollmentFlag() async throws {
        let user = UserInfo(id: "user-bio", email: "bio@pulpe.app", firstName: "Bio")
        let sut = Self.makeAuthenticatedSUT(
            biometricEnabled: true,
            biometricCapability: { true },
            syncBiometricCredentials: { true }
        )

        await sut.resolvePostAuth(user: user)
        await sut.completePinEntry()

        sut.showBiometricEnrollment = true
        try #require(sut.showBiometricEnrollment == true, "Setup: enrollment flag should be set")

        await sut.logout()

        #expect(
            sut.showBiometricEnrollment == false,
            "showBiometricEnrollment must be cleared after logout"
        )
    }

    @Test("logout clears recovery key repair consent flags")
    func logout_clearsRecoveryKeyRepairConsent() async throws {
        let user = UserInfo(id: "user-recovery", email: "recovery@pulpe.app", firstName: "Recovery")
        let sut = Self.makeAuthenticatedSUT(
            destination: .authenticated(needsRecoveryKeyConsent: true)
        )

        await sut.resolvePostAuth(user: user)

        try #require(sut.showRecoveryKeyRepairConsent == true, "Setup: consent flag should be set")
        try #require(sut.needsRecoveryKeyRepairConsent == true, "Setup: needs consent should be set")

        await sut.logout()

        #expect(
            sut.showRecoveryKeyRepairConsent == false,
            "showRecoveryKeyRepairConsent must be cleared after logout"
        )
        #expect(
            sut.needsRecoveryKeyRepairConsent == false,
            "needsRecoveryKeyRepairConsent must be cleared after logout"
        )
    }

    @Test("logout clears post-auth recovery key sheet and key")
    func logout_clearsPostAuthRecoveryKeyState() async throws {
        let user = UserInfo(id: "user-postauth", email: "postauth@pulpe.app", firstName: "PostAuth")
        let sut = Self.makeAuthenticatedSUT()

        await sut.resolvePostAuth(user: user)

        sut.showPostAuthRecoveryKeySheet = true
        try #require(sut.showPostAuthRecoveryKeySheet == true, "Setup: sheet flag should be set")

        await sut.logout()

        #expect(
            sut.showPostAuthRecoveryKeySheet == false,
            "showPostAuthRecoveryKeySheet must be cleared after logout"
        )
        #expect(
            sut.postAuthRecoveryKey == nil,
            "postAuthRecoveryKey must be cleared after logout"
        )
    }

    // MARK: - Logout with Biometric Disabled

    @Test("logout with biometric disabled clears all state")
    func logout_biometricDisabled_clearsAllState() async throws {
        let user = UserInfo(id: "user-bio-disabled", email: "biodis@pulpe.app", firstName: "BioDis")
        let sut = Self.makeAuthenticatedSUT()

        await sut.resolvePostAuth(user: user)
        await sut.completePinEntry()

        sut.selectedTab = .budgets
        sut.showBiometricEnrollment = false

        try #require(sut.biometricEnabled == false, "Setup: biometric should be disabled")

        await sut.logout()

        #expect(sut.authState == .unauthenticated)
        #expect(sut.currentUser == nil)
        #expect(sut.selectedTab == .currentMonth)
        #expect(sut.budgetPath.isEmpty)
    }

    // MARK: - Logout with Biometric Enabled

    @Test("logout with biometric enabled still clears state")
    func logout_biometricEnabled_clearsState() async throws {
        let user = UserInfo(id: "user-bio-enabled", email: "bioenabled@pulpe.app", firstName: "BioEnabled")
        let sut = Self.makeAuthenticatedSUT(
            biometricEnabled: true,
            biometricCapability: { true },
            syncBiometricCredentials: { true }
        )

        await waitForCondition(timeout: .milliseconds(500), "Biometric preference should load") {
            sut.biometricEnabled == true
        }

        await sut.resolvePostAuth(user: user)
        await sut.completePinEntry()

        try #require(sut.biometricEnabled == true, "Setup: biometric should be enabled")

        await sut.logout()

        #expect(sut.authState == .unauthenticated)
        #expect(sut.currentUser == nil)
        #expect(sut.selectedTab == .currentMonth)
        #expect(sut.budgetPath.isEmpty)
        #expect(sut.templatePath.isEmpty)
    }

    // MARK: - Transient Error State

    @Test("logout clears transient error state (showPostAuthError + biometricError)")
    func logout_clearsTransientErrorState() async throws {
        let user = UserInfo(id: "user-error", email: "error@pulpe.app", firstName: "Error")
        let sut = Self.makeAuthenticatedSUT()

        await sut.resolvePostAuth(user: user)
        await sut.completePinEntry()

        sut.showPostAuthError = true
        sut.biometricError = "Face ID failed"
        try #require(sut.showPostAuthError == true, "Setup: showPostAuthError should be set")
        try #require(sut.biometricError == "Face ID failed", "Setup: biometricError should be set")

        await sut.logout()

        #expect(
            sut.showPostAuthError == false,
            "showPostAuthError must be cleared after logout"
        )
        #expect(
            sut.biometricError == nil,
            "biometricError must be cleared after logout"
        )
    }

    // MARK: - Transitions from Other Auth States

    @Test("logout transitions from multiple auth states to unauthenticated")
    func logout_transitionsFromNeedsPinSetup() async throws {
        let sut = Self.makeAuthenticatedSUT(destination: .needsPinSetup)

        let user = UserInfo(id: "user-pin-setup", email: "pinsetup@pulpe.app", firstName: "PinSetup")
        await sut.resolvePostAuth(user: user)

        try #require(sut.authState == .needsPinSetup, "Setup: should be in needsPinSetup state")

        await sut.logout()

        #expect(sut.authState == .unauthenticated)
        #expect(sut.currentUser == nil)
    }
}
