import Foundation
import Testing
@testable import Pulpe

struct BiometricPreferencePersistenceTests {
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
