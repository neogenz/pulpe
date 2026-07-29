import Foundation
@testable import Pulpe
import Testing

@Suite(.serialized)
@MainActor
struct SessionLifecycleCoordinatorTests {
    // MARK: - SUT Factory

    private func makeSUT(
        biometricEnabled: Bool = false,
        resolveKey: (@Sendable () async -> String?)? = nil,
        validateKey: (@Sendable (String) async -> Bool)? = nil,
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
            clientKeyManager: .shared,
            capability: { true },
            authenticate: { },
            resolveKey: resolveKey ?? { nil },
            validateKey: validateKey ?? { _ in true }
        )
        biometric.hydrate(biometricEnabled)
        return biometric
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
        nonisolated(unsafe) var now = Date(timeIntervalSince1970: 0)
        let sut = makeSUT(nowProvider: { now })

        sut.handleEnterBackground()
        now = Date(timeIntervalSince1970: 29)

        #expect(sut.isBackgroundLockRequired == false)
    }
    @Test("isBackgroundLockRequired true at grace period")
    func isBackgroundLockRequired_atGrace_true() {
        nonisolated(unsafe) var now = Date(timeIntervalSince1970: 0)
        let sut = makeSUT(nowProvider: { now })

        sut.handleEnterBackground()
        now = Date(timeIntervalSince1970: 30)

        #expect(sut.isBackgroundLockRequired == true)
    }
    @Test("isBackgroundLockRequired true after grace period")
    func isBackgroundLockRequired_afterGrace_true() {
        nonisolated(unsafe) var now = Date(timeIntervalSince1970: 0)
        let sut = makeSUT(nowProvider: { now })

        sut.handleEnterBackground()
        now = Date(timeIntervalSince1970: 60)

        #expect(sut.isBackgroundLockRequired == true)
    }

    // MARK: - Background Lock: prepareForForeground
    @Test("prepareForForeground within grace does not set isRestoringSession")
    func prepareForForeground_withinGrace_noRestore() {
        nonisolated(unsafe) var now = Date(timeIntervalSince1970: 0)
        let sut = makeSUT(nowProvider: { now })

        sut.handleEnterBackground()
        now = Date(timeIntervalSince1970: 10)
        sut.prepareForForeground(authState: .authenticated)

        #expect(sut.isRestoringSession == false)
    }
    @Test("prepareForForeground beyond grace sets isRestoringSession")
    func prepareForForeground_beyondGrace_setsRestore() {
        nonisolated(unsafe) var now = Date(timeIntervalSince1970: 0)
        let sut = makeSUT(nowProvider: { now })

        sut.handleEnterBackground()
        now = Date(timeIntervalSince1970: 31)
        sut.prepareForForeground(authState: .authenticated)

        #expect(sut.isRestoringSession == true)
    }
    @Test("prepareForForeground does not set restore when not authenticated")
    func prepareForForeground_notAuthenticated_noRestore() {
        nonisolated(unsafe) var now = Date(timeIntervalSince1970: 0)
        let sut = makeSUT(nowProvider: { now })

        sut.handleEnterBackground()
        now = Date(timeIntervalSince1970: 31)
        sut.prepareForForeground(authState: .unauthenticated)

        #expect(sut.isRestoringSession == false)
    }

    // MARK: - Background Lock: clearRestoringSession
    @Test("clearRestoringSession resets flag")
    func clearRestoringSession_resetsFlag() {
        nonisolated(unsafe) var now = Date(timeIntervalSince1970: 0)
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
        nonisolated(unsafe) var now = Date(timeIntervalSince1970: 0)
        let sut = makeSUT(nowProvider: { now })

        sut.handleEnterBackground()
        now = Date(timeIntervalSince1970: 15)

        let result = await sut.handleEnterForeground(authState: .authenticated)

        #expect(result == .noLockNeeded)
    }
    @Test("handleEnterForeground when not authenticated returns noLockNeeded")
    func handleEnterForeground_notAuthenticated_noLock() async {
        nonisolated(unsafe) var now = Date(timeIntervalSince1970: 0)
        let sut = makeSUT(nowProvider: { now })

        sut.handleEnterBackground()
        now = Date(timeIntervalSince1970: 60)

        let result = await sut.handleEnterForeground(authState: .loading)

        #expect(result == .noLockNeeded)
    }
    @Test("handleEnterForeground beyond grace with biometric disabled returns lockRequired")
    func handleEnterForeground_beyondGrace_biometricDisabled_lockRequired() async {
        nonisolated(unsafe) var now = Date(timeIntervalSince1970: 0)
        let sut = makeSUT(nowProvider: { now })

        sut.handleEnterBackground()
        now = Date(timeIntervalSince1970: 31)

        let result = await sut.handleEnterForeground(authState: .authenticated)

        #expect(result == .lockRequired)
    }
    @Test("handleEnterForeground beyond grace with biometric success returns biometricUnlockSuccess")
    func handleEnterForeground_beyondGrace_biometricSuccess_unlockSuccess() async {
        nonisolated(unsafe) var now = Date(timeIntervalSince1970: 0)
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
        nonisolated(unsafe) var now = Date(timeIntervalSince1970: 0)
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
        nonisolated(unsafe) var now = Date(timeIntervalSince1970: 0)
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
        nonisolated(unsafe) var now = Date(timeIntervalSince1970: 0)
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
        nonisolated(unsafe) var now = Date(timeIntervalSince1970: 0)
        let sut = makeSUT(nowProvider: { now })

        sut.handleEnterBackground()
        now = now.addingTimeInterval(10)
        sut.handleEnterBackground() // Reset timer
        now = now.addingTimeInterval(25) // 25s from last background (within grace)

        #expect(sut.isBackgroundLockRequired == false)
    }
    @Test("handleEnterForeground clears background date")
    func handleEnterForeground_clearsBackgroundDate() async {
        nonisolated(unsafe) var now = Date(timeIntervalSince1970: 0)
        let sut = makeSUT(nowProvider: { now })

        sut.handleEnterBackground()
        now = Date(timeIntervalSince1970: 31)

        _ = await sut.handleEnterForeground(authState: .authenticated)

        // After foreground, background date is cleared — isBackgroundLockRequired should be false
        #expect(sut.isBackgroundLockRequired == false)
    }
}
