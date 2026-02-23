import Foundation
@testable import Pulpe
import Testing

struct WidgetDataCacheTests {
    private func makeCache(lastUpdated: Date) -> WidgetDataCache {
        WidgetDataCache(currentMonth: nil, yearBudgets: [], lastUpdated: lastUpdated)
    }

    // MARK: - Staleness

    @Test("cache updated just now is not stale")
    func recentCache_isNotStale() {
        let cache = makeCache(lastUpdated: Date())
        #expect(cache.isStale == false)
    }

    @Test("cache older than one hour is stale")
    func oldCache_isStale() {
        let oneHourAgo = Date().addingTimeInterval(-3601)
        let cache = makeCache(lastUpdated: oneHourAgo)
        #expect(cache.isStale == true)
    }

    @Test("cache updated 59 minutes ago is not stale")
    func cacheJustUnderOneHour_isNotStale() {
        let cache = makeCache(lastUpdated: Date().addingTimeInterval(-3599))
        #expect(cache.isStale == false)
    }
}

struct WidgetDataCoordinatorTests {
    // Use a unique suite name per test to avoid cross-test contamination.
    // UserDefaults(suiteName:) always succeeds for non-empty strings,
    // so we test save/load/clear roundtrip behavior instead.

    private func makeCoordinator() -> WidgetDataCoordinator {
        WidgetDataCoordinator(appGroupId: "test.widget.\(UUID().uuidString)")
    }

    @Test("save succeeds and load returns saved cache")
    func saveAndLoad_roundtrip() {
        let coordinator = makeCoordinator()
        let cache = WidgetDataCache.empty
        let saved = coordinator.save(cache)
        #expect(saved == true)

        let loaded = coordinator.load()
        #expect(loaded != nil)
    }

    @Test("load returns nil when no data saved")
    func load_whenEmpty_returnsNil() {
        let coordinator = makeCoordinator()
        let result = coordinator.load()
        #expect(result == nil)
    }

    @Test("clear removes saved data")
    func clear_removesSavedData() {
        let coordinator = makeCoordinator()
        coordinator.save(.empty)
        coordinator.clear()
        #expect(coordinator.load() == nil)
    }
}
