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

    /// The `reminder` analytics dimension. Stable once shipped: dashboards compare it
    /// across releases.
    enum Reminder: String {
        case monthly
        case weeklyRecap = "weekly_recap"
    }

    private init() {}

    /// Which reminder a delivered request is, nil for anything Pulpe didn't schedule.
    static func reminder(ofRequest identifier: String) -> Reminder? {
        if identifier == monthlyReminderId { return .monthly }
        return weeklyRecapIds.contains(identifier) ? .weeklyRecap : nil
    }

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

        // Resolved here, not at delivery: the trigger repeats, so its content is frozen
        // the moment it is scheduled. `NSString.localizedUserNotificationString` would
        // follow the *device* language, not the one chosen in the app. Hence the
        // reschedule on language change, wired in `PulpeApp`.
        let content = UNMutableNotificationContent()
        content.title = AppLocale.string("Nouveau mois")
        content.body = AppLocale.string("Ton budget du mois t'attend. Fais le point en 30 secondes.")
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

    func cancelMonthlyReminder() {
        center.removePendingNotificationRequests(withIdentifiers: [Self.monthlyReminderId])
    }

    // MARK: - Weekly recap

    /// One slot per upcoming Monday, so a reschedule replaces all of them.
    private static let weeklyRecapIds = (0..<3).map { "pulpe.reminder.weekly-recap.\($0)" }

    /// Bumped by every cancel, so a schedule suspended across one knows its figures are stale.
    private var weeklyRecapGeneration = 0

    /// (Re)schedules the next three Monday recaps, each computed for its own date from the
    /// budget snapshot held now. Called on every fresh snapshot (`WidgetDataSyncService.sync`,
    /// background refresh included), which replaces them all. Content is frozen at scheduling,
    /// and that is what keeps the later two exact: they only survive if nothing new was
    /// recorded since, which is the state they describe. The series ends only when no sync
    /// runs for three weeks, rather than repeat figures that old. No-op unless authorized
    /// and signed in.
    func scheduleWeeklyRecaps(
        transactions: [Transaction],
        current: BudgetDetails,
        payDayOfMonth: Int?,
        currency: SupportedCurrency
    ) async {
        // A sync still in flight when the session ends must not bring the figures back. Captured
        // before the session check: every session end signs out first, then cancels.
        let generation = weeklyRecapGeneration
        guard await AuthService.shared.hasPersistedSession() else { return }
        let settings = await center.notificationSettings()
        guard settings.authorizationStatus == .authorized else { return }
        // Lock-screen privacy, like the widget's `.privacySensitive()`: amounts and forecast
        // names only when iOS keeps previews hidden until the phone is unlocked.
        let showDetails = settings.showPreviewsSetting != .always

        center.removePendingNotificationRequests(withIdentifiers: Self.weeklyRecapIds)
        let calendar = Calendar.current
        let firstMonday = Self.nextWeeklyRecapDate(after: Date(), calendar: calendar)
        for (week, id) in Self.weeklyRecapIds.enumerated() {
            guard let fireDate = calendar.date(byAdding: .day, value: 7 * week, to: firstMonday) else { continue }
            let recap = WeeklyRecap.make(
                on: fireDate, transactions: transactions, current: current, payDayOfMonth: payDayOfMonth
            )
            let content = UNMutableNotificationContent()
            content.title = AppLocale.string("Ta semaine en bref")
            content.body = Self.weeklyRecapBody(recap, currency: currency, showDetails: showDetails)
            content.sound = .default

            let trigger = UNCalendarNotificationTrigger(
                dateMatching: calendar.dateComponents([.year, .month, .day, .hour, .minute], from: fireDate),
                repeats: false
            )
            try? await center.add(UNNotificationRequest(identifier: id, content: content, trigger: trigger))
        }
        // A cancel that ran while this call was suspended wins over what it added since.
        if generation != weeklyRecapGeneration {
            center.removePendingNotificationRequests(withIdentifiers: Self.weeklyRecapIds)
        }
    }

    /// Delivered ones too: a recap left in Notification Center keeps showing its amounts.
    func cancelWeeklyRecaps() {
        weeklyRecapGeneration += 1
        center.removePendingNotificationRequests(withIdentifiers: Self.weeklyRecapIds)
        center.removeDeliveredNotifications(withIdentifiers: Self.weeklyRecapIds)
    }

    /// Identity boundary: every request, pending or delivered, belongs to the account leaving.
    func cancelAllReminders() {
        weeklyRecapGeneration += 1
        center.removeAllPendingNotificationRequests()
        center.removeAllDeliveredNotifications()
    }

    /// Next Monday 8:30, today included while 8:30 hasn't passed. Half an hour ahead of
    /// the monthly 9:00 reminder, so a pay-day Monday never stacks both at once.
    static func nextWeeklyRecapDate(after date: Date, calendar: Calendar = .current) -> Date {
        calendar.nextDate(
            after: date,
            matching: DateComponents(hour: 8, minute: 30, weekday: 2),
            matchingPolicy: .nextTime
        ) ?? date
    }

    /// Resolved with `AppLocale` at scheduling, like the monthly copy: delivery-time
    /// localization would follow the device language, not the one chosen in the app.
    /// The next snapshot after a language change re-renders it.
    static func weeklyRecapBody(_ recap: WeeklyRecap, currency: SupportedCurrency, showDetails: Bool) -> String {
        let lastWeek = recap.movementCount > 0
            ? AppLocale.string("Semaine passée : \(recap.movementCount) mouvements notés.")
            : AppLocale.string("Nouvelle semaine : une minute pour noter tes derniers mouvements ?")
        guard showDetails else { return lastWeek }

        var sentences: [String] = []
        if let allowance = recap.weekAllowance {
            let amount = allowance.asCompactCurrency(currency)
            let sentence = if allowance <= 0 {
                AppLocale.string("Ton disponible est épuisé : un coup d'œil pour ajuster ta semaine ?")
            } else if let usual = recap.usualWeekSpending?.asCompactCurrency(currency) {
                AppLocale.string("Cette semaine : environ \(amount) à dépenser (d'habitude, tu en dépenses \(usual)).")
            } else {
                AppLocale.string("Cette semaine : environ \(amount) à dépenser.")
            }
            sentences.append(sentence)
        }
        if !recap.expectedLineNames.isEmpty {
            // ponytail: no cap, a week rarely holds more than a few pointed lines and iOS
            // truncates the collapsed banner itself.
            let names = recap.expectedLineNames.joined(separator: ", ")
            sentences.append(AppLocale.string("Prévu cette semaine : \(names)."))
        }
        // The collapsed banner shows two lines: the week ahead goes first so they carry the
        // amount. A week with nothing noted leads with the nudge, since the figures assume
        // nothing went unrecorded.
        if recap.movementCount > 0 {
            sentences.append(lastWeek)
        } else {
            sentences.insert(lastWeek, at: 0)
        }
        return sentences.joined(separator: " ")
    }

    /// Pay-day is stored 1–31, but a `day` of 29/30/31 would silently skip months
    /// that lack that date (a day-31 trigger never fires in February). Clamp to 28 so
    /// the "new month" nudge fires every single month — at worst a couple of days
    /// early for high pay-days, which is fine for a start-of-cycle reminder.
    static func monthlyFireDay(for payDay: Int) -> Int {
        min(max(payDay, 1), 28)
    }
}
