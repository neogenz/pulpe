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
}
