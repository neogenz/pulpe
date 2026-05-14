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
    }

    @Test func check_currentEqualsMin_emitsOk() async {
        let service = StubAppVersionService(response: .makeFixture(iosMin: "1.0.1"))
        let store = AppVersionStore(service: service, currentVersion: "1.0.1")

        await store.check()

        #expect(store.status == .ok)
    }

    @Test func check_currentAboveMinNumerically_emitsOk() async {
        let service = StubAppVersionService(response: .makeFixture(iosMin: "1.0.2"))
        let store = AppVersionStore(service: service, currentVersion: "1.0.10")

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
