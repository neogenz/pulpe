import Foundation
@testable import Pulpe
import Testing

@Suite("WhatsNewStore Tests")
@MainActor
struct WhatsNewStoreTests {
    @Test func check_firstInstall_persistsCurrentVersionWithoutFetching() async {
        let service = MockWhatsNewService(outcome: .success([.makeFixture()]))
        let flags = MockWhatsNewFlagsStore(lastSeenVersion: nil)
        let store = WhatsNewStore(service: service, flagsStore: flags)

        await store.check(currentVersion: "1.2.0")

        #expect(service.fetchCallCount == 0)
        #expect(flags.lastSeenVersion == "1.2.0")
        #expect(store.isPresented == false)
        #expect(store.entries.isEmpty)
    }

    @Test func check_upgradeWithEntries_fetchesAndPresents() async {
        let service = MockWhatsNewService(outcome: .success([.makeFixture(version: "1.2.0")]))
        let flags = MockWhatsNewFlagsStore(lastSeenVersion: "1.1.0")
        let store = WhatsNewStore(service: service, flagsStore: flags)

        await store.check(currentVersion: "1.2.0")

        #expect(service.fetchCallCount == 1)
        #expect(store.isPresented)
        #expect(store.entries.count == 1)
        #expect(store.entries.first?.version == "1.2.0")
    }

    @Test func check_existingInstallWithoutMarker_usesMigrationBaseline() async {
        let service = MockWhatsNewService(outcome: .success([.makeFixture(version: "1.2.0")]))
        let flags = MockWhatsNewFlagsStore(
            wasInstalledBeforeWhatsNew: true,
            lastSeenVersion: nil
        )
        let store = WhatsNewStore(service: service, flagsStore: flags)

        await store.check(currentVersion: "1.2.0")

        #expect(service.lastRequest?.lastSeenVersion == WhatsNewStore.migrationBaselineVersion)
        #expect(service.lastRequest?.currentVersion == "1.2.0")
        #expect(store.isPresented)
    }

    @Test func check_existingInstallUpgradingToFirstSupportedVersion_fetchesAndPresents() async {
        let service = MockWhatsNewService(outcome: .success([.makeFixture(version: "1.1.0")]))
        let flags = MockWhatsNewFlagsStore(
            wasInstalledBeforeWhatsNew: true,
            lastSeenVersion: nil
        )
        let store = WhatsNewStore(service: service, flagsStore: flags)

        await store.check(currentVersion: "1.1.0")

        #expect(service.lastRequest?.lastSeenVersion == "1.0.4")
        #expect(service.lastRequest?.currentVersion == "1.1.0")
        #expect(store.isPresented)
    }

    @Test func check_upgradeWithEmptyEntries_persistsSilentlyWithoutPresenting() async {
        let service = MockWhatsNewService(outcome: .success([]))
        let flags = MockWhatsNewFlagsStore(lastSeenVersion: "1.1.0")
        let store = WhatsNewStore(service: service, flagsStore: flags)

        await store.check(currentVersion: "1.2.0")

        #expect(service.fetchCallCount == 1)
        #expect(flags.lastSeenVersion == "1.2.0")
        #expect(store.isPresented == false)
        #expect(store.entries.isEmpty)
    }

    @Test func check_sameVersion_isNoOp() async {
        let service = MockWhatsNewService(outcome: .success([.makeFixture()]))
        let flags = MockWhatsNewFlagsStore(lastSeenVersion: "1.2.0")
        let store = WhatsNewStore(service: service, flagsStore: flags)

        await store.check(currentVersion: "1.2.0")

        #expect(service.fetchCallCount == 0)
        #expect(store.isPresented == false)
        #expect(flags.lastSeenVersion == "1.2.0")
    }

    @Test func check_downgrade_isNoOp() async {
        let service = MockWhatsNewService(outcome: .success([.makeFixture()]))
        let flags = MockWhatsNewFlagsStore(lastSeenVersion: "2.0.0")
        let store = WhatsNewStore(service: service, flagsStore: flags)

        await store.check(currentVersion: "1.9.0")

        #expect(service.fetchCallCount == 0)
        #expect(store.isPresented == false)
        #expect(flags.lastSeenVersion == "2.0.0")
    }

