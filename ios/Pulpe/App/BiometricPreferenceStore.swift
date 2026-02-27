import Foundation

private enum LegacyBiometricDefaultsKey {
    static let biometricEnabled = "pulpe-biometric-enabled"
}

protocol BiometricPreferenceKeychainStoring: Sendable {
    func getBiometricEnabledPreference() async -> Bool?
    func saveBiometricEnabledPreference(_ enabled: Bool) async
}

extension KeychainManager: BiometricPreferenceKeychainStoring {}

protocol BiometricPreferenceDefaultsStoring: Sendable {
    func getLegacyBiometricEnabled() async -> Bool
    func removeLegacyBiometricEnabled() async
}

/// UserDefaults is thread-safe per Apple documentation, so no actor isolation needed.
struct LegacyBiometricPreferenceDefaultsStore: BiometricPreferenceDefaultsStoring {
    func getLegacyBiometricEnabled() -> Bool {
        UserDefaults.standard.bool(forKey: LegacyBiometricDefaultsKey.biometricEnabled)
    }

    func removeLegacyBiometricEnabled() {
        UserDefaults.standard.removeObject(forKey: LegacyBiometricDefaultsKey.biometricEnabled)
    }
}

actor BiometricPreferenceStore {
    private let keychain: any BiometricPreferenceKeychainStoring
    private let defaults: any BiometricPreferenceDefaultsStoring

    init(
        keychain: any BiometricPreferenceKeychainStoring = KeychainManager.shared,
        defaults: any BiometricPreferenceDefaultsStoring = LegacyBiometricPreferenceDefaultsStore()
    ) {
        self.keychain = keychain
        self.defaults = defaults
    }

    func load() async -> Bool {
        if let keychainValue = await keychain.getBiometricEnabledPreference() {
            return keychainValue
        }

        let legacyValue = await defaults.getLegacyBiometricEnabled()
        if legacyValue {
            await keychain.saveBiometricEnabledPreference(true)
            await defaults.removeLegacyBiometricEnabled()
        }
        return legacyValue
    }

    func save(_ enabled: Bool) async {
        await keychain.saveBiometricEnabledPreference(enabled)
        await defaults.removeLegacyBiometricEnabled()
    }
}
