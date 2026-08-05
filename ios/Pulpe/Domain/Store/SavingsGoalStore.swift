import Foundation

/// Caches the user's savings goals (PUL-12). Backs both the goals list/form and
/// the "Objectif" picker in the prévision editors, so it is injected at app root.
///
/// Editing a goal only changes its metadata. Deleting one applies the explicit
/// scope accepted from a fresh impact preview, creating one with
/// `monthlyContribution` generates a linked baseline across budgets (PUL-285),
/// and a generation-stop decision freezes or removes future lines —
/// `onBudgetDataMutation` states that ONE fact (PUL-270 seam) so the app
/// invalidates every store exposing budget data.
@Observable @MainActor
final class SavingsGoalStore: StoreProtocol {
    // MARK: - State

    private(set) var goals: [SavingsGoal] = []
    private(set) var isLoading = false
    private(set) var error: APIError?

    var hasError: Bool {
        error != nil && goals.isEmpty
    }

    // MARK: - Cache Metadata

    private(set) var hasLoadedOnce = false
    private var lastLoadTime: Date?
    private var loadTask: Task<Void, Never>?
    private var loadGeneration = 0
    private(set) var templateDataVersion = 0
    @ObservationIgnored var onBudgetDataMutation: (@MainActor () -> Void)?

    /// Withdrawal options (PUL-329) carry a balance, so they go stale faster than
    /// the goals themselves. Same short TTL, separate timestamp — opening the add
    /// sheet twice in a row must not re-hit the network, but any mutation must.
    private var cachedWithdrawalOptions: [SavingsGoalWithdrawalOption] = []
    private var lastWithdrawalOptionsLoadTime: Date?

    // MARK: - Services

    private let service: any SavingsGoalServicing

    init(service: any SavingsGoalServicing = SavingsGoalService.shared) {
        self.service = service
    }

    // MARK: - Smart Loading (StoreProtocol)

    func loadIfNeeded() async {
        if let lastLoad = lastLoadTime,
           Date().timeIntervalSince(lastLoad) < AppConfiguration.shortCacheValidity {
            return
        }
        await forceRefresh()
    }

    func forceRefresh() async {
        loadTask?.cancel()
        loadGeneration += 1
        let currentGeneration = loadGeneration

        let task = Task(name: "SavingsGoals.load") {
            guard loadGeneration == currentGeneration else { return }
            isLoading = true
            error = nil
            defer {
                if loadGeneration == currentGeneration { isLoading = false }
            }

            do {
                let fetched = try await service.getAll()
                try Task.checkCancellation()
                guard loadGeneration == currentGeneration else { return }
                goals = fetched.sortedForDisplay()
                lastLoadTime = Date()
                hasLoadedOnce = true
            } catch where error.isCancellationOrURLCancellation {
                // Cancelled — keep existing state.
            } catch let apiError as APIError {
                if loadGeneration == currentGeneration { self.error = apiError }
            } catch {
                if loadGeneration == currentGeneration {
                    self.error = .networkError(error)
                }
            }
        }

        loadTask = task
        await task.value
        if loadGeneration == currentGeneration { loadTask = nil }
    }

    // MARK: - Mutations

    /// Creates a goal and inserts it into the cached list on success. With
    /// `monthlyContribution` set (PUL-285 auto-décomposition), the server also
    /// creates linked one-off lines in existing budgets → budget data changed.
    @discardableResult
    func create(_ data: SavingsGoalCreate) async throws -> SavingsGoal {
        do {
            let created = try await service.create(data)
            goals = (goals + [created]).sortedForDisplay()
            if data.monthlyContribution != nil { notifyBudgetDataMutation() }
            return created
        } catch let error as APIError {
            if case .savingsGoalBaselineRecalculationFailed = error {
                notifyBudgetDataMutation()
                await forceRefresh()
            }
            throw error
        }
    }

    /// Updates a goal (incl. status changes) and replaces it in the cache.
    @discardableResult
    func update(id: String, data: SavingsGoalUpdate) async throws -> SavingsGoal {
        do {
            let updated = try await service.update(id: id, data: data)
            if let index = goals.firstIndex(where: { $0.id == id }) {
                goals[index] = updated
            }
            goals = goals.sortedForDisplay()
            if data.reconciliation != nil {
                invalidateCache()
                notifyBudgetDataMutation()
            }
            return updated
        } catch let error as APIError {
            if data.reconciliation != nil,
               case .savingsGoalReconciliationRecalculationFailed = error {
                invalidateCache()
                notifyBudgetDataMutation()
                await forceRefresh()
            }
            throw error
        }
    }

