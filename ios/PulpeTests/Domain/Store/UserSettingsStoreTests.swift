import Foundation
@testable import Pulpe
import Testing

private actor ControlledUserSettingsService: UserSettingsServicing {
    private var continuations: [SupportedLocale: CheckedContinuation<UserSettings, any Error>] = [:]
    private var waiters: [Int: CheckedContinuation<Void, Never>] = [:]
    private(set) var callCount = 0
    private(set) var remoteLocale: SupportedLocale?

    func getSettings() async throws -> UserSettings {
        UserSettings(payDayOfMonth: nil, currency: .chf, showCurrencySelector: false, locale: nil)
    }

    func updateSettings(_ settings: UpdateUserSettings) async throws -> UserSettings {
        guard let locale = settings.locale else { preconditionFailure("Expected a locale update") }
        callCount += 1
        for expected in waiters.keys.filter({ $0 <= callCount }) {
            waiters.removeValue(forKey: expected)?.resume()
        }
        return try await withCheckedThrowingContinuation { continuations[locale] = $0 }
    }

    func waitForCallCount(_ expected: Int) async {
        guard callCount < expected else { return }
        await withCheckedContinuation { waiters[expected] = $0 }
    }

    func succeed(_ locale: SupportedLocale) {
        remoteLocale = locale
        continuations.removeValue(forKey: locale)?.resume(
            returning: UserSettings(
                payDayOfMonth: nil,
                currency: .chf,
                showCurrencySelector: false,
                locale: locale
            )
        )
    }

    func fail(_ locale: SupportedLocale) {
        continuations.removeValue(forKey: locale)?.resume(
            throwing: APIError.networkError(URLError(.notConnectedToInternet))
        )
    }
}

enum FirstLocaleCompletion: Sendable {
    case success
    case failure
}

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
    @Test("Latest locale is the last serialized write")
    func updateLocale_serializesWrites() async {
        for firstCompletion in [FirstLocaleCompletion.success, .failure] {
            let service = ControlledUserSettingsService()
            let store = UserSettingsStore(service: service)

            let olderUpdate = Task { await store.updateLocale(.de) }
            await service.waitForCallCount(1)
            let latestUpdate = Task { await store.updateLocale(.it) }
            while store.locale != .it { await Task.yield() }

            #expect(await service.callCount == 1)
            switch firstCompletion {
            case .success: await service.succeed(.de)
            case .failure: await service.fail(.de)
            }
            await service.waitForCallCount(2)
            await service.succeed(.it)
            await olderUpdate.value
            await latestUpdate.value

            #expect(await service.remoteLocale == .it)
            #expect(store.locale == .it)
            #expect(AppLocale.current == .it)
            #expect(store.error == nil)

            store.reset()
        }
    }

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

    /// An account that has never chosen a language answers `locale: nil`. The load must
    /// keep the boot resolution published and must NOT persist it: freezing a detection
    /// into the snapshot would outlive a later device-language change.
    @Test func load_withoutServerLocale_keepsBootResolutionUnpersisted() async {
        AppLocale.clearPersisted()
        let mockService = MockUserSettingsService(
            stubbedGetSettings: UserSettings(
                payDayOfMonth: nil,
                currency: .chf,
                showCurrencySelector: false,
                locale: nil
            )
        )
        let store = UserSettingsStore(service: mockService)

        await store.loadIfNeeded()

        #expect(store.locale == AppLocale.detected())
        #expect(AppLocale.current == AppLocale.detected())

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
    /// With the snapshot cleared, `current` resolves from device detection — asserted
    /// through `detected()` rather than a literal so the test survives whatever
    /// language the test simulator happens to run in.
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

        #expect(store.locale == AppLocale.detected())
        #expect(AppLocale.current == AppLocale.detected())
    }
}
