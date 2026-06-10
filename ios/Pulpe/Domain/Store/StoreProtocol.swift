import Foundation

/// Protocol for stores that manage cached data with smart loading
@MainActor
protocol StoreProtocol: Observable {
    /// Indicates if the store is currently loading data
    var isLoading: Bool { get }

    /// Current error state, if any (typed as APIError for consistent error handling)
    var error: APIError? { get }

    /// Returns true if the store has an error and no data to display
    var hasError: Bool { get }

    /// Loads data only if cache is stale or not yet loaded
    func loadIfNeeded() async

    /// Forces a fresh data load, bypassing cache
    func forceRefresh() async

    /// Invalidates the cache so the next `loadIfNeeded()` re-fetches — call
    /// when a mutation elsewhere makes this store's data stale (PUL-270)
    func invalidateCache()

    /// Clears all cached data — call when the user logs out
    func reset()
}
