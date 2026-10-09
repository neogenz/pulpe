import Foundation

/// PUL-306 — whether the account has recorded anything yet, asked of the server so another
/// device's entries count. Every create surface reports here, which is what lets
/// `first_transaction_created` mark the account's first entry whichever screen recorded it.
@Observable @MainActor
final class FirstTransactionTracker {
    /// Where an entry was recorded — the value space of `source`, shared with the web.
    enum Source: String {
        case activationPrompt = "activation_prompt"
        case addButton = "add_button"
        case budgetDetails = "budget_details"
        case reconciliation
        case widget
    }

    static let shared = FirstTransactionTracker()

    /// `nil` until known: an unknown answer never shows the invitation, so an established
    /// account cannot see it flash in while the request is out.
    private(set) var hasTransaction: Bool?

    private let defaults: UserDefaults
    private let fetchHasTransaction: @Sendable () async throws -> Bool
    private let captureFirstTransaction: @MainActor (TransactionKind, Source) -> Void
    private var loadTask: Task<Void, Never>?

    init(
        defaults: UserDefaults = .standard,
        fetchHasTransaction: @escaping @Sendable () async throws -> Bool = {
            try await TransactionService.shared.hasAnyTransaction()
        },
        captureFirstTransaction: @escaping @MainActor (TransactionKind, Source) -> Void = { kind, source in
            AnalyticsService.shared.capture(
                .firstTransactionCreated,
                properties: ["type": kind.rawValue, "source": source.rawValue]
            )
        }
    ) {
        self.defaults = defaults
        self.fetchHasTransaction = fetchHasTransaction
        self.captureFirstTransaction = captureFirstTransaction
    }

    var isAwaitingFirstTransaction: Bool { hasTransaction == false }

    /// Asks once per session; an entry recorded from this device already answers, so one
    /// undone right away does not bring the invitation back.
    func loadIfNeeded() async {
        guard hasTransaction == nil else { return }
        if defaults.bool(forKey: Self.recordedKey) {
            hasTransaction = true
            return
        }
        if let loadTask {
            await loadTask.value
            return
        }
        let task = Task(name: "FirstTransactionTracker.load") {
            let answer = try? await self.fetchHasTransaction()
            // Left unknown on failure; an entry recorded meanwhile already answered.
            guard !Task.isCancelled, self.hasTransaction == nil, let answer else { return }
            self.hasTransaction = answer
        }
        loadTask = task
        await task.value
        if loadTask == task { loadTask = nil }
    }

    /// Call once the server accepted the entry.
    func recordCreated(kind: TransactionKind, source: Source) {
        if hasTransaction == false {
            captureFirstTransaction(kind, source)
        }
        hasTransaction = true
        defaults.set(true, forKey: Self.recordedKey)
    }

    /// Identity boundary: the next account starts from its own answer.
    func reset() {
        loadTask?.cancel()
        loadTask = nil
        hasTransaction = nil
        defaults.removeObject(forKey: Self.recordedKey)
    }

    private static let recordedKey = "pulpe-has-recorded-first-transaction"
}
