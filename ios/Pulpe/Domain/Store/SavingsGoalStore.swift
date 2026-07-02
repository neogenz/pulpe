import Foundation

/// Caches the user's savings goals (PUL-12). Backs both the goals list/form and
/// the "Objectif" picker in the prévision editors, so it is injected at app root.
///
/// Goal CRUD never changes budget aggregates (a goal is metadata; DELETE only
/// unlinks lines, it never alters amounts), so — unlike the dashboard stores —
/// it does not invalidate sibling stores.
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
            isLoading = true
            error = nil
            defer { isLoading = false }

            do {
                let fetched = try await service.getAll()
                try Task.checkCancellation()
                goals = fetched.sortedForDisplay()
                lastLoadTime = Date()
                hasLoadedOnce = true
            } catch is CancellationError {
                // Cancelled — keep existing state.
            } catch let apiError as APIError {
                self.error = apiError
            } catch {
                self.error = .networkError(error)
            }
        }

        loadTask = task
        await task.value
        if loadGeneration == currentGeneration { loadTask = nil }
    }

    // MARK: - Mutations

    /// Creates a goal and inserts it into the cached list on success.
    @discardableResult
    func create(_ data: SavingsGoalCreate) async throws -> SavingsGoal {
        let created = try await service.create(data)
        goals = (goals + [created]).sortedForDisplay()
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
    }

    func invalidateCache() {
        lastLoadTime = nil
    }

    func reset() {
        loadTask?.cancel()
        loadTask = nil
        loadGeneration = 0
        goals = []
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
