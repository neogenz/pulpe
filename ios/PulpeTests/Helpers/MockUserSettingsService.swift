import Foundation
@testable import Pulpe

/// Test double for `UserSettingsServicing`. Records call counts and the last
/// `UpdateUserSettings` payload so suites can assert optimistic-update behaviour.
actor MockUserSettingsService: UserSettingsServicing {
    private var stubbedGetSettings: UserSettings
    private var stubbedUpdateSettings: UserSettings
    private var updateError: Error?
    private(set) var getSettingsCallCount = 0
    private(set) var updateSettingsCallCount = 0
    private(set) var lastUpdatePayload: UpdateUserSettings?

    init(
        stubbedGetSettings: UserSettings = UserSettings(
            payDayOfMonth: nil,
            currency: .chf,
            showCurrencySelector: false
        ),
        stubbedUpdateSettings: UserSettings = UserSettings(
            payDayOfMonth: nil,
            currency: .chf,
            showCurrencySelector: false
        )
    ) {
        self.stubbedGetSettings = stubbedGetSettings
        self.stubbedUpdateSettings = stubbedUpdateSettings
    }

    func setUpdateError(_ error: Error?) { updateError = error }
    func setStubbedUpdateSettings(_ settings: UserSettings) { stubbedUpdateSettings = settings }

    func getSettings() async throws -> UserSettings {
        getSettingsCallCount += 1
        return stubbedGetSettings
    }

    func updateSettings(_ settings: UpdateUserSettings) async throws -> UserSettings {
        updateSettingsCallCount += 1
        lastUpdatePayload = settings
        if let error = updateError { throw error }
        return stubbedUpdateSettings
    }
}
