import Foundation
@testable import Pulpe
import Testing

@Suite(.serialized)
struct ReminderPreferencesTests {
    @Test func revokedAuthorizationDisablesPersistedReminders() throws {
        let (defaults, suiteName) = try makeDefaults()
        defer { defaults.removePersistentDomain(forName: suiteName) }
        let sut = ReminderPreferences(defaults: defaults)
        sut.setRemindersEnabled(true)

        let reconciledValue = sut.reconcileAuthorization(isAuthorized: false)

        #expect(reconciledValue == false)
        #expect(sut.remindersEnabled == false)
    }

    @Test func authorizedRemindersStayEnabled() throws {
        let (defaults, suiteName) = try makeDefaults()
        defer { defaults.removePersistentDomain(forName: suiteName) }
        let sut = ReminderPreferences(defaults: defaults)
        sut.setRemindersEnabled(true)

        let reconciledValue = sut.reconcileAuthorization(isAuthorized: true)

        #expect(reconciledValue == true)
        #expect(sut.remindersEnabled == true)
    }

    private func makeDefaults() throws -> (UserDefaults, String) {
        let suiteName = "ReminderPreferencesTests-\(UUID().uuidString)"
        let defaults = try #require(UserDefaults(suiteName: suiteName))
        return (defaults, suiteName)
    }
}
