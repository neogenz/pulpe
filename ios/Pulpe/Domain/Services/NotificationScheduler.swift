import Foundation
import UserNotifications

/// Schedules Pulpe's local re-engagement notifications.
///
/// LOCAL only — no APNs, no backend, no server knowledge required. Every reminder
/// the app needs today is date-computable on device from data it already holds (the
/// pay-day cycle), so a `UNCalendarNotificationTrigger` covers it with zero server
/// infrastructure. Remote push is deliberately not built (single-user, iOS-primary).
///
/// Mirrors the `.shared` actor pattern of `BackgroundTaskService`. Authorization is
/// requested contextually — after the user's first real "pointer" — never at launch,
/// because iOS grants exactly one prompt and a cold denial is permanent.
actor NotificationScheduler {
    static let shared = NotificationScheduler()

    private let center = UNUserNotificationCenter.current()

    /// Stable identifier so re-scheduling replaces the reminder instead of stacking
    /// duplicates — safe to call on every foreground.
    private static let monthlyReminderId = "pulpe.reminder.monthly"

    private init() {}

    // MARK: - Authorization

    func authorizationStatus() async -> UNAuthorizationStatus {
        await center.notificationSettings().authorizationStatus
    }

    /// Requests alert/sound/badge authorization. Returns whether it was granted. The
    /// OS only shows its one-shot prompt when the status is `.notDetermined`; always
    /// call this behind a value-framed pre-permission screen, never cold.
    func requestAuthorization() async -> Bool {
        (try? await center.requestAuthorization(options: [.alert, .sound, .badge])) ?? false
    }

    // MARK: - Scheduling

    /// (Re)schedules the monthly "nouveau mois" reminder on the user's pay-day at
    /// 9:00. Copy is evergreen and forward-framed (never an overspend audit): the
    /// notification fires up to a month after scheduling, at the *start* of a new
    /// budget cycle, so it deliberately carries no amount — last month's figure would
    /// be stale and the new month isn't built yet. No-op unless authorized. Replaces
    /// any existing monthly reminder (stable id) — safe to call on every foreground.
    func scheduleMonthlyReminder(payDay: Int) async {
        guard await authorizationStatus() == .authorized else { return }

        let content = UNMutableNotificationContent()
        content.title = "Nouveau mois"
        content.body = "Ton budget du mois t'attend. Fais le point en 30 secondes."
        content.sound = .default

        var dateComponents = DateComponents()
        dateComponents.day = Self.monthlyFireDay(for: payDay)
        dateComponents.hour = 9
        let trigger = UNCalendarNotificationTrigger(dateMatching: dateComponents, repeats: true)

        let request = UNNotificationRequest(
            identifier: Self.monthlyReminderId,
            content: content,
            trigger: trigger
        )

        center.removePendingNotificationRequests(withIdentifiers: [Self.monthlyReminderId])
        try? await center.add(request)
    }

    func cancelAll() {
        center.removeAllPendingNotificationRequests()
    }

    /// Pay-day is stored 1–31, but a `day` of 29/30/31 would silently skip months
    /// that lack that date (a day-31 trigger never fires in February). Clamp to 28 so
    /// the "new month" nudge fires every single month — at worst a couple of days
    /// early for high pay-days, which is fine for a start-of-cycle reminder.
    static func monthlyFireDay(for payDay: Int) -> Int {
        min(max(payDay, 1), 28)
    }
}
