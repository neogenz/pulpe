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
        static let lastSeenVersion = "pulpe.lastSeenWhatsNewVersion"
    }

    private let defaults: UserDefaults
    let wasInstalledBeforeWhatsNew: Bool

    init(
        defaults: UserDefaults = .standard,
        currentVersion: String = AppConfiguration.appVersion
    ) {
        self.defaults = defaults
        // Capture before AppState.bootstrap() marks a fresh installation as launched.
        let wasInstalledBeforeWhatsNew = defaults.bool(forKey: AppAuthFlagsKey.hasLaunchedBefore)
        self.wasInstalledBeforeWhatsNew = wasInstalledBeforeWhatsNew
        if !wasInstalledBeforeWhatsNew,
           defaults.string(forKey: Key.lastSeenVersion) == nil {
            defaults.set(currentVersion, forKey: Key.lastSeenVersion)
        }
    }

    var lastSeenVersion: String? {
        defaults.string(forKey: Key.lastSeenVersion)
    }

    func setLastSeenVersion(_ version: String) {
        defaults.set(version, forKey: Key.lastSeenVersion)
    }
}
