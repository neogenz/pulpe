import Foundation

/// One-time flag persistence for the post-onboarding handoff (the teaching screen
/// shown once, right after a user finishes onboarding, to name the "pointer" ritual
/// and prompt pinning the Lock Screen widget), and for the first-expense invitation
/// that follows it on the home (PUL-306).
///
/// SAFETY: `UserDefaults` is thread-safe per Apple. This struct only reads/writes a
/// primitive flag, so `@unchecked Sendable` is sound without an actor wrapper.
struct PostOnboardingFlagsStore: @unchecked Sendable {
    private enum Key {
        static let hasSeenPostOnboardingHandoff = "pulpe-has-seen-post-onboarding-handoff"
        static let hasRecordedFirstTransaction = "pulpe-has-recorded-first-transaction"
    }

    private let defaults: UserDefaults

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
    }

    var hasSeenPostOnboardingHandoff: Bool {
        defaults.bool(forKey: Key.hasSeenPostOnboardingHandoff)
    }

    func setHasSeenPostOnboardingHandoff() {
        defaults.set(true, forKey: Key.hasSeenPostOnboardingHandoff)
    }

    /// Stored rather than read off the month: an entry deleted afterwards leaves the
    /// first budget empty again, and the invitation must not come back for someone who
    /// has already made the gesture it teaches.
    var hasRecordedFirstTransaction: Bool {
        defaults.bool(forKey: Key.hasRecordedFirstTransaction)
    }

    func setHasRecordedFirstTransaction() {
        defaults.set(true, forKey: Key.hasRecordedFirstTransaction)
    }

    /// Frontière d'identité (suppression de compte, switch d'utilisateur) : un
    /// compte qui re-onboarde sur ce device doit revoir le handoff et l'invitation.
    func reset() {
        defaults.removeObject(forKey: Key.hasSeenPostOnboardingHandoff)
        defaults.removeObject(forKey: Key.hasRecordedFirstTransaction)
    }
}