    @Test func check_networkFailure_failsOpenAndLeavesLastSeenUntouched() async {
        let service = MockWhatsNewService(outcome: .failure(URLError(.notConnectedToInternet)))
        let flags = MockWhatsNewFlagsStore(lastSeenVersion: "1.1.0")
        let store = WhatsNewStore(service: service, flagsStore: flags)

        await store.check(currentVersion: "1.2.0")

        #expect(service.fetchCallCount == 1)
        #expect(flags.lastSeenVersion == "1.1.0")
        #expect(store.isPresented == false)
        #expect(store.entries.isEmpty)
    }

    @Test func dismiss_persistsCurrentVersionAndHidesSheet() async {
        let service = MockWhatsNewService(outcome: .success([.makeFixture(version: "1.2.0")]))
        let flags = MockWhatsNewFlagsStore(lastSeenVersion: "1.1.0")
        let store = WhatsNewStore(service: service, flagsStore: flags)

        await store.check(currentVersion: "1.2.0")
        #expect(store.isPresented)

        store.dismiss(currentVersion: "1.2.0")

        #expect(flags.lastSeenVersion == "1.2.0")
        #expect(store.isPresented == false)
        #expect(store.entries.isEmpty)
    }

    @Test func check_whileRequestIsInFlight_fetchesOnlyOnce() async {
        let service = MockWhatsNewService(
            outcome: .success([.makeFixture(version: "1.2.0")]),
            suspendsBeforeReturning: true
        )
        let flags = MockWhatsNewFlagsStore(lastSeenVersion: "1.1.0")
        let store = WhatsNewStore(service: service, flagsStore: flags)

        let firstCheck = Task { await store.check(currentVersion: "1.2.0") }
        await Task.yield()
        await store.check(currentVersion: "1.2.0")
        await firstCheck.value

        #expect(service.fetchCallCount == 1)
        #expect(store.isPresented)

        await store.check(currentVersion: "1.2.0")
        #expect(service.fetchCallCount == 1)
    }
}

// MARK: - Mocks

private final class MockWhatsNewService: WhatsNewServiceProtocol, @unchecked Sendable {
    enum Outcome {
        case success([WhatsNewEntry])
        case failure(Error)
    }

    private let outcome: Outcome
    private let suspendsBeforeReturning: Bool
    private(set) var fetchCallCount = 0
    private(set) var lastRequest: (currentVersion: String, lastSeenVersion: String)?

    init(outcome: Outcome, suspendsBeforeReturning: Bool = false) {
        self.outcome = outcome
        self.suspendsBeforeReturning = suspendsBeforeReturning
    }

    func fetch(currentVersion: String, lastSeenVersion: String) async throws -> WhatsNewResponse {
        fetchCallCount += 1
        lastRequest = (currentVersion, lastSeenVersion)
        if suspendsBeforeReturning {
            await Task.yield()
        }
        switch outcome {
        case .success(let entries):
            return WhatsNewResponse(success: true, data: .init(entries: entries))
        case .failure(let error):
            throw error
        }
    }
}

private final class MockWhatsNewFlagsStore: WhatsNewFlagsStoring, @unchecked Sendable {
    let wasInstalledBeforeWhatsNew: Bool
    private(set) var lastSeenVersion: String?

    init(
        wasInstalledBeforeWhatsNew: Bool = false,
        lastSeenVersion: String?
    ) {
        self.wasInstalledBeforeWhatsNew = wasInstalledBeforeWhatsNew
        self.lastSeenVersion = lastSeenVersion
    }

    func setLastSeenVersion(_ version: String) {
        lastSeenVersion = version
    }
}

// MARK: - Fixtures

private extension WhatsNewEntry {
    static func makeFixture(
        version: String = "1.2.0",
        title: String = "Nouveautés de la version 1.2.0",
        body: String = "- **Nouveauté** — Description.",
        publishedAt: String = "2026-07-01"
    ) -> WhatsNewEntry {
        WhatsNewEntry(version: version, title: title, body: body, publishedAt: publishedAt)
    }
}
