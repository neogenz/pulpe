import Foundation

/// Reactive feature flag store backed by PostHog via `AnalyticsService`.
///
/// - **Persistence**: the last known flag state is cached in `UserDefaults`
///   so the value is available synchronously at boot (before PostHog resolves
///   its flags), avoiding a visible flicker when toggling gated UX.
/// - **Refresh triggers**: `refresh()` should be called after
///   `AnalyticsService.identify()` (so person-property-based flags re-evaluate
///   with the new user identity) and on each foreground transition.
/// - **Safe default**: every flag starts as `false`. A user who has never
///   been seen by PostHog sees the pre-flag experience until the first fetch
///   completes.
@Observable @MainActor
final class FeatureFlagsStore {
    static let multiCurrencyKey = "multi-currency-enabled"

    private static let storagePrefix = "pulpe.feature_flags."

    private(set) var isMultiCurrencyEnabled: Bool

    private let analytics: AnalyticsService
    private let defaults: UserDefaults

    init(
        analytics: AnalyticsService = .shared,
        defaults: UserDefaults = .standard
    ) {
        self.analytics = analytics
        self.defaults = defaults
        self.isMultiCurrencyEnabled = defaults.bool(
            forKey: Self.storagePrefix + Self.multiCurrencyKey
        )
    }

    /// Re-fetches feature flags from PostHog and updates the cached values.
    /// Persists the resolved values in `UserDefaults` for the next launch.
    /// No-op when PostHog is not initialized — preserves the cached value
    /// instead of clobbering it to `false` (which would mask manual overrides
    /// on PulpeLocal where PostHog is disabled).
    func refresh() {
        guard analytics.isInitialized else { return }
        analytics.reloadFeatureFlags()
        let resolved = analytics.isFeatureEnabled(Self.multiCurrencyKey)
        isMultiCurrencyEnabled = resolved
        defaults.set(resolved, forKey: Self.storagePrefix + Self.multiCurrencyKey)
    }
}
