import Foundation
@testable import Pulpe
import Testing

struct NotificationSchedulerTests {
    // The clamp is the single guard against a reminder that silently goes dark:
    // a day-31 calendar trigger never fires in February. Pin it so a future
    // "simplification" of min/max fails loudly.
    @Test(
        "monthlyFireDay clamps so the reminder fires every single month",
        arguments: [
            (31, 28), (30, 28), (29, 28), (28, 28), (15, 15), (1, 1), (0, 1),
        ]
    )
    func monthlyFireDay_clampsToAlwaysFiringDay(payDay: Int, expected: Int) {
        let fireDay = NotificationScheduler.monthlyFireDay(for: payDay)
        #expect(fireDay == expected)
    }

    // `reminder_opened` dashboards read this mapping: a renamed id would silently stop
    // counting the taps it stands for.
    @Test(arguments: [
        ("pulpe.reminder.monthly", NotificationScheduler.Reminder.monthly),
        ("pulpe.reminder.weekly-recap.0", .weeklyRecap),
        ("pulpe.reminder.weekly-recap.2", .weeklyRecap),
        ("pulpe.reminder.weekly-recap.3", nil),
        ("some.other.app.request", nil),
    ])
    func reminderOfRequest_mapsEveryScheduledIdOnly(id: String, expected: NotificationScheduler.Reminder?) {
        #expect(NotificationScheduler.reminder(ofRequest: id) == expected)
    }
}
