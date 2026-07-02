import Foundation
@testable import Pulpe
import Testing

@Suite("UserSettingsStore — showCurrencySelector mutation")
@MainActor
struct UserSettingsStoreTests {
    @Test func updateShowCurrencySelector_onSuccess_updatesValueAndTimestamp() async {
        // Arrange
        let mockService = MockUserSettingsService(
            stubbedUpdateSettings: UserSettings(
                payDayOfMonth: nil,
                currency: .chf,
                showCurrencySelector: true,
                checkingEnabled: true
            )
        )
        let store = UserSettingsStore(service: mockService)

        // Act
        await store.updateShowCurrencySelector(true)

        // Assert
        #expect(store.showCurrencySelector == true)
        #expect(store.error == nil)
        #expect(await mockService.updateSettingsCallCount == 1)
        let payload = await mockService.lastUpdatePayload
        #expect(payload?.showCurrencySelector == true)
    }

    @Test func updateShowCurrencySelector_onFailure_revertsOptimisticUpdate() async {
        // Arrange — service starts false, backend will reject
        let mockService = MockUserSettingsService()
        await mockService.setUpdateError(APIError.networkError(URLError(.notConnectedToInternet)))
        let store = UserSettingsStore(service: mockService)

        // Act
        await store.updateShowCurrencySelector(true)

        // Assert — optimistic flip reverted to the initial `false`
        #expect(store.showCurrencySelector == false)
        #expect(store.error != nil)
    }

    @Test func updateCheckingEnabled_onSuccess_updatesValueAndSendsPayload() async {
        // Arrange
        let mockService = MockUserSettingsService(
            stubbedUpdateSettings: UserSettings(
                payDayOfMonth: nil,
                currency: .chf,
                showCurrencySelector: false,
                checkingEnabled: false
            )
        )
        let store = UserSettingsStore(service: mockService)
        #expect(store.checkingEnabled == true)

        // Act
        await store.updateCheckingEnabled(false)

        // Assert
        #expect(store.checkingEnabled == false)
        #expect(store.error == nil)
        #expect(await mockService.updateSettingsCallCount == 1)
        let payload = await mockService.lastUpdatePayload
        #expect(payload?.checkingEnabled == false)
    }

    @Test func updateCheckingEnabled_onFailure_revertsOptimisticUpdate() async {
        // Arrange — store starts enabled, backend will reject
        let mockService = MockUserSettingsService()
        await mockService.setUpdateError(APIError.networkError(URLError(.notConnectedToInternet)))
        let store = UserSettingsStore(service: mockService)

        // Act
        await store.updateCheckingEnabled(false)

        // Assert — optimistic flip reverted to the initial `true`
        #expect(store.checkingEnabled == true)
        #expect(store.error != nil)
    }

    @Test func showCurrencySelectorEffective_gatedByFeatureFlag_returnsFalseWhenFlagOff() async throws {
        // Arrange — fresh UserDefaults suite to control the feature flag without touching prod defaults
        let suiteName = "pulpe.tests.\(UUID().uuidString)"
        let defaults = try #require(UserDefaults(suiteName: suiteName))
        defer { defaults.removePersistentDomain(forName: suiteName) }
        // Flag OFF (no key set → UserDefaults.bool returns false)
        let featureFlags = FeatureFlagsStore(defaults: defaults)
        #expect(featureFlags.isMultiCurrencyEnabled == false)

        let mockService = MockUserSettingsService(
            stubbedUpdateSettings: UserSettings(
                payDayOfMonth: nil,
                currency: .chf,
                showCurrencySelector: true,
                checkingEnabled: true
            )
        )
        let store = UserSettingsStore(service: mockService, featureFlags: featureFlags)

        // Act — flip the raw preference to true
        await store.updateShowCurrencySelector(true)

        // Assert — raw preference is true, but the effective flag is gated OFF by the feature flag
        #expect(store.showCurrencySelector == true)
        #expect(store.showCurrencySelectorEffective == false)
    }
}
