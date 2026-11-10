import Foundation

/// Events emitted from a view's action, behind a `send` seam so a test can assert the
/// emission without PostHog (same pattern as `OnboardingState.previousStep(send:)`).
extension AnalyticsService {
    static func captureRecoveryKeyAcknowledged(
        send: (AnalyticsEvent, [String: Any]) -> Void = { shared.capture($0, properties: $1) }
    ) {
        send(.recoveryKeyAcknowledged, [:])
    }

    static func captureOnboardingHandoffCompleted(
        widgetHelpOpened: Bool,
        send: (AnalyticsEvent, [String: Any]) -> Void = { shared.capture($0, properties: $1) }
    ) {
        send(.onboardingHandoffCompleted, ["widget_help_opened": widgetHelpOpened])
    }
}
