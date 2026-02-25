import Foundation
@testable import Pulpe
import Testing

// swiftlint:disable type_body_length
@Suite(.serialized)
@MainActor
struct SessionLifecycleCoordinatorTests {
    private let testUser = UserInfo(id: "slc-user", email: "slc@pulpe.app", firstName: "SLC")

    // MARK: - SUT Factory

    private func makeSUT(
        biometricEnabled: Bool = false,
        resolveKey: (@Sendable () async -> String?)? = nil,
        validateKey: (@Sendable (String) async -> Bool)? = nil,
        validateRegularSession: (@Sendable () async throws -> UserInfo?)? = nil,
        validateBiometricSession: (@Sendable () async throws -> BiometricSessionResult?)? = nil,
        nowProvider: @escaping () -> Date = Date.init
    ) -> SessionLifecycleCoordinator {
        let biometric = makeBiometricManager(
            biometricEnabled: biometricEnabled,
            resolveKey: resolveKey,
            validateKey: validateKey
        )
        return SessionLifecycleCoordinator(
            biometric: biometric,
            clientKeyManager: .shared,
            validateRegularSession: validateRegularSession ?? { nil },
            validateBiometricSession: validateBiometricSession ?? { nil },
            nowProvider: nowProvider
        )
    }

    private func makeBiometricManager(
        biometricEnabled: Bool,
        resolveKey: (@Sendable () async -> String?)?,
        validateKey: (@Sendable (String) async -> Bool)?
    ) -> BiometricManager {
        let biometric = BiometricManager(
            preferenceStore: BiometricPreferenceStore(
                keychain: StubBiometricKeychain(initial: biometricEnabled),
                defaults: StubBiometricDefaults(initial: false)
            ),
            authService: .shared,
            clientKeyManager: .shared,
            capability: { true },
            authenticate: { },
            syncCredentials: { true },
            resolveKey: resolveKey ?? { nil },
            validateKey: validateKey ?? { _ in true }
        )
        biometric.hydrate(biometricEnabled)
        return biometric
    }

    // MARK: - Cold Start: Biometric Session Validation
    @Test("Biometric session valid returns biometricAuthenticated")
    func biometricValid_returnsBiometricAuthenticated() async {
        let sut = makeSUT(
            validateBiometricSession: { [testUser] in
                BiometricSessionResult(user: testUser, clientKeyHex: nil)
            }
        )

        let result = await sut.attemptBiometricSessionValidation()

        if case .biometricAuthenticated(let user, _) = result {
            #expect(user.id == testUser.id)
        } else {
            Issue.record("Expected .biometricAuthenticated, got \(result)")
        }
    }
    @Test("Biometric session nil falls back to regular session")
    func biometricNil_fallsBackToRegular() async {
        let sut = makeSUT(
            validateRegularSession: { [testUser] in testUser },
            validateBiometricSession: { nil }
        )

        let result = await sut.attemptBiometricSessionValidation()

        if case .regularSession(let user) = result {
            #expect(user.id == testUser.id)
        } else {
            Issue.record("Expected .regularSession, got \(result)")
        }
    }
    @Test("Biometric session nil and no regular session returns unauthenticated")
    func biometricNil_noRegular_returnsUnauthenticated() async {
        let sut = makeSUT(
            validateRegularSession: { nil },
            validateBiometricSession: { nil }
        )

        let result = await sut.attemptBiometricSessionValidation()

        #expect(result == .unauthenticated)
    }
    @Test("Keychain error falls back to regular session")
    func keychainError_fallsBackToRegular() async {
        let sut = makeSUT(
            validateRegularSession: { [testUser] in testUser },
            validateBiometricSession: { throw KeychainError.userCanceled }
        )

        let result = await sut.attemptBiometricSessionValidation()

        if case .regularSession(let user) = result {
            #expect(user.id == testUser.id)
        } else {
            Issue.record("Expected .regularSession, got \(result)")
        }
    }
    @Test("Network error returns networkError with message")
    func networkError_returnsNetworkError() async {
        let sut = makeSUT(
            validateBiometricSession: { throw URLError(.notConnectedToInternet) }
        )

        let result = await sut.attemptBiometricSessionValidation()

        if case .networkError(let message) = result {
            #expect(message.contains("Connexion impossible"))
        } else {
            Issue.record("Expected .networkError, got \(result)")
        }
    }
    @Test("AuthServiceError returns biometricSessionExpired")
    func authServiceError_returnsBiometricSessionExpired() async {
        let sut = makeSUT(
            validateBiometricSession: { throw AuthServiceError.biometricSessionExpired }
        )

        let result = await sut.attemptBiometricSessionValidation()

        #expect(result == .biometricSessionExpired)
    }
    @Test("Unknown error returns biometricSessionExpired")
    func unknownError_returnsBiometricSessionExpired() async {
        struct TestError: Error {}
        let sut = makeSUT(
            validateBiometricSession: { throw TestError() }
        )

        let result = await sut.attemptBiometricSessionValidation()

        #expect(result == .biometricSessionExpired)
    }
    @Test("Regular session fallback error returns unauthenticated")
    func regularFallback_throws_returnsUnauthenticated() async {
        struct TestError: Error {}
        let sut = makeSUT(
            validateRegularSession: { throw TestError() },
            validateBiometricSession: { nil }
        )

        let result = await sut.attemptBiometricSessionValidation()

        #expect(result == .unauthenticated)
    }

