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
