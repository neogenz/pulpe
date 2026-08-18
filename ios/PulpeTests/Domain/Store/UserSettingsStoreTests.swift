import Foundation
@testable import Pulpe
import Testing

private actor ControlledUserSettingsService: UserSettingsServicing {
    private var getContinuation: CheckedContinuation<UserSettings, any Error>?
    private var getWaiters: [Int: CheckedContinuation<Void, Never>] = [:]
    private var continuations: [SupportedLocale: CheckedContinuation<UserSettings, any Error>] = [:]
    private var waiters: [Int: CheckedContinuation<Void, Never>] = [:]
    private(set) var getCallCount = 0
    private(set) var callCount = 0
    private(set) var remoteLocale: SupportedLocale = .fr

    func getSettings() async throws -> UserSettings {
        getCallCount += 1
        for expected in getWaiters.keys.filter({ $0 <= getCallCount }) {
            getWaiters.removeValue(forKey: expected)?.resume()
        }
        return try await withCheckedThrowingContinuation { getContinuation = $0 }
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

    func waitForGetCallCount(_ expected: Int) async {
        guard getCallCount < expected else { return }
        await withCheckedContinuation { getWaiters[expected] = $0 }
    }

    func completeGet(_ locale: SupportedLocale, payDayOfMonth: Int? = nil) {
        getContinuation?.resume(
            returning: UserSettings(
                payDayOfMonth: payDayOfMonth,
                currency: .chf,
                showCurrencySelector: false,
                locale: locale
            )
        )
        getContinuation = nil
    }

    func cancelGet() {
        getContinuation?.resume(throwing: APIError.networkError(URLError(.cancelled)))
        getContinuation = nil
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

    @Test("Two failed locale writes restore the last confirmed locale")
    func updateLocale_twoFailuresRestoreConfirmedLocale() async {
        AppLocale.persist(.fr)
        let service = ControlledUserSettingsService()
        let store = UserSettingsStore(service: service)

        let olderUpdate = Task { await store.updateLocale(.de) }
        await service.waitForCallCount(1)
        let latestUpdate = Task { await store.updateLocale(.it) }
        while store.locale != .it { await Task.yield() }

        await service.fail(.de)
        await service.waitForCallCount(2)
        await service.fail(.it)
        await olderUpdate.value
        await latestUpdate.value

        #expect(await service.remoteLocale == .fr)
        #expect(store.locale == .fr)
        #expect(AppLocale.current == .fr)
        #expect(store.error != nil)

        store.reset()
    }

    @Test("A stale locale load cannot overwrite a successful update")
    func updateLocale_cancelsStaleLoad() async {
        AppLocale.persist(.fr)
        let service = ControlledUserSettingsService()
        let store = UserSettingsStore(service: service)

        let staleLoad = Task { await store.forceRefresh() }
        await service.waitForGetCallCount(1)
        #expect(store.isLoading)

        let update = Task { await store.updateLocale(.it) }
        await service.waitForCallCount(1)
        await service.succeed(.it)
        await update.value
        await service.completeGet(.fr)
        await staleLoad.value

        #expect(await service.remoteLocale == .it)
        #expect(store.locale == .it)
        #expect(AppLocale.current == .it)
        #expect(store.isLoading == false)
        #expect(store.error == nil)

        var reloadFinished = false
        let reload = Task {
            await store.loadIfNeeded()
            reloadFinished = true
        }
        while await service.getCallCount < 2 && !reloadFinished { await Task.yield() }
        let getCallCount = await service.getCallCount
        #expect(getCallCount == 2)
        if getCallCount == 2 { await service.completeGet(.it, payDayOfMonth: 27) }
        await reload.value

        #expect(store.payDayOfMonth == 27)
        #expect(store.locale == .it)
        #expect(AppLocale.current == .it)

        store.reset()
    }

    @Test("A cancelled locale load cannot publish an error after a successful update")
    func updateLocale_discardsCancelledLoadError() async {
        let service = ControlledUserSettingsService()
        let store = UserSettingsStore(service: service)

        let staleLoad = Task { await store.forceRefresh() }
        await service.waitForGetCallCount(1)

        let update = Task { await store.updateLocale(.it) }
        await service.waitForCallCount(1)
        await service.cancelGet()
        await staleLoad.value
        await service.succeed(.it)
        await update.value

        #expect(await service.remoteLocale == .it)
        #expect(store.locale == .it)
        #expect(AppLocale.current == .it)
        #expect(store.error == nil)

        store.reset()
    }

    @Test("A refresh waits for locale persistence before loading settings")
    func forceRefresh_waitsForLocaleUpdate() async {
        AppLocale.persist(.fr)
        let service = ControlledUserSettingsService()
        let store = UserSettingsStore(service: service)

        let update = Task { await store.updateLocale(.it) }
        await service.waitForCallCount(1)

        var refreshStarted = false
        let refresh = Task {
            refreshStarted = true
            await store.forceRefresh()
        }
        while !refreshStarted { await Task.yield() }
        #expect(await service.getCallCount == 0)
        #expect(store.isLoading == false)

        await service.succeed(.it)
        await service.waitForGetCallCount(1)
        await service.completeGet(.it, payDayOfMonth: 15)
        await update.value
        await refresh.value

        #expect(await service.remoteLocale == .it)
        #expect(store.locale == .it)
        #expect(AppLocale.current == .it)
        #expect(store.payDayOfMonth == 15)
        #expect(store.isLoading == false)

        store.reset()
    }

    @Test("Reset cancels a refresh waiting for locale persistence")
    func reset_cancelsRefreshWaitingForLocaleUpdate() async {
        AppLocale.persist(.fr)
        let service = ControlledUserSettingsService()
        let store = UserSettingsStore(service: service)

        let update = Task { await store.updateLocale(.it) }
        await service.waitForCallCount(1)

        var refreshStarted = false
        var refreshFinished = false
        let refresh = Task {
            refreshStarted = true
            await store.forceRefresh()
            refreshFinished = true
        }
        while !refreshStarted { await Task.yield() }
        await Task.yield()
        #expect(await service.getCallCount == 0)

        store.reset()
        await service.succeed(.it)
        await update.value
        while await service.getCallCount == 0 && !refreshFinished { await Task.yield() }
        let getCallCount = await service.getCallCount
        #expect(getCallCount == 0)
        if getCallCount > 0 { await service.completeGet(.it, payDayOfMonth: 31) }
        await refresh.value

        #expect(store.payDayOfMonth == nil)
        #expect(store.locale == AppLocale.detected())
        #expect(AppLocale.current == AppLocale.detected())
        #expect(store.isLoading == false)
        #expect(store.error == nil)
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
