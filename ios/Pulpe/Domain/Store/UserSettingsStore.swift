import Foundation

@Observable @MainActor
final class UserSettingsStore: StoreProtocol {
    // MARK: - State

    private(set) var payDayOfMonth: Int?
    private(set) var isLoading = false
    private(set) var error: APIError?

    var hasError: Bool {
        error != nil
    }

    // MARK: - Cache Metadata

    private var lastLoadTime: Date?

    /// Coalescing task to prevent concurrent API loads
    private var loadTask: Task<Void, Never>?
    /// Generation counter to safely nil loadTask after completion
    private var loadGeneration = 0

    // MARK: - Services

    private let service: UserSettingsService

    // MARK: - Initialization

    init(service: UserSettingsService = .shared) {
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

        let task = Task {
            isLoading = true
            error = nil
            defer { isLoading = false }

            do {
                let settings = try await service.getSettings()

                try Task.checkCancellation()

                payDayOfMonth = settings.payDayOfMonth
                lastLoadTime = Date()
            } catch is CancellationError {
                // Task was cancelled, don't update error state
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

    func reset() {
        loadTask?.cancel()
        loadTask = nil
        loadGeneration = 0
        payDayOfMonth = nil
        lastLoadTime = nil
        error = nil
    }

    // MARK: - Mutations

    func updatePayDay(_ day: Int?) async {
        guard day == nil || (day.map { (2...31).contains($0) } ?? false) else { return }

        let previousValue = payDayOfMonth

        // Optimistic update
        payDayOfMonth = day

        do {
            let updated = try await service.updateSettings(UpdateUserSettings(payDayOfMonth: day))
            payDayOfMonth = updated.payDayOfMonth
            lastLoadTime = Date()
        } catch let apiError as APIError {
            payDayOfMonth = previousValue
            self.error = apiError
        } catch {
            payDayOfMonth = previousValue
            self.error = .networkError(error)
        }
    }
}
