import Foundation

// MARK: - Protocol

protocol WhatsNewFlagsStoring: Sendable {
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

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
    }

    var lastSeenVersion: String? {
        defaults.string(forKey: Key.lastSeenVersion)
    }

    func setLastSeenVersion(_ version: String) {
        defaults.set(version, forKey: Key.lastSeenVersion)
    }
}
