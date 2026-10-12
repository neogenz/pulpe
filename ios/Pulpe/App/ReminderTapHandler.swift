import Foundation
import Observation
import UserNotifications

/// Counts the taps that bring the user back from a reminder, the retention signal the
/// reminders exist for, and opens the current month. No `willPresent`: a reminder firing
/// while the app is open stays silent, as it did without a delegate.
///
/// Main actor on purpose: UIKit aborts unless the completion behind this async method runs
/// on the main thread, and a nonisolated witness returns from the cooperative pool.
@MainActor
final class ReminderTapHandler: NSObject, @MainActor UNUserNotificationCenterDelegate {
    private static let shared = ReminderTapHandler()

    /// From `PulpeApp.init`: the delegate must be set before launch finishes, or the tap
    /// that cold-launches the app is never delivered.
    static func install() {
        UNUserNotificationCenter.current().delegate = shared
    }

    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse
    ) async {
        guard let reminder = NotificationScheduler.reminder(ofRequest: response.notification.request.identifier)
        else { return }
        AnalyticsService.shared.capture(.reminderOpened, properties: ["reminder": reminder.rawValue])
        PendingReminderTap.shared.opensCurrentMonth = true
    }
}

/// Every reminder is about the current month. `MainTabView` consumes the tap: it only exists
/// past the PIN, so a tap that cold-launched the app lands once the user has unlocked.
@MainActor @Observable
final class PendingReminderTap {
    static let shared = PendingReminderTap()
    var opensCurrentMonth = false
}
