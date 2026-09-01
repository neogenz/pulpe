import Foundation
@testable import Pulpe
import Testing

@Suite("Feedback prompt preferences", .serialized)
struct FeedbackPromptPreferencesTests {
    @Test
    func eligibility_requiresSevenElapsedDays_andFiveActiveDaysInTheRecentWindow() throws {
        let fixture = try makeFixture()
        defer { fixture.cleanup() }
        let base = try date(year: 2026, month: 3, day: 1, hour: 12, calendar: fixture.calendar)

        fixture.store.recordActiveDay(for: "eligible", now: base, calendar: fixture.calendar)
        for offset in [1, 2, 3, 4] {
            fixture.store.recordActiveDay(
                for: "eligible",
                now: try day(offset, after: base, calendar: fixture.calendar),
                calendar: fixture.calendar
            )
        }

        let sixDaysLater = try day(6, after: base, calendar: fixture.calendar)
        #expect(!fixture.store.isEligible(for: "eligible", now: sixDaysLater, calendar: fixture.calendar))

        let sevenDaysLater = try day(7, after: base, calendar: fixture.calendar)
        fixture.store.recordActiveDay(for: "eligible", now: sevenDaysLater, calendar: fixture.calendar)
        #expect(fixture.store.isEligible(for: "eligible", now: sevenDaysLater, calendar: fixture.calendar))

        fixture.store.recordActiveDay(for: "four-days", now: base, calendar: fixture.calendar)
        for offset in [1, 3, 5, 7] {
            fixture.store.recordActiveDay(
                for: "four-days",
                now: try day(offset, after: base, calendar: fixture.calendar),
                calendar: fixture.calendar
            )
        }
        #expect(!fixture.store.isEligible(for: "four-days", now: sevenDaysLater, calendar: fixture.calendar))
    }

    @Test
    func repeatedActivationsSameDay_countOnce_andMidnightCreatesANewDay() throws {
        let fixture = try makeFixture()
        defer { fixture.cleanup() }
        let base = try date(year: 2026, month: 4, day: 1, hour: 12, calendar: fixture.calendar)

        for hour in [12, 13, 18, 23] {
            let sameDay = try date(year: 2026, month: 4, day: 1, hour: hour, calendar: fixture.calendar)
            fixture.store.recordActiveDay(for: "user", now: sameDay, calendar: fixture.calendar)
        }
        for offset in [1, 2, 7] {
            fixture.store.recordActiveDay(
                for: "user",
                now: try day(offset, after: base, calendar: fixture.calendar),
                calendar: fixture.calendar
            )
        }

        let sevenDaysLater = try day(7, after: base, calendar: fixture.calendar)
        #expect(!fixture.store.isEligible(for: "user", now: sevenDaysLater, calendar: fixture.calendar))

        fixture.store.recordActiveDay(for: "midnight", now: base, calendar: fixture.calendar)
        for offset in [1, 2] {
            fixture.store.recordActiveDay(
                for: "midnight",
                now: try day(offset, after: base, calendar: fixture.calendar),
                calendar: fixture.calendar
            )
        }
        let beforeMidnight = try date(year: 2026, month: 4, day: 4, hour: 23, minute: 59, calendar: fixture.calendar)
        let afterMidnight = try date(year: 2026, month: 4, day: 5, hour: 0, minute: 1, calendar: fixture.calendar)
        fixture.store.recordActiveDay(for: "midnight", now: beforeMidnight, calendar: fixture.calendar)
        fixture.store.recordActiveDay(for: "midnight", now: afterMidnight, calendar: fixture.calendar)
        fixture.store.recordActiveDay(for: "midnight", now: sevenDaysLater, calendar: fixture.calendar)
        #expect(fixture.store.isEligible(for: "midnight", now: sevenDaysLater, calendar: fixture.calendar))
    }

