import Foundation

/// Thread-safe UserDefaults wrapper to avoid blocking main actor in UI state objects.
actor UserDefaultsStore {
    static let shared = UserDefaultsStore()

    private let defaults = UserDefaults.standard

    func getBool(forKey key: String) -> Bool {
        defaults.bool(forKey: key)
    }

    func setBool(_ value: Bool, forKey key: String) {
        defaults.set(value, forKey: key)
    }
}
