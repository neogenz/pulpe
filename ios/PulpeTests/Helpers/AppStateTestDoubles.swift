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

extension AtomicProperty where T == Int {
    func increment() {
        lock.lock()
        defer { lock.unlock() }
        _value += 1
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

// MARK: - Mock AppAuthFlagsStore

final class MockAppAuthFlagsStore: AppAuthFlagsStoring, @unchecked Sendable {
    private let lock = NSLock()
    private var _hasLaunchedBefore: Bool
    private var _didExplicitLogout: Bool
    private var _manualBiometricRetryRequired: Bool

    init(
        hasLaunchedBefore: Bool = true,
        didExplicitLogout: Bool = false,
        manualBiometricRetryRequired: Bool = false
    ) {
        _hasLaunchedBefore = hasLaunchedBefore
        _didExplicitLogout = didExplicitLogout
        _manualBiometricRetryRequired = manualBiometricRetryRequired
    }

    var hasLaunchedBefore: Bool {
        lock.lock()
        defer { lock.unlock() }
        return _hasLaunchedBefore
    }

    func setHasLaunchedBefore() {
        lock.lock()
        defer { lock.unlock() }
        _hasLaunchedBefore = true
    }

    var didExplicitLogout: Bool {
        lock.lock()
        defer { lock.unlock() }
        return _didExplicitLogout
    }

    func setDidExplicitLogout(_ value: Bool) {
        lock.lock()
        defer { lock.unlock() }
        _didExplicitLogout = value
    }

    func clearExplicitLogoutFlag() {
        lock.lock()
        defer { lock.unlock() }
        _didExplicitLogout = false
    }

    var manualBiometricRetryRequired: Bool {
        lock.lock()
        defer { lock.unlock() }
        return _manualBiometricRetryRequired
    }

    func setManualBiometricRetryRequired(_ value: Bool) {
        lock.lock()
        defer { lock.unlock() }
        _manualBiometricRetryRequired = value
    }

    func clearManualBiometricRetryFlag() {
        lock.lock()
        defer { lock.unlock() }
        _manualBiometricRetryRequired = false
    }
}

// MARK: - Mock WidgetSync

final class MockWidgetSync: WidgetSyncing, @unchecked Sendable {
    let clearAndReloadCalled = AtomicFlag()

    func clearAndReload() {
        clearAndReloadCalled.set()
    }
}

// MARK: - Mock KeychainEmailStoring

actor MockKeychainStore: KeychainEmailStoring {
    private var lastUsedEmail: String?

    init(lastUsedEmail: String? = nil) {
        self.lastUsedEmail = lastUsedEmail
    }

    func getLastUsedEmail() -> String? { lastUsedEmail }
    func saveLastUsedEmail(_ email: String) { lastUsedEmail = email }
    func clearLastUsedEmail() { lastUsedEmail = nil }
    func clearAllData() { lastUsedEmail = nil }
}

// MARK: - Shared BiometricPreference Stubs

final actor StubBiometricKeychain: BiometricPreferenceKeychainStoring {
    private var value: Bool?

    init(initial: Bool?) { value = initial }

    func getBiometricEnabledPreference() async -> Bool? { value }
    func saveBiometricEnabledPreference(_ enabled: Bool) async { value = enabled }
}

final actor StubBiometricDefaults: BiometricPreferenceDefaultsStoring {
    private var value: Bool

    init(initial: Bool) { value = initial }

    func getLegacyBiometricEnabled() async -> Bool { value }
    func removeLegacyBiometricEnabled() async { value = false }
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

    static func keychainStore(lastUsedEmail: String? = nil) -> MockKeychainStore {
        MockKeychainStore(lastUsedEmail: lastUsedEmail)
    }

    /// In-memory opt-out store that avoids UserDefaults pollution in tests.
    static func biometricOptOutStore(optedOut: Bool = false) -> InMemoryBiometricOptOutStore {
        InMemoryBiometricOptOutStore(initial: optedOut)
    }

    /// Clean in-memory opt-out store (false). Pass to AppState convenience init
    /// to avoid UserDefaults pollution in tests.
    static var cleanOptOutStore: InMemoryBiometricOptOutStore { InMemoryBiometricOptOutStore() }
}

// MARK: - InMemoryBiometricOptOutStore

final class InMemoryBiometricOptOutStore: BiometricOptOutStoring, @unchecked Sendable {
    private var value: Bool
    private(set) var lastSaved: Bool?

    init(initial: Bool = false) { self.value = initial }

    func loadOptOut() -> Bool { value }
    func saveOptOut(_ newValue: Bool) {
        value = newValue
        lastSaved = newValue
    }
}
