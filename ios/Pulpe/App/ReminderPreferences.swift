import Foundation

/// Local reminder opt-in flags. Device-local (reminders are scheduled per-device),
/// so these are not synced to the server:
/// - `remindersEnabled`: the user opted into monthly reminders.
/// - `hasPrimedReminders`: the value-framed pre-permission prime was shown once, so
///   it is never re-shown after the user's first "pointer".
///
/// SAFETY: `UserDefaults` is thread-safe per Apple. Primitive-flag reads/writes only,
/// so `@unchecked Sendable` is sound without an actor wrapper.
struct ReminderPreferences: @unchecked Sendable {
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
