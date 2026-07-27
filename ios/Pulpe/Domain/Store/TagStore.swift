import Foundation

@Observable @MainActor
final class TagStore: StoreProtocol {
    private(set) var tags: [Tag] = []
    private(set) var isLoading = false
    private(set) var error: APIError?
    private(set) var hasLoadedOnce = false

    var hasError: Bool {
        error != nil && tags.isEmpty
    }

    var namesById: [String: String] {
        Dictionary(uniqueKeysWithValues: tags.map { ($0.id, $0.name) })
    }

    private var lastLoadTime: Date?
    private var loadTask: Task<Void, Never>?
    private var loadGeneration = 0
    private var sessionGeneration = 0
    private let service: any TagServicing

    init(service: any TagServicing = TagService.shared) {
        self.service = service
    }

    func loadIfNeeded() async {
        if let lastLoadTime,
           Date().timeIntervalSince(lastLoadTime) < AppConfiguration.shortCacheValidity {
            return
        }
        await forceRefresh()
    }

    func forceRefresh() async {
        loadTask?.cancel()
        loadGeneration += 1
        let generation = loadGeneration

        let task = Task(name: "Tags.load") {
            guard loadGeneration == generation else { return }
            isLoading = true
            error = nil
            defer {
                if loadGeneration == generation { isLoading = false }
            }

            do {
                let fetched = try await service.getAll()
                try Task.checkCancellation()
                guard loadGeneration == generation else { return }
                tags = fetched.sortedForDisplay()
                lastLoadTime = Date()
                hasLoadedOnce = true
            } catch where error.isCancellationOrURLCancellation {
                // Keep the current catalog when a newer load or logout cancels this one.
            } catch let apiError as APIError {
                if loadGeneration == generation { self.error = apiError }
            } catch {
                if loadGeneration == generation { self.error = .networkError(error) }
            }
        }

        loadTask = task
        await task.value
        if loadGeneration == generation { loadTask = nil }
    }

    @discardableResult
    func create(name: String) async throws -> Tag {
        let generation = sessionGeneration
        let created = try await service.create(TagCreate(name: name))
        guard sessionGeneration == generation else { throw CancellationError() }
        tags = (tags + [created]).sortedForDisplay()
        return created
    }

    func invalidateCache() {
        lastLoadTime = nil
    }

    func reset() {
        loadTask?.cancel()
        loadTask = nil
        loadGeneration += 1
        sessionGeneration += 1
        tags = []
        isLoading = false
        error = nil
        hasLoadedOnce = false
        lastLoadTime = nil
    }
}

private extension Array where Element == Tag {
    func sortedForDisplay() -> [Tag] {
        sorted { $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending }
    }
}
