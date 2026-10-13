import Foundation
@testable import Pulpe
import Testing

@Suite("Feedback prompt preferences", .serialized)
struct FeedbackPromptPreferencesTests {
    @Test
    func presentationGate_blocksSessionRestorationAndPin() {
        #expect(!allowsAutomaticPresentation(isRestoringSession: true))
        #expect(!allowsAutomaticPresentation(isAuthenticated: false))
    }

    @Test
    func presentationGate_blocksRootPresentation() {
        #expect(!allowsAutomaticPresentation(hasBlockingPresentation: true))
    }

    @Test
    func presentationGate_allowsLoadedCalmEligibleHome() {
        #expect(allowsAutomaticPresentation())
    }

    @Test
    func firstInvitation_onTheThirdActiveDay_andSameDayRelaunchesCountOnce() throws {
        let fixture = try makeFixture()
        defer { fixture.cleanup() }
        let base = try date(year: 2026, month: 3, day: 1, hour: 12, calendar: fixture.calendar)

        for hour in [12, 13, 18, 23] {
            let sameDay = try date(year: 2026, month: 3, day: 1, hour: hour, calendar: fixture.calendar)
            fixture.store.recordActiveDay(for: "user", now: sameDay, calendar: fixture.calendar)
        }
        // Gaps between active days do not matter, only their number.
        try recordActiveDays(fixture, "user", offsets: [5], from: base)
        #expect(!fixture.store.isEligible(for: "user"))

        try recordActiveDays(fixture, "user", offsets: [9], from: base)
        #expect(fixture.store.isEligible(for: "user"))
    }

    @Test
    func unansweredInvitation_returnsEveryThreeActiveDays() throws {
        let fixture = try makeFixture()
        defer { fixture.cleanup() }
        let base = try date(year: 2026, month: 4, day: 1, hour: 12, calendar: fixture.calendar)
        try recordActiveDays(fixture, "user", offsets: [0, 1, 2], from: base)

        #expect(fixture.store.isEligible(for: "user"))
        #expect(fixture.store.markAutomaticPromptShown(for: "user") == 1)
        #expect(!fixture.store.isEligible(for: "user"))

        try recordActiveDays(fixture, "user", offsets: [3, 4], from: base)
        #expect(!fixture.store.isEligible(for: "user"))

        try recordActiveDays(fixture, "user", offsets: [5], from: base)
        #expect(fixture.store.isEligible(for: "user"))
        #expect(fixture.store.markAutomaticPromptShown(for: "user") == 2)
    }

    @Test
    func submittedState_stopsInvitations_persistsAcrossInstances_andStaysPerAccount() throws {
        let fixture = try makeFixture()
        defer { fixture.cleanup() }
        let base = try date(year: 2026, month: 5, day: 1, hour: 12, calendar: fixture.calendar)
        try recordActiveDays(fixture, "account-a", offsets: [0, 1, 2], from: base)
        try recordActiveDays(fixture, "account-b", offsets: [0, 1, 2], from: base)

        fixture.store.markSubmitted(for: "account-a")
        try recordActiveDays(fixture, "account-a", offsets: [3, 4, 5, 6], from: base)

        let afterRelaunchOrUpdate = FeedbackPromptPreferences(defaults: fixture.defaults)
        #expect(!afterRelaunchOrUpdate.isEligible(for: "account-a"))
        #expect(afterRelaunchOrUpdate.isEligible(for: "account-b"))
    }

    @Test
    func activeDayHistory_survivesATimeZoneChange() throws {
        let fixture = try makeFixture(timeZoneID: "Europe/Zurich")
        defer { fixture.cleanup() }
        let base = try date(year: 2026, month: 6, day: 1, hour: 12, calendar: fixture.calendar)
        try recordActiveDays(fixture, "traveller", offsets: [0, 1], from: base)

        let newYorkCalendar = makeCalendar(timeZoneID: "America/New_York")
        fixture.store.recordActiveDay(
            for: "traveller",
            now: try day(2, after: base, calendar: fixture.calendar),
            calendar: newYorkCalendar
        )
        #expect(fixture.store.isEligible(for: "traveller"))
    }

    @Test
    func v1History_isRemovedByTheFirstWrite() throws {
        let fixture = try makeFixture()
        defer { fixture.cleanup() }
        let v1Key = "pulpe.feedback-prompt.account-states"
        fixture.defaults.set(Data("{}".utf8), forKey: v1Key)

        fixture.store.recordActiveDay(for: "user", calendar: fixture.calendar)

        #expect(fixture.defaults.object(forKey: v1Key) == nil)
    }

    private func recordActiveDays(
        _ fixture: Fixture,
        _ userID: String,
        offsets: [Int],
        from base: Date
    ) throws {
        for offset in offsets {
            fixture.store.recordActiveDay(
                for: userID,
                now: try day(offset, after: base, calendar: fixture.calendar),
                calendar: fixture.calendar
            )
        }
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

private func allowsAutomaticPresentation(
    isRestoringSession: Bool = false,
    isAuthenticated: Bool = true,
    hasBlockingPresentation: Bool = false
) -> Bool {
    AutomaticFeedbackPromptGate(
        isSceneActive: true,
        isRestoringSession: isRestoringSession,
        isAuthenticated: isAuthenticated,
        isHomeAtRoot: true,
        hasBlockingPresentation: hasBlockingPresentation,
        hasFinishedLoading: true,
        appVersionAllowsPresentation: true,
        whatsNewAllowsPresentation: true,
        isEligible: true
    ).allowsPresentation
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
