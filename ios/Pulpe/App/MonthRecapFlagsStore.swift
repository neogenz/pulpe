import Foundation

/// The last closed month whose recap the user dismissed, as "YYYY-MM" (PUL-111). One
/// value rather than a set: the key moves forward with the calendar, so dismissing
/// October's recap can never hide November's.
///
/// SAFETY: `UserDefaults` is thread-safe per Apple. This struct only reads/writes a
/// primitive value, so `@unchecked Sendable` is sound without an actor wrapper.
struct MonthRecapFlagsStore: @unchecked Sendable {
    private enum Key {
        static let lastSeenMonthRecap = "pulpe-last-seen-month-recap"
    }

    private let defaults: UserDefaults

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
    }

    var lastSeenMonthRecap: String? {
        defaults.string(forKey: Key.lastSeenMonthRecap)
    }

    func setLastSeenMonthRecap(_ key: String) {
        defaults.set(key, forKey: Key.lastSeenMonthRecap)
    }

    /// Identity boundary (account deletion, user switch): another account on this device
    /// has its own months to recap.
    func reset() {
        defaults.removeObject(forKey: Key.lastSeenMonthRecap)
    }
}
