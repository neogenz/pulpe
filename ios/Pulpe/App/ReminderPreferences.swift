import Foundation

// MARK: - Protocol

protocol ReminderPreferencesStoring: Sendable {
    /// Whether the user has opted into local reminders. Device-local (reminders are
    /// scheduled per-device), so this is not synced to the server.
    var remindersEnabled: Bool { get }
    func setRemindersEnabled(_ value: Bool)

    /// Whether the value-framed pre-permission prime has already been shown once, so
    /// it is never re-shown after the user's first "pointer".
    var hasPrimedReminders: Bool { get }
    func setHasPrimedReminders()
}

// MARK: - Production Implementation

/// SAFETY: `UserDefaults` is thread-safe per Apple. Primitive-flag reads/writes only;
/// `@unchecked Sendable` satisfies `Sendable` for DI without an actor. Mirrors
/// `AppAuthFlagsStore`.
struct ReminderPreferences: ReminderPreferencesStoring, @unchecked Sendable {
    private enum Key {
        static let remindersEnabled = "pulpe-reminders-enabled"
        static let hasPrimedReminders = "pulpe-has-primed-reminders"
    }

    private let defaults: UserDefaults

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
    }

    var remindersEnabled: Bool {
        defaults.bool(forKey: Key.remindersEnabled)
    }

    func setRemindersEnabled(_ value: Bool) {
        defaults.set(value, forKey: Key.remindersEnabled)
    }

    var hasPrimedReminders: Bool {
        defaults.bool(forKey: Key.hasPrimedReminders)
    }

    func setHasPrimedReminders() {
        defaults.set(true, forKey: Key.hasPrimedReminders)
    }
}
