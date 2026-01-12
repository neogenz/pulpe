import Foundation

struct WidgetDataCoordinator: Sendable {
    static let appGroupId = "group.app.pulpe.ios"
    private static let cacheKey = "widget_budget_cache"

    private var sharedDefaults: UserDefaults? {
        guard let defaults = UserDefaults(suiteName: Self.appGroupId) else {
            #if DEBUG
            print("WidgetDataCoordinator: CRITICAL - Failed to create UserDefaults for App Group '\(Self.appGroupId)'")
            #endif
            return nil
        }
        return defaults
    }

    @discardableResult
    func save(_ cache: WidgetDataCache) -> Bool {
        guard let defaults = sharedDefaults else { return false }
        do {
            let data = try JSONEncoder().encode(cache)
            defaults.set(data, forKey: Self.cacheKey)
            return true
        } catch {
            #if DEBUG
            print("WidgetDataCoordinator: Failed to encode cache - \(error)")
            #endif
            return false
        }
    }

    func load() -> WidgetDataCache? {
        guard let defaults = sharedDefaults else { return nil }
        guard let data = defaults.data(forKey: Self.cacheKey) else { return nil }
        do {
            return try JSONDecoder().decode(WidgetDataCache.self, from: data)
        } catch {
            #if DEBUG
            print("WidgetDataCoordinator: Failed to decode cache - \(error)")
            #endif
            return nil
        }
    }

    func clear() {
        guard let defaults = sharedDefaults else { return }
        defaults.removeObject(forKey: Self.cacheKey)
    }
}