    @Test
    func handledState_persistsAcrossInstances_andAccountsRemainIndependent() throws {
        let fixture = try makeFixture()
        defer { fixture.cleanup() }
        let base = try date(year: 2026, month: 5, day: 1, hour: 12, calendar: fixture.calendar)
        let eligibleDate = try seedEligible(
            store: fixture.store,
            userID: "account-a",
            base: base,
            calendar: fixture.calendar
        )

        #expect(fixture.store.isEligible(for: "account-a", now: eligibleDate, calendar: fixture.calendar))
        fixture.store.markAutomaticPromptHandled(for: "account-a", now: eligibleDate)
        fixture.store.markAutomaticPromptHandled(for: "account-a", now: eligibleDate)

        let afterRelaunchOrUpdate = FeedbackPromptPreferences(defaults: fixture.defaults)
        #expect(!afterRelaunchOrUpdate.isEligible(
            for: "account-a",
            now: eligibleDate,
            calendar: fixture.calendar
        ))
        #expect(!afterRelaunchOrUpdate.isEligible(
            for: "account-b",
            now: eligibleDate,
            calendar: fixture.calendar
        ))

        let accountBEligibleDate = try seedEligible(
            store: afterRelaunchOrUpdate,
            userID: "account-b",
            base: base,
            calendar: fixture.calendar
        )
        #expect(afterRelaunchOrUpdate.isEligible(
            for: "account-b",
            now: accountBEligibleDate,
            calendar: fixture.calendar
        ))
    }

    @Test
    func calendarHistory_remainsReadableAfterATimeZoneChange() throws {
        let fixture = try makeFixture(timeZoneID: "Europe/Zurich")
        defer { fixture.cleanup() }
        let base = try date(year: 2026, month: 6, day: 1, hour: 12, calendar: fixture.calendar)
        let eligibleDate = try seedEligible(
            store: fixture.store,
            userID: "traveller",
            base: base,
            calendar: fixture.calendar
        )
        let newYorkCalendar = makeCalendar(timeZoneID: "America/New_York")

        let afterTimeZoneChange = FeedbackPromptPreferences(defaults: fixture.defaults)
        #expect(afterTimeZoneChange.isEligible(
            for: "traveller",
            now: eligibleDate,
            calendar: newYorkCalendar
        ))
    }

    private func seedEligible(
        store: FeedbackPromptPreferences,
        userID: String,
        base: Date,
        calendar: Calendar
    ) throws -> Date {
        store.recordActiveDay(for: userID, now: base, calendar: calendar)
        for offset in [1, 2, 3, 4, 7] {
            store.recordActiveDay(
                for: userID,
                now: try day(offset, after: base, calendar: calendar),
                calendar: calendar
            )
        }
        return try day(7, after: base, calendar: calendar)
    }

    private func makeFixture(timeZoneID: String = "UTC") throws -> Fixture {
        let suiteName = "FeedbackPromptPreferencesTests.\(UUID().uuidString)"
        let defaults = try #require(UserDefaults(suiteName: suiteName))
        defaults.removePersistentDomain(forName: suiteName)
        return Fixture(
            defaults: defaults,
            suiteName: suiteName,
            calendar: makeCalendar(timeZoneID: timeZoneID)
        )
    }

    private func makeCalendar(timeZoneID: String) -> Calendar {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: timeZoneID) ?? TimeZone(secondsFromGMT: 0) ?? .current
        calendar.locale = Locale(identifier: "en_US_POSIX")
        return calendar
    }

    private func date(
        year: Int,
        month: Int,
        day: Int,
        hour: Int,
        minute: Int = 0,
        calendar: Calendar
    ) throws -> Date {
        try #require(calendar.date(from: DateComponents(
            year: year,
            month: month,
            day: day,
            hour: hour,
            minute: minute
        )))
    }

    private func day(_ offset: Int, after date: Date, calendar: Calendar) throws -> Date {
        try #require(calendar.date(byAdding: .day, value: offset, to: date))
    }
}

private struct Fixture {
    let defaults: UserDefaults
    let suiteName: String
    let calendar: Calendar

    var store: FeedbackPromptPreferences {
        FeedbackPromptPreferences(defaults: defaults)
    }

    func cleanup() {
        defaults.removePersistentDomain(forName: suiteName)
    }
}
