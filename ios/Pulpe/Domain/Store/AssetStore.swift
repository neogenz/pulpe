import Foundation

/// How a new or moved element picks its Type. A name is created first when no Type carries it,
/// so a Type only exists once an element lands in it (same as the web `resolveAssetCategory`).
enum AssetCategoryChoice: Hashable, Sendable {
    case existing(id: String)
    case starter(name: String)
}

/// Caches `GET /v1/assets` (PUL-366). Writes return records without amounts, so every write
/// is followed by a refetch, also on failure. No amount is computed here: the server owns
/// totals and conversions.
@Observable @MainActor
final class AssetStore: StoreProtocol {
    // MARK: - State

    private(set) var netWorth: NetWorth?
    private(set) var isLoading = false
    private(set) var isSaving = false
    private(set) var error: APIError?

    var hasError: Bool {
        error != nil && netWorth == nil
    }

    // MARK: - Cache Metadata

    private(set) var hasLoadedOnce = false
    private var lastLoadTime: Date?
    private var loadTask: Task<Void, Never>?
    private var loadGeneration = 0

    // MARK: - Services

    private let service: any AssetServicing

    init(service: any AssetServicing = AssetService.shared) {
        self.service = service
    }

    // MARK: - Reads

    var activeAssets: [Asset] { (netWorth?.assets ?? []).filter { $0.archivedAt == nil } }
    var archivedAssets: [Asset] { (netWorth?.assets ?? []).filter { $0.archivedAt != nil } }
    var categories: [AssetCategory] { netWorth?.categories ?? [] }
    var totals: NetWorthTotals? { netWorth?.totals }

    func activeAssets(direction: AssetDirection) -> [Asset] {
        activeAssets.filter { $0.direction == direction }
    }

    /// Accounts a prévision can be drawn from or paid into: active, owned, tracked in Pulpe.
    func inPulpeAccounts(currency: SupportedCurrency) -> [Asset] {
        activeAssets.filter { $0.direction == .own && $0.inPulpe && $0.currency == currency }
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

        let task = Task(name: "Assets.load") {
            guard loadGeneration == currentGeneration else { return }
            isLoading = true
            error = nil
            defer {
                if loadGeneration == currentGeneration { isLoading = false }
            }

            do {
                let fetched = try await service.getNetWorth()
                try Task.checkCancellation()
                guard loadGeneration == currentGeneration else { return }
                netWorth = fetched
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

    func invalidateCache() {
        lastLoadTime = nil
    }

    func reset() {
        loadTask?.cancel()
        loadTask = nil
        loadGeneration += 1
        netWorth = nil
        isLoading = false
        isSaving = false
        hasLoadedOnce = false
        lastLoadTime = nil
        error = nil
    }

    // MARK: - Writes

    /// `asset.categoryId` is replaced by the resolved category.
    func create(_ asset: AssetCreate, category: AssetCategoryChoice) async throws {
        try await write {
            let categoryId = try await self.resolve(category)
            _ = try await self.service.create(AssetCreate(
                name: asset.name, categoryId: categoryId, currency: asset.currency,
                direction: asset.direction, inPulpe: asset.inPulpe, value: asset.value
            ))
        }
    }

    /// The `PATCH` then the snapshot, each only when the edit carries it.
    func save(id: String, _ edit: AssetEdit) async throws {
        try await write {
            var updates = edit.updates ?? AssetUpdate()
            if let category = edit.category { updates.categoryId = try await self.resolve(category) }
            if updates != AssetUpdate() { _ = try await self.service.update(id: id, updates) }
            if let value = edit.value {
                let item = AssetSnapshotItem(assetId: id, value: value)
                _ = try await self.service.recordSnapshots(AssetSnapshotsCreate(items: [item]))
            }
        }
    }

    func setArchived(id: String, _ archived: Bool) async throws {
        try await write { _ = try await self.service.update(id: id, AssetUpdate(archived: archived)) }
    }

    func delete(id: String) async throws {
        try await write { try await self.service.delete(id: id) }
    }

    func recordSnapshots(_ data: AssetSnapshotsCreate) async throws {
        try await write { _ = try await self.service.recordSnapshots(data) }
    }

    func dismissSuggestion(id: String) async throws {
        try await write { _ = try await self.service.dismissSuggestion(id: id) }
    }

    func renameCategory(id: String, name: String) async throws {
        try await write { _ = try await self.service.renameCategory(id: id, AssetCategoryWrite(name: name)) }
    }

    // MARK: - Private

    private func resolve(_ choice: AssetCategoryChoice) async throws -> String {
        switch choice {
        case .existing(let id): return id
        case .starter(let name):
            // A Type no element uses is hidden, never deleted: its name reuses it.
            if let match = categories.first(where: { $0.name.lowercased() == name.lowercased() }) {
                return match.id
            }
            return try await service.createCategory(AssetCategoryWrite(name: name)).id
        }
    }

    /// One write at a time (a second is dropped), then a refetch whatever the outcome: a
    /// failed write may still have created the starter category.
    private func write(_ operation: () async throws -> Void) async throws {
        guard !isSaving else { return }
        isSaving = true
        defer { isSaving = false }
        do {
            try await operation()
        } catch {
            await forceRefresh()
            throw error
        }
        await forceRefresh()
    }
}
