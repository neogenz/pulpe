import Foundation

// MARK: - Protocol

protocol AppAuthFlagsStoring: Sendable {
    var hasLaunchedBefore: Bool { get }
    func setHasLaunchedBefore()
    var didExplicitLogout: Bool { get }
    func setDidExplicitLogout(_ value: Bool)
    func clearExplicitLogoutFlag()
    var manualBiometricRetryRequired: Bool { get }
    func setManualBiometricRetryRequired(_ value: Bool)
    func clearManualBiometricRetryFlag()
}

// MARK: - Production Implementation

struct AppAuthFlagsStore: AppAuthFlagsStoring, @unchecked Sendable {
    private enum Key {
        static let hasLaunchedBefore = "pulpe-has-launched-before"
        static let didExplicitLogout = "pulpe-did-explicit-logout"
        static let manualBiometricRetryRequired = "pulpe-manual-biometric-retry-required"
    }

    private let defaults: UserDefaults

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
    }

    var hasLaunchedBefore: Bool {
        defaults.bool(forKey: Key.hasLaunchedBefore)
    }

    func setHasLaunchedBefore() {
        defaults.set(true, forKey: Key.hasLaunchedBefore)
    }

    var didExplicitLogout: Bool {
        defaults.bool(forKey: Key.didExplicitLogout)
    }

    func setDidExplicitLogout(_ value: Bool) {
        defaults.set(value, forKey: Key.didExplicitLogout)
    }

    func clearExplicitLogoutFlag() {
        defaults.removeObject(forKey: Key.didExplicitLogout)
    }

    var manualBiometricRetryRequired: Bool {
        defaults.bool(forKey: Key.manualBiometricRetryRequired)
    }

    func setManualBiometricRetryRequired(_ value: Bool) {
        defaults.set(value, forKey: Key.manualBiometricRetryRequired)
    }

    func clearManualBiometricRetryFlag() {
        defaults.removeObject(forKey: Key.manualBiometricRetryRequired)
    }
}
