import Foundation
@testable import Pulpe
import Testing

@Suite("AppVersionStore Tests")
@MainActor
struct AppVersionStoreTests {
    @Test func check_currentBelowMin_emitsForceUpdateWithStoreURL() async {
        let service = StubAppVersionService(response: .makeFixture(
            iosMin: "1.0.1",
            iosLatest: "1.0.1",
            iosStoreURL: "https://apps.apple.com/app/pulpe"
        ))
        let store = AppVersionStore(service: service, currentVersion: "1.0.0")

        await store.check()

        #expect(store.status == .forceUpdate(storeURL: URL(string: "https://apps.apple.com/app/pulpe")))
        #expect(!store.allowsLowerPriorityPresentation)
    }

    @Test func check_currentEqualsMin_emitsOk() async {
        let service = StubAppVersionService(response: .makeFixture(iosMin: "1.0.1"))
        let store = AppVersionStore(service: service, currentVersion: "1.0.1")
        #expect(!store.allowsLowerPriorityPresentation)

        await store.check()

        #expect(store.status == .ok)
        #expect(store.allowsLowerPriorityPresentation)
    }

    @Test func check_currentAboveMinNumerically_emitsOk() async {
        let service = StubAppVersionService(response: .makeFixture(iosMin: "1.0.2"))
        let store = AppVersionStore(service: service, currentVersion: "1.0.10")

        await store.check()

        #expect(store.status == .ok)
    }

    @Test("Latest version uses a monotone prompt high-water mark")
    func check_currentBelowLatest_emitsOnceAndIgnoresOlderTargetAfterNewer() async throws {
        let suiteName = "AppVersionStoreTests.\(UUID().uuidString)"
        let defaults = try #require(UserDefaults(suiteName: suiteName))
        defer { defaults.removePersistentDomain(forName: suiteName) }
        let flagsStore = AppUpdateFlagsStore(defaults: defaults)
        let storeURL = try #require(URL(string: "https://apps.apple.com/app/id6758464920"))

        let service = StubAppVersionService(response: .makeFixture(
            iosMin: "1.0.0",
            iosLatest: "1.3.2",
            iosStoreURL: storeURL.absoluteString
        ))
        let store = AppVersionStore(
            service: service,
            flagsStore: flagsStore,
            currentVersion: "1.3.1"
        )

        await store.check()
        #expect(store.status == .updateAvailable(.init(version: "1.3.2", storeURL: storeURL)))

        store.markUpdatePresented()
        await store.check()
        #expect(store.status == .updateAvailable(.init(version: "1.3.2", storeURL: storeURL)))

        store.dismissUpdateAvailable()
        #expect(store.status == .ok)
        #expect(flagsStore.lastPromptedVersion == "1.3.2")

        let relaunchedStore = AppVersionStore(
            service: service,
            flagsStore: AppUpdateFlagsStore(defaults: defaults),
            currentVersion: "1.3.1"
        )
        await relaunchedStore.check()
        #expect(relaunchedStore.status == .ok)

        let newerService = StubAppVersionService(response: .makeFixture(
            iosMin: "1.0.0",
            iosLatest: "1.3.3",
            iosStoreURL: storeURL.absoluteString
        ))
        let newerStore = AppVersionStore(
            service: newerService,
            flagsStore: AppUpdateFlagsStore(defaults: defaults),
            currentVersion: "1.3.1"
        )
        await newerStore.check()
        #expect(newerStore.status == .updateAvailable(.init(version: "1.3.3", storeURL: storeURL)))

        newerStore.markUpdatePresented()
        #expect(flagsStore.lastPromptedVersion == "1.3.3")

        let rolledBackStore = AppVersionStore(
            service: service, flagsStore: AppUpdateFlagsStore(defaults: defaults), currentVersion: "1.3.1"
        )
        await rolledBackStore.check()
        #expect(rolledBackStore.status == .ok)
        #expect(flagsStore.lastPromptedVersion == "1.3.3")
    }

    @Test func lowerPriorityPresentation_waitsUntilOptionalUpdateIsDismissed() async {
        let service = StubAppVersionService(response: .makeFixture(
            iosMin: "1.0.0",
            iosLatest: "1.3.2",
            iosStoreURL: "https://apps.apple.com/app/id6758464920"
        ))
        let store = AppVersionStore(service: service, currentVersion: "1.3.1")

        await store.check()
        #expect(!store.allowsLowerPriorityPresentation)

        store.dismissUpdateAvailable()
        #expect(store.allowsLowerPriorityPresentation)
    }

    @Test("Minimum version keeps priority over the optional update")
    func check_currentBelowMin_emitsForceUpdateBeforeLatest() async throws {
        let suiteName = "AppVersionStoreTests.\(UUID().uuidString)"
        let defaults = try #require(UserDefaults(suiteName: suiteName))
        defer { defaults.removePersistentDomain(forName: suiteName) }
        let flagsStore = AppUpdateFlagsStore(defaults: defaults)
        flagsStore.setLastPromptedVersion("1.3.2")
        let storeURL = try #require(URL(string: "https://apps.apple.com/app/id6758464920"))
        let service = StubAppVersionService(response: .makeFixture(
            iosMin: "1.3.1",
            iosLatest: "1.3.2",
            iosStoreURL: storeURL.absoluteString
        ))
        let store = AppVersionStore(
            service: service,
            flagsStore: flagsStore,
            currentVersion: "1.3.0"
        )

        await store.check()

        #expect(store.status == .forceUpdate(storeURL: storeURL))
    }

