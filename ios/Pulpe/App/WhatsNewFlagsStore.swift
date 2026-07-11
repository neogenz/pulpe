import Foundation

// MARK: - Protocol

protocol WhatsNewFlagsStoring: Sendable {
    var wasInstalledBeforeWhatsNew: Bool { get }
    var lastSeenVersion: String? { get }
    func setLastSeenVersion(_ version: String)
}

// MARK: - Production Implementation

/// SAFETY: `UserDefaults` is thread-safe per Apple. This struct only reads/writes a single string; `@unchecked Sendable` implements `WhatsNewFlagsStoring: Sendable` for DI without an actor wrapper.
struct WhatsNewFlagsStore: WhatsNewFlagsStoring, @unchecked Sendable {
    private enum Key {
        static let hasLaunchedBefore = "pulpe-has-launched-before"
        static let lastSeenVersion = "pulpe.lastSeenWhatsNewVersion"
    }

    private let defaults: UserDefaults
    let wasInstalledBeforeWhatsNew: Bool

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
        // Capture before AppState.bootstrap() marks a fresh installation as launched.
        wasInstalledBeforeWhatsNew = defaults.bool(forKey: Key.hasLaunchedBefore)
    }

    var lastSeenVersion: String? {
        defaults.string(forKey: Key.lastSeenVersion)
    }

    func setLastSeenVersion(_ version: String) {
        defaults.set(version, forKey: Key.lastSeenVersion)
    }
}
