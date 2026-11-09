@testable import Pulpe
import Testing

@MainActor
struct AnalyticsViewEventsTests {
    @Test func recoveryKeyAcknowledged_emitsOnceWithoutProperties() {
        var sent: [(AnalyticsEvent, [String: Any])] = []
        AnalyticsService.captureRecoveryKeyAcknowledged { sent.append(($0, $1)) }
        #expect(sent.count == 1)
        #expect(sent[0].0 == .recoveryKeyAcknowledged)
        #expect(sent[0].1.isEmpty)
    }

    @Test(arguments: [true, false])
    func onboardingHandoffCompleted_emitsOnceWithWidgetHelpFlag(opened: Bool) {
        var sent: [(AnalyticsEvent, [String: Any])] = []
        AnalyticsService.captureOnboardingHandoffCompleted(widgetHelpOpened: opened) { sent.append(($0, $1)) }
        #expect(sent.count == 1)
        #expect(sent[0].0 == .onboardingHandoffCompleted)
        #expect(sent[0].1["widget_help_opened"] as? Bool == opened)
    }
}