    // MARK: - Cold Start: Regular Session Validation
    @Test("Regular session valid returns regularSession")
    func regularValid_returnsRegularSession() async {
        let sut = makeSUT(
            validateRegularSession: { [testUser] in testUser }
        )

        let result = await sut.attemptRegularSessionValidation()

        if case .regularSession(let user) = result {
            #expect(user.id == testUser.id)
        } else {
            Issue.record("Expected .regularSession, got \(result)")
        }
    }
    @Test("Regular session nil returns unauthenticated")
    func regularNil_returnsUnauthenticated() async {
        let sut = makeSUT(
            validateRegularSession: { nil }
        )

        let result = await sut.attemptRegularSessionValidation()

        #expect(result == .unauthenticated)
    }
    @Test("Regular session throws returns unauthenticated")
    func regularThrows_returnsUnauthenticated() async {
        struct TestError: Error {}
        let sut = makeSUT(
            validateRegularSession: { throw TestError() }
        )

        let result = await sut.attemptRegularSessionValidation()

        #expect(result == .unauthenticated)
    }

    // MARK: - Background Lock: handleEnterBackground
    @Test("handleEnterBackground records date")
    func handleEnterBackground_recordsDate() {
        let fixedDate = Date(timeIntervalSince1970: 100)
        let sut = makeSUT(nowProvider: { fixedDate })

        sut.handleEnterBackground()

        #expect(sut.isBackgroundLockRequired == false) // No time elapsed yet
    }

    // MARK: - Background Lock: isBackgroundLockRequired
    @Test("isBackgroundLockRequired false when no background date")
    func isBackgroundLockRequired_noDate_false() {
        let sut = makeSUT()

        #expect(sut.isBackgroundLockRequired == false)
    }
    @Test("isBackgroundLockRequired false before grace period")
    func isBackgroundLockRequired_beforeGrace_false() {
        var now = Date(timeIntervalSince1970: 0)
        let sut = makeSUT(nowProvider: { now })

        sut.handleEnterBackground()
        now = Date(timeIntervalSince1970: 29)

        #expect(sut.isBackgroundLockRequired == false)
    }
    @Test("isBackgroundLockRequired true at grace period")
    func isBackgroundLockRequired_atGrace_true() {
        var now = Date(timeIntervalSince1970: 0)
        let sut = makeSUT(nowProvider: { now })

        sut.handleEnterBackground()
        now = Date(timeIntervalSince1970: 30)

        #expect(sut.isBackgroundLockRequired == true)
    }
    @Test("isBackgroundLockRequired true after grace period")
    func isBackgroundLockRequired_afterGrace_true() {
        var now = Date(timeIntervalSince1970: 0)
        let sut = makeSUT(nowProvider: { now })

        sut.handleEnterBackground()
        now = Date(timeIntervalSince1970: 60)

        #expect(sut.isBackgroundLockRequired == true)
    }