    @Test("Optional update requires an absolute App Store URL")
    func check_softUpdateWithoutUsableURL_emitsOk() async {
        let service = StubAppVersionService(response: .makeFixture(
            iosMin: "1.0.0",
            iosLatest: "1.3.2",
            iosStoreURL: "not-an-absolute-url"
        ))
        let store = AppVersionStore(service: service, currentVersion: "1.3.1")

        await store.check()

        #expect(store.status == .ok)
    }

    @Test func check_fetchThrows_failsOpenWithOkStatus() async {
        let service = StubAppVersionService(error: URLError(.notConnectedToInternet))
        let store = AppVersionStore(service: service, currentVersion: "1.0.0")

        await store.check()

        #expect(store.status == .ok)
    }

    @Test func check_storeURLMissing_emitsForceUpdateWithNilURL() async {
        let service = StubAppVersionService(response: .makeFixture(
            iosMin: "2.0.0",
            iosStoreURL: nil
        ))
        let store = AppVersionStore(service: service, currentVersion: "1.0.0")

        await store.check()

        #expect(store.status == .forceUpdate(storeURL: nil))
    }

    @Test("Force-update persists if a later fetch fails (e.g. airplane mode)")
    func check_forceUpdateThenFetchThrows_preservesForceUpdate() async {
        let storeURL = URL(string: "https://apps.apple.com/app/id6758464920")
        let failingService = SwitchableStubService(
            initialOutcome: .success(.makeFixture(
                iosMin: "2.0.0",
                iosStoreURL: storeURL?.absoluteString
            ))
        )
        let store = AppVersionStore(service: failingService, currentVersion: "1.0.0")

        await store.check()
        #expect(store.status == .forceUpdate(storeURL: storeURL))

        failingService.swap(to: .failure(URLError(.notConnectedToInternet)))
        await store.check()

        #expect(store.status == .forceUpdate(storeURL: storeURL))
    }

    @Test("OK status persists on later fetch failure")
    func check_okThenFetchThrows_preservesOk() async {
        let okThenFailing = SwitchableStubService(
            initialOutcome: .success(.makeFixture(iosMin: "1.0.0"))
        )
        let store = AppVersionStore(service: okThenFailing, currentVersion: "1.0.0")

        await store.check()
        #expect(store.status == .ok)

        okThenFailing.swap(to: .failure(URLError(.timedOut)))
        await store.check()

        #expect(store.status == .ok)
    }

    @Test("Optional-update status persists on later fetch failure")
    func check_updateAvailableThenFetchThrows_preservesUpdate() async throws {
        let storeURL = try #require(URL(string: "https://apps.apple.com/app/id6758464920"))
        let service = SwitchableStubService(
            initialOutcome: .success(.makeFixture(
                iosMin: "1.0.0",
                iosLatest: "1.3.2",
                iosStoreURL: storeURL.absoluteString
            ))
        )
        let store = AppVersionStore(service: service, currentVersion: "1.3.1")

        await store.check()
        let confirmedStatus = store.status
        service.swap(to: .failure(URLError(.timedOut)))
        await store.check()

        #expect(confirmedStatus == .updateAvailable(.init(version: "1.3.2", storeURL: storeURL)))
        #expect(store.status == confirmedStatus)
    }
}

// MARK: - Fixtures

private enum StubFetchOutcome {
    case success(AppVersionResponse)
    case failure(Error)
}

private final class StubAppVersionService: AppVersionServiceProtocol, @unchecked Sendable {
    private let outcome: StubFetchOutcome

    init(response: AppVersionResponse) {
        self.outcome = .success(response)
    }

    init(error: Error) {
        self.outcome = .failure(error)
    }

    func fetch() async throws -> AppVersionResponse {
        switch outcome {
        case .success(let response):
            return response
        case .failure(let error):
            throw error
        }
    }
}

private final class SwitchableStubService: AppVersionServiceProtocol, @unchecked Sendable {
    private var outcome: StubFetchOutcome

    init(initialOutcome: StubFetchOutcome) {
        self.outcome = initialOutcome
    }

    func swap(to newOutcome: StubFetchOutcome) {
        outcome = newOutcome
    }

    func fetch() async throws -> AppVersionResponse {
        switch outcome {
        case .success(let response):
            return response
        case .failure(let error):
            throw error
        }
    }
}

private extension AppVersionResponse {
    static func makeFixture(
        iosMin: String = "1.0.0",
        iosLatest: String = "1.0.0",
        iosStoreURL: String? = nil,
        webMin: String = "0.0.1",
        webLatest: String = "0.0.1"
    ) -> AppVersionResponse {
        AppVersionResponse(
            success: true,
            data: AppVersionData(
                ios: PlatformVersion(
                    minVersion: iosMin,
                    latestVersion: iosLatest,
                    storeUrl: iosStoreURL
                ),
                web: PlatformVersion(
                    minVersion: webMin,
                    latestVersion: webLatest,
                    storeUrl: nil
                )
            )
        )
    }
}