    /// Server-owned candidate set for an advanced deadline. The target date is
    /// part of the preview contract; no client filtering is applied.
    func getFutureLines(id: String, targetDate: String) async throws -> [SavingsGoalFutureLine] {
        try await service.getFutureLines(id: id, targetDate: targetDate)
    }

    /// Always bypasses the store cache: the revision must describe the exact
    /// entities shown immediately before deletion.
    func getDeletionImpact(id: String) async throws -> SavingsGoalDeletionImpact {
        try await service.getDeletionImpact(id: id)
    }

    /// Pessimistic deletion: the cached goal remains visible until the backend
    /// commits. A recalculation failure is post-commit, so local state still
    /// settles before the warning is rethrown.
    func delete(id: String, command: SavingsGoalDeletionCommand) async throws {
        do {
            try await service.delete(id: id, command: command)
        } catch let apiError as APIError {
            switch apiError {
            case .savingsGoalNotFound:
                settleCommittedDeletion(id: id)
                return
            case .savingsGoalDeletionRecalculationFailed:
                settleCommittedDeletion(id: id)
            default:
                break
            }
            throw apiError
        }
        settleCommittedDeletion(id: id)
    }

    private func settleCommittedDeletion(id: String) {
        goals.removeAll { $0.id == id }
        templateDataVersion += 1
        notifyBudgetDataMutation()
    }

    /// Applies the advisory freeze/remove decision (PUL-285 CA8). Budget lines
    /// are frozen or deleted server-side → budget data changed.
    @discardableResult
    func applyGenerationStop(
        id: String,
        _ payload: SavingsGoalGenerationStop
    ) async throws -> SavingsGoalGenerationStopResult {
        do {
            let result = try await service.applyGenerationStop(id: id, payload)
            notifyBudgetDataMutation()
            return result
        } catch {
            if let apiError = error as? APIError,
               case .savingsGoalGenerationStopRecalculationFailed = apiError {
                notifyBudgetDataMutation()
            }
            throw error
        }
    }

    /// Goals that can fund an income right now. `forceRefresh` is what the sheet
    /// uses after a server refusal: the balance it displayed is provably stale.
    func fetchWithdrawalOptions(forceRefresh: Bool = false) async throws -> [SavingsGoalWithdrawalOption] {
        if !forceRefresh,
           let lastLoad = lastWithdrawalOptionsLoadTime,
           Date().timeIntervalSince(lastLoad) < AppConfiguration.shortCacheValidity {
            return cachedWithdrawalOptions
        }
        let options = try await service.getWithdrawalOptions()
        cachedWithdrawalOptions = options
        lastWithdrawalOptionsLoadTime = Date()
        return options
    }

    func getWithdrawals(id: String) async throws -> [SavingsGoalWithdrawal] {
        try await service.getWithdrawals(id: id)
    }

    /// Server-computed progression, incl. the monthly plan a planned withdrawal
    /// reads its projection from (PUL-329 v2). Passthrough on purpose: the
    /// figures move with every budget write, and caching them here would hand
    /// the picker a balance the user just changed.
    func getProgress(id: String) async throws -> SavingsGoalProgress {
        try await service.getProgress(id: id)
    }

    /// The single place budget-data mutations are announced. Anything that moves
    /// money moves a goal balance too, so the withdrawal options die here rather
    /// than at each call site.
    private func notifyBudgetDataMutation() {
        lastWithdrawalOptionsLoadTime = nil
        onBudgetDataMutation?()
    }

    func invalidateCache() {
        lastLoadTime = nil
        lastWithdrawalOptionsLoadTime = nil
    }

    func reset() {
        loadTask?.cancel()
        loadTask = nil
        loadGeneration += 1
        goals = []
        isLoading = false
        hasLoadedOnce = false
        lastLoadTime = nil
        error = nil
        templateDataVersion = 0
        cachedWithdrawalOptions = []
        lastWithdrawalOptionsLoadTime = nil
    }
}

// MARK: - Display ordering

private extension Array where Element == SavingsGoal {
    /// ACTIVE first, then PAUSED, then COMPLETED; alphabetical within a status.
    func sortedForDisplay() -> [SavingsGoal] {
        sorted { lhs, rhs in
            if lhs.status.sortRank != rhs.status.sortRank {
                return lhs.status.sortRank < rhs.status.sortRank
            }
            return lhs.name.localizedCaseInsensitiveCompare(rhs.name) == .orderedAscending
        }
    }
}

private extension SavingsGoalStatus {
    var sortRank: Int {
        switch self {
        case .active: return 0
        case .paused: return 1
        case .completed: return 2
        }
    }
}
