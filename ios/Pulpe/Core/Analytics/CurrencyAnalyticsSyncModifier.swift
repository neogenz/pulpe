import SwiftUI

/// Mirrors the user's display preferences to PostHog as person properties.
///
/// Applied once near the authenticated app root. The modifier observes the
/// canonical source of truth — `UserSettingsStore` for `currency`,
/// `showCurrencySelector` and `locale` — and pushes a `$set` whenever any changes.
/// `AnalyticsService.setPersonProperties` caches the current values before
/// identification and republishes them after a later opt-in, so the modifier
/// is safe to mount before authentication completes.
///
/// Centralizing the sync here keeps the responsibility off `RootView` and
/// out of every store mutation site (settings page picker, onboarding
/// completion, future cross-device sync) — a single observer subscribed to
/// the canonical state.
struct CurrencyAnalyticsSyncModifier: ViewModifier {
    @Environment(UserSettingsStore.self) private var userSettingsStore

    func body(content: Content) -> some View {
        content
            .onChange(of: userSettingsStore.currency, initial: true) { _, _ in
                pushPersonProperties()
            }
            .onChange(of: userSettingsStore.showCurrencySelector) { _, _ in
                pushPersonProperties()
            }
            .onChange(of: userSettingsStore.locale) { _, _ in
                pushPersonProperties()
            }
    }

    private func pushPersonProperties() {
        AnalyticsService.shared.setPersonProperties([
            AnalyticsService.currencyProperty: userSettingsStore.currency.rawValue,
            AnalyticsService.showCurrencySelectorProperty: userSettingsStore.showCurrencySelector,
            AnalyticsService.localeProperty: userSettingsStore.locale.rawValue
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
