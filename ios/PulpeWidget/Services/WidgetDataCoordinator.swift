import Foundation

struct WidgetDataCoordinator: Sendable {
    static let appGroupId = "group.app.pulpe.ios"
    private static let cacheKey = "widget_budget_cache"

    private var sharedDefaults: UserDefaults? {
        UserDefaults(suiteName: Self.appGroupId)
    }

    func save(_ cache: WidgetDataCache) {
        guard let defaults = sharedDefaults else { return }
        do {
            let data = try JSONEncoder().encode(cache)
            defaults.set(data, forKey: Self.cacheKey)
        } catch {
            print("WidgetDataCoordinator: Failed to encode cache - \(error)")
        }
    }

    func load() -> WidgetDataCache? {
        guard let defaults = sharedDefaults,
              let data = defaults.data(forKey: Self.cacheKey) else {
            return nil
        }
        do {
            return try JSONDecoder().decode(WidgetDataCache.self, from: data)
        } catch {
            print("WidgetDataCoordinator: Failed to decode cache - \(error)")
            return nil
        }
    }

    func clear() {
        sharedDefaults?.removeObject(forKey: Self.cacheKey)
    }
}
