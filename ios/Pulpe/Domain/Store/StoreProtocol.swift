import Foundation

/// Protocol for stores that manage cached data with smart loading
@MainActor
protocol StoreProtocol: Observable {
    /// Indicates if the store is currently loading data
    var isLoading: Bool { get }

    /// Current error state, if any
    var error: Error? { get }

    /// Loads data only if cache is stale or not yet loaded
    func loadIfNeeded() async

    /// Forces a fresh data load, bypassing cache
    func forceRefresh() async
}
