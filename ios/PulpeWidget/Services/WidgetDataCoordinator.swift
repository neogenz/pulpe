import Foundation
import OSLog

struct WidgetDataCoordinator: Sendable {
    static let appGroupId = "group.app.pulpe.ios"
    private static let cacheKey = "widget_budget_cache"
    private static let logger = Logger(subsystem: "app.pulpe.ios.widget", category: "data")
    private static let sharedDefaults: UserDefaults? = {
        guard let defaults = UserDefaults(suiteName: appGroupId) else {
            logger.fault("Failed to create UserDefaults for App Group '\(appGroupId)'")
            return nil
        }
        return defaults
    }()

    @discardableResult
    func save(_ cache: WidgetDataCache) -> Bool {
        guard let defaults = WidgetDataCoordinator.sharedDefaults else { return false }
        do {
            let data = try JSONEncoder().encode(cache)
            defaults.set(data, forKey: Self.cacheKey)
            return true
        } catch {
            Self.logger.error("Failed to encode cache - \(error)")
            return false
        }
    }

    func load() -> WidgetDataCache? {
        guard let defaults = WidgetDataCoordinator.sharedDefaults else { return nil }
        guard let data = defaults.data(forKey: Self.cacheKey) else { return nil }
        do {
            return try JSONDecoder().decode(WidgetDataCache.self, from: data)
        } catch {
            Self.logger.error("Failed to decode cache - \(error)")
            return nil
        }
    }

    func clear() {
        guard let defaults = WidgetDataCoordinator.sharedDefaults else { return }
        defaults.removeObject(forKey: Self.cacheKey)
    }
}
