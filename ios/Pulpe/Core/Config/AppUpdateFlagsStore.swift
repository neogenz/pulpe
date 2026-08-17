import Foundation

protocol AppUpdateFlagsStoring: Sendable {
    var lastPromptedVersion: String? { get }
    func setLastPromptedVersion(_ version: String)
}

/// SAFETY: `UserDefaults` is thread-safe. This store only reads and writes one string.
struct AppUpdateFlagsStore: AppUpdateFlagsStoring, @unchecked Sendable {
    private enum Key {
        static let lastPromptedVersion = "pulpe.lastPromptedAppUpdateVersion"
    }

    private let defaults: UserDefaults

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
    }

    var lastPromptedVersion: String? {
        defaults.string(forKey: Key.lastPromptedVersion)
    }

    func setLastPromptedVersion(_ version: String) {
        defaults.set(version, forKey: Key.lastPromptedVersion)
    }
}
