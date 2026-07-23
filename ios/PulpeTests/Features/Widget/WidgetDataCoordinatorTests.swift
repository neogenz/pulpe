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

    // MARK: - Back-compat decoding

    private func encodedObject(_ value: some Encodable) throws -> [String: Any] {
        let data = try JSONEncoder().encode(value)
        let object = try JSONSerialization.jsonObject(with: data)
        return try #require(object as? [String: Any])
    }

    @Test("old-format cache (no payDayOfMonth key) still decodes, payDayOfMonth defaults to nil")
    func decode_oldFormatCache_missingPayDayOfMonth() throws {
        let cache = WidgetDataCache(currentMonth: nil, yearBudgets: [], lastUpdated: Date(), currency: .eur)
        var object = try encodedObject(cache)
        object.removeValue(forKey: "payDayOfMonth")
        let data = try JSONSerialization.data(withJSONObject: object)

        let decoded = try JSONDecoder().decode(WidgetDataCache.self, from: data)

        #expect(decoded.payDayOfMonth == nil)
        #expect(decoded.currency == .eur)
    }

    // MARK: - currentMonthMatches

    private func makeMonthData(month: Int, year: Int) -> BudgetWidgetData {
        BudgetWidgetData(
            id: "budget-\(month)-\(year)",
            month: month,
            year: year,
            available: 100,
            monthName: "\(month)/\(year)",
            shortMonthName: "\(month)",
            isCurrentMonth: false
        )
    }

    private func date(year: Int, month: Int, day: Int) throws -> Date {
        try #require(
            Calendar.current.date(from: DateComponents(year: year, month: month, day: day, hour: 12))
        )
    }

    @Test("payDay 25, cache = July: July 26 no longer matches (current period is August)")
    func currentMonthMatches_payDayCrossed_returnsFalse() throws {
        let cache = WidgetDataCache(
            currentMonth: makeMonthData(month: 7, year: 2026),
            yearBudgets: [],
            lastUpdated: Date(),
            payDayOfMonth: 25
        )
        let july26 = try date(year: 2026, month: 7, day: 26)

        #expect(cache.currentMonthMatches(july26) == false)
    }

    @Test("payDay 25, cache = July: July 20 still matches")
    func currentMonthMatches_payDayNotCrossed_returnsTrue() throws {
        let cache = WidgetDataCache(
            currentMonth: makeMonthData(month: 7, year: 2026),
            yearBudgets: [],
            lastUpdated: Date(),
            payDayOfMonth: 25
        )
        let july20 = try date(year: 2026, month: 7, day: 20)

        #expect(cache.currentMonthMatches(july20) == true)
    }

    @Test("payDay nil, cache = current calendar month: matches today")
    func currentMonthMatches_nilPayDay_matchesCalendarMonth() {
        let now = Date()
        let calendar = Calendar.current
        let cache = WidgetDataCache(
            currentMonth: makeMonthData(
                month: calendar.component(.month, from: now),
                year: calendar.component(.year, from: now)
            ),
            yearBudgets: [],
            lastUpdated: Date(),
            payDayOfMonth: nil
        )

        #expect(cache.currentMonthMatches(now) == true)
    }

    @Test("no currentMonth cached: never matches")
    func currentMonthMatches_nilCurrentMonth_returnsFalse() {
        let cache = WidgetDataCache(currentMonth: nil, yearBudgets: [], lastUpdated: Date())
        #expect(cache.currentMonthMatches(Date()) == false)
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
