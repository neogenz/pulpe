import Foundation

/// Reactive rollout flag backed by PostHog via `AnalyticsService`.
///
/// - **Persistence**: the last known value is cached in `UserDefaults` so it is available
///   synchronously at boot, before PostHog resolves its flags. It is also the only way to
///   force the flag on Local and Preview builds, where PostHog is off.
/// - **Refresh triggers**: call `refresh()` after `AnalyticsService.identify()` (so
///   person-property flags re-evaluate) and on each foreground transition.
/// - **Safe default**: `false` until PostHog has said otherwise.
@Observable @MainActor
final class FeatureFlagsStore {
    /// Mirror of `FEATURE_FLAGS.NET_WORTH` in `shared/src/feature-flags.ts`.
    static let netWorthKey = "net_worth"

    private static let storagePrefix = "pulpe.feature_flags."

    private(set) var isNetWorthEnabled: Bool

    private let analytics: AnalyticsService
    private let defaults: UserDefaults

    init(
        analytics: AnalyticsService = .shared,
        defaults: UserDefaults = .standard
    ) {
        self.analytics = analytics
        self.defaults = defaults
        self.isNetWorthEnabled = defaults.bool(forKey: Self.storagePrefix + Self.netWorthKey)
    }

    /// Applies the SDK's current cache at once, then again once the network answer lands.
    /// No-op while PostHog is not initialized, so a cached value is never flipped back.
    func refresh() {
        guard analytics.isInitialized else { return }
        applyCurrentFlags()
        analytics.reloadFeatureFlags {
            self.applyCurrentFlags()
        }
    }

    /// Logout: the next account must not inherit this one's rollout.
    func reset() {
        isNetWorthEnabled = false
        defaults.removeObject(forKey: Self.storagePrefix + Self.netWorthKey)
    }

    private func applyCurrentFlags() {
        let resolved = analytics.isFeatureEnabled(Self.netWorthKey)
        isNetWorthEnabled = resolved
        defaults.set(resolved, forKey: Self.storagePrefix + Self.netWorthKey)
    }
}
