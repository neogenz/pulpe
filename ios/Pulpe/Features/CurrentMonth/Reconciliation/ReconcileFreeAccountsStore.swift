import Foundation

/// The free rows of « Comparer avec mes comptes » (« Revolut », « Carte Cembra ») kept on this
/// device so the next comparison starts with them: names and sides only, never an amount, never
/// sent to the server. Cleared on sign-out by `LiveSessionDataResetter`.
///
/// SAFETY: `UserDefaults` is thread-safe per Apple. This struct only reads/writes one encoded
/// value, so `@unchecked Sendable` is sound without an actor wrapper.
struct ReconcileFreeAccountsStore: @unchecked Sendable {
    struct Entry: Codable, Equatable, Sendable {
        let name: String
        let isOwed: Bool
    }

    static let shared = ReconcileFreeAccountsStore()
    private static let storageKey = "reconcileFreeAccounts"

    private let defaults: UserDefaults

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
    }

    var entries: [Entry] {
        defaults.data(forKey: Self.storageKey)
            .flatMap { try? JSONDecoder().decode([Entry].self, from: $0) } ?? []
    }

    func save(_ entries: [Entry]) {
        defaults.set(try? JSONEncoder().encode(entries), forKey: Self.storageKey)
    }

    func clear() {
        defaults.removeObject(forKey: Self.storageKey)
    }
}
