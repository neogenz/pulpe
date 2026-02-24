import Foundation
@testable import Pulpe

// MARK: - Mock BiometricPreferenceStore

actor MockBiometricPreferenceStore: BiometricPreferenceKeychainStoring, BiometricPreferenceDefaultsStoring {
    private var enabled: Bool

    init(enabled: Bool) {
        self.enabled = enabled
    }

    func getBiometricEnabledPreference() async -> Bool? { enabled }
    func saveBiometricEnabledPreference(_ enabled: Bool) async { self.enabled = enabled }

    func getLegacyBiometricEnabled() async -> Bool { false }
    func removeLegacyBiometricEnabled() async {}
}

// MARK: - Mock PostAuthResolver

struct MockPostAuthResolver: PostAuthResolving {
    let destination: PostAuthDestination

    func resolve() async -> PostAuthDestination { destination }
}

// MARK: - Thread-Safe Test Helpers

/// Thread-safe wrapper for tracking mutable values across `@Sendable` closures.
final class AtomicProperty<T>: @unchecked Sendable {
    private var _value: T
    private let lock = NSLock()

    init(_ initialValue: T) {
        _value = initialValue
    }

    var value: T {
        lock.lock()
        defer { lock.unlock() }
        return _value
    }

    func set(_ newValue: T) {
        lock.lock()
        defer { lock.unlock() }
        _value = newValue
    }
}

/// Convenience alias for boolean tracking.
typealias AtomicFlag = AtomicProperty<Bool>

extension AtomicFlag {
    convenience init() {
        self.init(false)
    }

    func set() {
        set(true)
    }
}

// MARK: - BiometricPreferenceStore Factory

enum AppStateTestFactory {
    static func biometricEnabledStore() -> BiometricPreferenceStore {
        BiometricPreferenceStore(
            keychain: MockBiometricPreferenceStore(enabled: true),
            defaults: MockBiometricPreferenceStore(enabled: false)
        )
    }

    static func biometricDisabledStore() -> BiometricPreferenceStore {
        BiometricPreferenceStore(
            keychain: MockBiometricPreferenceStore(enabled: false),
            defaults: MockBiometricPreferenceStore(enabled: false)
        )
    }
}
