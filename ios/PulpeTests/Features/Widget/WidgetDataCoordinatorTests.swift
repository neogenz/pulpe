import Foundation
import Testing
@testable import Pulpe

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
    // NOTE: WidgetDataCoordinator uses UserDefaults(suiteName:) with app group
    // "group.app.pulpe.ios". In the test environment, the app group entitlement
    // is unavailable, so sharedDefaults() returns nil and all operations
    // gracefully degrade. These tests verify that graceful degradation.

    @Test("save returns false when app group defaults unavailable")
    func save_whenAppGroupUnavailable_returnsFalse() {
        let coordinator = WidgetDataCoordinator()
        let cache = WidgetDataCache.empty
        let result = coordinator.save(cache)
        // In test environment without the app group entitlement,
        // save() returns false gracefully
        #expect(result == false)
    }

    @Test("load returns nil when app group defaults unavailable")
    func load_whenAppGroupUnavailable_returnsNil() {
        let coordinator = WidgetDataCoordinator()
        let result = coordinator.load()
        #expect(result == nil)
    }

    @Test("clear then load returns nil when app group defaults unavailable")
    func clear_whenAppGroupUnavailable_loadReturnsNil() {
        let coordinator = WidgetDataCoordinator()
        coordinator.clear()
        #expect(coordinator.load() == nil)
    }
}
