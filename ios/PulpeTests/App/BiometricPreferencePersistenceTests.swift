import Foundation
@testable import Pulpe
import Testing

struct BiometricPreferencePersistenceTests {
    @MainActor
    @Test("keychain credentials make biometric action available after preference hydration")
    func availableCredentialsAreHydrated() async {
        let sut = makeBiometricManager(credentialsAvailable: true)

        #expect(sut.credentialsAvailable == false)
        await sut.loadPreference()

        #expect(sut.isEnabled == true)
        #expect(sut.credentialsAvailable == true)
    }

    @MainActor
    @Test("session expiry during hydration cannot restore stale biometric credentials")
    func sessionExpiryDuringHydration_keepsCredentialsUnavailable() async {
        let pending = AtomicProperty<CheckedContinuation<Bool, Never>?>(nil)
        let sut = makeBiometricManager(credentialsAvailability: {
            await withCheckedContinuation { pending.set($0) }
        })
        let hydration = Task { await sut.loadPreference() }
        await waitForCondition("hydration must reach the credentialsAvailability continuation") { pending.value != nil }

        await sut.handleSessionExpired()
        pending.value?.resume(returning: true)
        await hydration.value

        #expect(sut.credentialsAvailable == false)
        #expect(
            sut.isEnabled == true,
            "Session expiry only invalidates credentials — the stored preference must still hydrate"
        )
    }

    @Test("keychain preference is used first when available")
    func keychainFirst_whenPreferenceExists() async {
        let keychain = StubBiometricPreferenceKeychain(initial: true)
        let defaults = StubBiometricPreferenceDefaults(initial: false)
        let sut = BiometricPreferenceStore(keychain: keychain, defaults: defaults)

        let value = await sut.load()

        #expect(value == true)
        #expect(await defaults.readCount == 0)
    }

    @Test("legacy UserDefaults value migrates to keychain once")
    func migratesLegacyUserDefaultsToKeychain() async {
        let keychain = StubBiometricPreferenceKeychain(initial: nil)
        let defaults = StubBiometricPreferenceDefaults(initial: true)
        let sut = BiometricPreferenceStore(keychain: keychain, defaults: defaults)

        let value = await sut.load()

        #expect(value == true)
        #expect(await keychain.savedValues == [true])
        #expect(await defaults.removeCount == 1)
    }

    @Test("missing preference defaults to false")
    func missingPreference_defaultsToFalse() async {
        let keychain = StubBiometricPreferenceKeychain(initial: nil)
        let defaults = StubBiometricPreferenceDefaults(initial: false)
        let sut = BiometricPreferenceStore(keychain: keychain, defaults: defaults)

        let value = await sut.load()

        #expect(value == false)
    }

    @Test("save persists to keychain")
    func savePersistsToKeychain() async {
        let keychain = StubBiometricPreferenceKeychain(initial: nil)
        let defaults = StubBiometricPreferenceDefaults(initial: false)
        let sut = BiometricPreferenceStore(keychain: keychain, defaults: defaults)

        await sut.save(true)
        await sut.save(false)

        #expect(await keychain.savedValues == [true, false])
    }

    @Test("concurrent load and save do not race")
    func concurrentLoadSave_noRace() async {
        let keychain = StubBiometricPreferenceKeychain(initial: nil)
        let defaults = StubBiometricPreferenceDefaults(initial: false)
        let sut = BiometricPreferenceStore(keychain: keychain, defaults: defaults)

        await withTaskGroup(of: Void.self) { group in
            for _ in 0..<10 {
                group.addTask { await sut.save(true) }
                group.addTask { _ = await sut.load() }
            }
        }

        // Verify no crash and all saves were recorded
        let savedValues = await keychain.savedValues
        #expect(savedValues.count == 10)
        #expect(savedValues.allSatisfy { $0 == true })
    }

    @MainActor
    private func makeBiometricManager(credentialsAvailable: Bool) -> BiometricManager {
        makeBiometricManager(credentialsAvailability: { credentialsAvailable })
    }

    @MainActor
    private func makeBiometricManager(
        credentialsAvailability: @escaping @Sendable () async -> Bool
    ) -> BiometricManager {
        BiometricManager(
            preferenceStore: BiometricPreferenceStore(
                keychain: StubBiometricPreferenceKeychain(initial: true),
                defaults: StubBiometricPreferenceDefaults(initial: false)
            ),
            authService: .shared,
            clientKeyManager: .shared,
            capability: { true },
            authenticate: {},
            syncCredentials: { true },
            resolveKey: { nil },
            validateKey: { _ in true },
            credentialsAvailability: credentialsAvailability
        )
    }
}

// MARK: - Stubs

private final actor StubBiometricPreferenceKeychain: BiometricPreferenceKeychainStoring {
    private var value: Bool?
    private(set) var savedValues: [Bool] = []

    init(initial: Bool?) {
        self.value = initial
    }

    func getBiometricEnabledPreference() async -> Bool? {
        value
    }

    func saveBiometricEnabledPreference(_ enabled: Bool) async {
        value = enabled
        savedValues.append(enabled)
    }
}

private final actor StubBiometricPreferenceDefaults: BiometricPreferenceDefaultsStoring {
    private var value: Bool
    private(set) var readCount = 0
    private(set) var removeCount = 0

    init(initial: Bool) {
        self.value = initial
    }

    func getLegacyBiometricEnabled() async -> Bool {
        readCount += 1
        return value
    }

    func removeLegacyBiometricEnabled() async {
        removeCount += 1
        value = false
    }
}
