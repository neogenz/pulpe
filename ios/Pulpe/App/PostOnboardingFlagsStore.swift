import Foundation

/// One-time flag persistence for the post-onboarding handoff (the teaching screen
/// shown once, right after a user finishes onboarding, to name the "pointer" ritual
/// and prompt pinning the Lock Screen widget).
///
/// SAFETY: `UserDefaults` is thread-safe per Apple. This struct only reads/writes a
/// primitive flag, so `@unchecked Sendable` is sound without an actor wrapper.
struct PostOnboardingFlagsStore: @unchecked Sendable {
    private enum Key {
        static let hasSeenPostOnboardingHandoff = "pulpe-has-seen-post-onboarding-handoff"
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

    /// Frontière d'identité (suppression de compte, switch d'utilisateur) : un
    /// compte qui re-onboarde sur ce device doit revoir le handoff.
    func reset() {
        defaults.removeObject(forKey: Key.hasSeenPostOnboardingHandoff)
    }
}
