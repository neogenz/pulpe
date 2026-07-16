import Foundation

/// Caches the user's savings goals (PUL-12). Backs both the goals list/form and
/// the "Objectif" picker in the prévision editors, so it is injected at app root.
///
/// Editing a goal only changes its metadata. Deleting one unlinks its
/// prévisions, creating one with `monthlyContribution` generates a linked
/// baseline across budgets (PUL-285), and a generation-stop decision freezes or
/// removes future lines — `onBudgetDataMutation` states that ONE fact (PUL-270
/// seam) so the app invalidates every store exposing budget data.
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
    @ObservationIgnored var onBudgetDataMutation: (@MainActor () -> Void)?

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
    /// posed a linked template_line + budget_lines → budget data changed.
    @discardableResult
    func create(_ data: SavingsGoalCreate) async throws -> SavingsGoal {
        let created = try await service.create(data)
        goals = (goals + [created]).sortedForDisplay()
        if data.monthlyContribution != nil { onBudgetDataMutation?() }
        return created
    }

    /// Updates a goal (incl. status changes) and replaces it in the cache.
    @discardableResult
    func update(id: String, data: SavingsGoalUpdate) async throws -> SavingsGoal {
        let updated = try await service.update(id: id, data: data)
        if let index = goals.firstIndex(where: { $0.id == id }) {
            goals[index] = updated
        }
        goals = goals.sortedForDisplay()
        return updated
    }

    /// Deletes a goal (the backend unlinks its prévisions; none are deleted).
    func delete(id: String) async throws {
        try await service.delete(id: id)
        goals.removeAll { $0.id == id }
        onBudgetDataMutation?()
    }

    /// Applies the advisory freeze/remove decision (PUL-285 CA8). Budget lines
    /// are frozen or deleted server-side → budget data changed.
    @discardableResult
    func applyGenerationStop(
        id: String,
        _ payload: SavingsGoalGenerationStop
    ) async throws -> SavingsGoalGenerationStopResult {
        let result = try await service.applyGenerationStop(id: id, payload)
        onBudgetDataMutation?()
        return result
    }

    func invalidateCache() {
        lastLoadTime = nil
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