    // MARK: - Background Lock: prepareForForeground
    @Test("prepareForForeground within grace does not set isRestoringSession")
    func prepareForForeground_withinGrace_noRestore() {
        var now = Date(timeIntervalSince1970: 0)
        let sut = makeSUT(nowProvider: { now })

        sut.handleEnterBackground()
        now = Date(timeIntervalSince1970: 10)
        sut.prepareForForeground(authState: .authenticated)

        #expect(sut.isRestoringSession == false)
    }
    @Test("prepareForForeground beyond grace sets isRestoringSession")
    func prepareForForeground_beyondGrace_setsRestore() {
        var now = Date(timeIntervalSince1970: 0)
        let sut = makeSUT(nowProvider: { now })

        sut.handleEnterBackground()
        now = Date(timeIntervalSince1970: 31)
        sut.prepareForForeground(authState: .authenticated)

        #expect(sut.isRestoringSession == true)
    }
    @Test("prepareForForeground does not set restore when not authenticated")
    func prepareForForeground_notAuthenticated_noRestore() {
        var now = Date(timeIntervalSince1970: 0)
        let sut = makeSUT(nowProvider: { now })

        sut.handleEnterBackground()
        now = Date(timeIntervalSince1970: 31)
        sut.prepareForForeground(authState: .unauthenticated)

        #expect(sut.isRestoringSession == false)
    }

    // MARK: - Background Lock: clearRestoringSession
    @Test("clearRestoringSession resets flag")
    func clearRestoringSession_resetsFlag() {
        var now = Date(timeIntervalSince1970: 0)
        let sut = makeSUT(nowProvider: { now })

        sut.handleEnterBackground()
        now = Date(timeIntervalSince1970: 31)
        sut.prepareForForeground(authState: .authenticated)
        #expect(sut.isRestoringSession == true)

        sut.clearRestoringSession()

        #expect(sut.isRestoringSession == false)
    }

    // MARK: - Foreground: handleEnterForeground
    @Test("handleEnterForeground within grace returns noLockNeeded")
    func handleEnterForeground_withinGrace_noLock() async {
        var now = Date(timeIntervalSince1970: 0)
        let sut = makeSUT(nowProvider: { now })

        sut.handleEnterBackground()
        now = Date(timeIntervalSince1970: 15)

        let result = await sut.handleEnterForeground(authState: .authenticated)

        #expect(result == .noLockNeeded)
    }
    @Test("handleEnterForeground when not authenticated returns noLockNeeded")
    func handleEnterForeground_notAuthenticated_noLock() async {
        var now = Date(timeIntervalSince1970: 0)
        let sut = makeSUT(nowProvider: { now })

        sut.handleEnterBackground()
        now = Date(timeIntervalSince1970: 60)

        let result = await sut.handleEnterForeground(authState: .loading)

        #expect(result == .noLockNeeded)
    }
    @Test("handleEnterForeground beyond grace with biometric disabled returns lockRequired")
    func handleEnterForeground_beyondGrace_biometricDisabled_lockRequired() async {
        var now = Date(timeIntervalSince1970: 0)
        let sut = makeSUT(nowProvider: { now })

        sut.handleEnterBackground()
        now = Date(timeIntervalSince1970: 31)

        let result = await sut.handleEnterForeground(authState: .authenticated)

        #expect(result == .lockRequired)
    }
    @Test("handleEnterForeground beyond grace with biometric success returns biometricUnlockSuccess")
    func handleEnterForeground_beyondGrace_biometricSuccess_unlockSuccess() async {
        var now = Date(timeIntervalSince1970: 0)
        let sut = makeSUT(
            biometricEnabled: true,
            resolveKey: { "valid-key" },
            validateKey: { _ in true },
            nowProvider: { now }
        )

        sut.handleEnterBackground()
        now = Date(timeIntervalSince1970: 31)

        let result = await sut.handleEnterForeground(authState: .authenticated)

        #expect(result == .biometricUnlockSuccess)
    }
    @Test("handleEnterForeground beyond grace with biometric resolveKey nil returns lockRequired")
    func handleEnterForeground_beyondGrace_biometricResolveNil_lockRequired() async {
        var now = Date(timeIntervalSince1970: 0)
        let sut = makeSUT(
            biometricEnabled: true,
            resolveKey: { nil },
            nowProvider: { now }
        )

        sut.handleEnterBackground()
        now = Date(timeIntervalSince1970: 31)

        let result = await sut.handleEnterForeground(authState: .authenticated)

        #expect(result == .lockRequired)
    }
    @Test("handleEnterForeground beyond grace with stale key returns staleKeyLockRequired")
    func handleEnterForeground_beyondGrace_staleKey_staleKeyLockRequired() async {
        var now = Date(timeIntervalSince1970: 0)
        let sut = makeSUT(
            biometricEnabled: true,
            resolveKey: { "stale-key" },
            validateKey: { _ in false },
            nowProvider: { now }
        )

        sut.handleEnterBackground()
        now = Date(timeIntervalSince1970: 31)

        let result = await sut.handleEnterForeground(authState: .authenticated)

        #expect(result == .staleKeyLockRequired)
    }

