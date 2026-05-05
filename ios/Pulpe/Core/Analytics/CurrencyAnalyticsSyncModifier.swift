import SwiftUI

/// Mirrors currency-related state to PostHog as person properties.
///
/// Applied once near the authenticated app root. The modifier observes the
/// canonical sources of truth — `UserSettingsStore` for `currency` and
/// `showCurrencySelector`, `FeatureFlagsStore` for the
/// `multi-currency-enabled` flag — and pushes a `$set` whenever any of them
/// changes. `AnalyticsService.setPersonProperties` already no-ops until the
/// user has been identified, so the modifier is safe to mount before
/// authentication completes; the SDK also dedupes identical payloads, so
/// the redundant call on initial appearance is free.
///
/// Centralizing the sync here keeps the responsibility off `RootView` and
/// out of every store mutation site (settings page picker, onboarding
/// completion, future cross-device sync) — a single observer subscribed to
/// the canonical state.
struct CurrencyAnalyticsSyncModifier: ViewModifier {
    @Environment(UserSettingsStore.self) private var userSettingsStore
    @Environment(FeatureFlagsStore.self) private var featureFlagsStore

    func body(content: Content) -> some View {
        content
            .onChange(of: userSettingsStore.currency, initial: true) { _, _ in
                pushPersonProperties()
            }
            .onChange(of: userSettingsStore.showCurrencySelector) { _, _ in
                pushPersonProperties()
            }
            .onChange(of: featureFlagsStore.isMultiCurrencyEnabled) { _, _ in
                pushPersonProperties()
            }
    }

    private func pushPersonProperties() {
        AnalyticsService.shared.setPersonProperties([
            AnalyticsService.currencyProperty: userSettingsStore.currency.rawValue,
            AnalyticsService.showCurrencySelectorProperty: userSettingsStore.showCurrencySelector,
            AnalyticsService.multiCurrencyEnabledProperty: featureFlagsStore.isMultiCurrencyEnabled
        ])
    }
}

extension View {
    /// Keeps PostHog person properties in sync with the user's currency state.
    /// See `CurrencyAnalyticsSyncModifier` for behavior.
    func syncCurrencyAnalytics() -> some View {
        modifier(CurrencyAnalyticsSyncModifier())
    }
}
