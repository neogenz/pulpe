import SwiftUI

// MARK: - Notification priming

extension CurrentMonthView {
    /// After the user's first real "pointer", offer reminders exactly once — behind a
    /// value-framed sheet, and only while the OS prompt is still undecided so we never
    /// burn the one-shot iOS permission cold.
    func maybePrimeReminders() async {
        guard !reminderPrefs.hasPrimedReminders else { return }
        guard await NotificationScheduler.shared.authorizationStatus() == .notDetermined,
              !reminderPrefs.hasPrimedReminders
        else { return }
        reminderPrefs.setHasPrimedReminders()
        AnalyticsService.shared.capture(.notificationPrimeShown)
        activeSheet = .notificationPrime
    }

    /// Fires the real OS prompt (from the "Activer" tap) and schedules the monthly
    /// reminder on grant. On denial we only record it — the toggle in Préférences
    /// stays the recovery path. Permission events gate on `promptShown` like
    /// `applyReminderPreference`: the sheet only appears on `.notDetermined`, but the
    /// status can settle from iOS Settings while it sits open, and a replayed verdict
    /// must not count as a fresh grant/denial.
    func enableReminders() async {
        let promptShown = await NotificationScheduler.shared.authorizationStatus() == .notDetermined
        let granted = await NotificationScheduler.shared.requestAuthorization()
        guard granted else {
            if promptShown {
                AnalyticsService.shared.capture(.notificationPermissionDenied)
            }
            return
        }
        // Same event order as `applyReminderPreference` — permission verdict, then
        // toggle — so an ordered PostHog funnel captures both activation paths.
        if promptShown {
            AnalyticsService.shared.capture(.notificationPermissionGranted)
        }
        reminderPrefs.setRemindersEnabled(true)
        // The sheet's copy promises both. The recap needs a fresh snapshot: the one taken
        // after the pointing that opened this sheet ran while it was still off.
        reminderPrefs.setWeeklyRecapEnabled(true)
        Task { await WidgetDataSyncService.shared.syncAll(payDayOfMonth: userSettingsStore.payDayOfMonth) }
        for reminder in [NotificationScheduler.Reminder.monthly, .weeklyRecap] {
            AnalyticsService.shared.capture(
                .reminderToggled, properties: ["enabled": true, "reminder": reminder.rawValue]
            )
        }
        // Settings not loaded yet → don't schedule for a made-up day 1; prefs are on,
        // so the next foreground reschedule heals with the real pay-day.
        guard let payDay = userSettingsStore.payDayOfMonth else { return }
        await NotificationScheduler.shared.scheduleMonthlyReminder(payDay: payDay)
    }
}