    // MARK: - Edge Cases
    @Test("Rapid background/foreground within grace always returns noLockNeeded")
    func rapidTransitions_withinGrace_noLock() async {
        var now = Date(timeIntervalSince1970: 0)
        let sut = makeSUT(nowProvider: { now })

        for _ in 1...10 {
            sut.handleEnterBackground()
            now = now.addingTimeInterval(5)
            let result = await sut.handleEnterForeground(authState: .authenticated)
            #expect(result == .noLockNeeded)
        }
    }
    @Test("Background date resets on each handleEnterBackground")
    func handleEnterBackground_resetsTimer() {
        var now = Date(timeIntervalSince1970: 0)
        let sut = makeSUT(nowProvider: { now })

        sut.handleEnterBackground()
        now = now.addingTimeInterval(10)
        sut.handleEnterBackground() // Reset timer
        now = now.addingTimeInterval(25) // 25s from last background (within grace)

        #expect(sut.isBackgroundLockRequired == false)
    }
    @Test("handleEnterForeground clears background date")
    func handleEnterForeground_clearsBackgroundDate() async {
        var now = Date(timeIntervalSince1970: 0)
        let sut = makeSUT(nowProvider: { now })

        sut.handleEnterBackground()
        now = Date(timeIntervalSince1970: 31)

        _ = await sut.handleEnterForeground(authState: .authenticated)

        // After foreground, background date is cleared — isBackgroundLockRequired should be false
        #expect(sut.isBackgroundLockRequired == false)
    }
}

// MARK: - ColdStartResult Equatable Conformance (for test assertions)

extension SessionLifecycleCoordinator.ColdStartResult: @retroactive Equatable {
    public static func == (lhs: Self, rhs: Self) -> Bool {
        switch (lhs, rhs) {
        case (.unauthenticated, .unauthenticated),
             (.biometricSessionExpired, .biometricSessionExpired):
            return true
        case (.biometricAuthenticated(let lUser, let lKey), .biometricAuthenticated(let rUser, let rKey)):
            return lUser == rUser && lKey == rKey
        case (.regularSession(let lUser), .regularSession(let rUser)):
            return lUser == rUser
        case (.networkError(let lMsg), .networkError(let rMsg)):
            return lMsg == rMsg
        default:
            return false
        }
    }
}

extension SessionLifecycleCoordinator.ForegroundResult: @retroactive Equatable {}
