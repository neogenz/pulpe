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
                locale: nil
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
}

/// Serialized: these tests write the shared `UserDefaults` snapshot that every formatter
/// reads, so two of them running at once would each see the other's language.
@Suite("UserSettingsStore — locale mutation", .serialized)
@MainActor
struct UserSettingsStoreLocaleTests {
    @Test func updateLocale_onSuccess_publishesAndPersists() async {
        let mockService = MockUserSettingsService(
            stubbedUpdateSettings: UserSettings(
                payDayOfMonth: nil,
                currency: .chf,
                showCurrencySelector: false,
                locale: .de
            )
        )
        let store = UserSettingsStore(service: mockService)

        await store.updateLocale(.de)

        #expect(store.locale == .de)
        #expect(AppLocale.current == .de)
        #expect(store.error == nil)
        let payload = await mockService.lastUpdatePayload
        #expect(payload?.locale == .de)

        store.reset()
    }

    /// A backend that answers without `locale` must not snap the interface back to French
    /// — the value we just persisted is the one to keep.
    @Test func updateLocale_partialResponse_keepsThePersistedValue() async {
        let mockService = MockUserSettingsService(
            stubbedUpdateSettings: UserSettings(
                payDayOfMonth: nil,
                currency: .chf,
                showCurrencySelector: false,
                locale: nil
            )
        )
        let store = UserSettingsStore(service: mockService)

        await store.updateLocale(.it)

        #expect(store.locale == .it)
        #expect(AppLocale.current == .it)

        store.reset()
    }

    @Test func updateLocale_onFailure_revertsAndRestoresTheSnapshot() async {
        let mockService = MockUserSettingsService()
        await mockService.setUpdateError(APIError.networkError(URLError(.notConnectedToInternet)))
        let store = UserSettingsStore(service: mockService)
        let previous = store.locale

        await store.updateLocale(.de)

        #expect(store.locale == previous)
        #expect(AppLocale.current == previous)
        #expect(store.error != nil)

        store.reset()
    }

    /// Logging out must not leave the next account booting in this one's language.
    @Test func reset_clearsThePersistedLanguage() async {
        let mockService = MockUserSettingsService(
            stubbedUpdateSettings: UserSettings(
                payDayOfMonth: nil,
                currency: .chf,
                showCurrencySelector: false,
                locale: .de
            )
        )
        let store = UserSettingsStore(service: mockService)
        await store.updateLocale(.de)

        store.reset()

        #expect(store.locale == .fr)
        #expect(AppLocale.current == .fr)
    }
}
