import Foundation
@testable import Pulpe
import Testing

@MainActor
struct FeatureFlagsStoreTests {
    private func makeDefaults() -> UserDefaults {
        let name = "flags-\(UUID().uuidString)"
        let defaults = UserDefaults(suiteName: name) ?? .standard
        defaults.removePersistentDomain(forName: name)
        return defaults
    }

    @Test func init_readsTheCachedValue() {
        let defaults = makeDefaults()
        defaults.set(true, forKey: "pulpe.feature_flags.net_worth")

        #expect(FeatureFlagsStore(defaults: defaults).isNetWorthEnabled)
    }

    @Test func init_defaultsToOff() {
        #expect(FeatureFlagsStore(defaults: makeDefaults()).isNetWorthEnabled == false)
    }

    /// Local and Preview run without PostHog: the cached override must never flip back.
    @Test func refresh_withoutAnalytics_leavesTheCachedValue() {
        let defaults = makeDefaults()
        defaults.set(true, forKey: "pulpe.feature_flags.net_worth")
        // A fresh service never ran `initialize()`; the shared one may have in the test host.
        let store = FeatureFlagsStore(analytics: AnalyticsService(isConfiguredEnabled: false), defaults: defaults)

        store.refresh()

        #expect(store.isNetWorthEnabled)
        #expect(defaults.bool(forKey: "pulpe.feature_flags.net_worth"))
    }

    @Test func reset_clearsTheFlagAndItsCache() {
        let defaults = makeDefaults()
        defaults.set(true, forKey: "pulpe.feature_flags.net_worth")
        let store = FeatureFlagsStore(defaults: defaults)

        store.reset()

        #expect(store.isNetWorthEnabled == false)
        #expect(defaults.object(forKey: "pulpe.feature_flags.net_worth") == nil)
    }
}
