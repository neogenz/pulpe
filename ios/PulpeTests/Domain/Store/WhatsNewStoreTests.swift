import Foundation
@testable import Pulpe
import Testing

@Suite("WhatsNewStore Tests")
@MainActor
struct WhatsNewStoreTests {
    @Test func flagsInit_freshInstall_seedsCurrentVersion() throws {
        let suiteName = "WhatsNewFlagsStoreTests.\(UUID().uuidString)"
        let defaults = try #require(UserDefaults(suiteName: suiteName))
        defer { defaults.removePersistentDomain(forName: suiteName) }

        let flags = WhatsNewFlagsStore(defaults: defaults, currentVersion: "1.2.0")

        #expect(flags.wasInstalledBeforeWhatsNew == false)
        #expect(flags.lastSeenVersion == "1.2.0")
    }

    @Test func flagsInit_existingInstallWithoutMarker_preservesMigrationPath() throws {
        let suiteName = "WhatsNewFlagsStoreTests.\(UUID().uuidString)"
        let defaults = try #require(UserDefaults(suiteName: suiteName))
        defer { defaults.removePersistentDomain(forName: suiteName) }
        AppAuthFlagsStore(defaults: defaults).setHasLaunchedBefore()

        let flags = WhatsNewFlagsStore(defaults: defaults, currentVersion: "1.2.0")

        #expect(flags.wasInstalledBeforeWhatsNew)
        #expect(flags.lastSeenVersion == nil)
    }

    @Test func freshLaunchWithoutAuth_thenAuthenticatedRelaunch_doesNotPresent() async throws {
        let suiteName = "WhatsNewFlagsStoreTests.\(UUID().uuidString)"
        let defaults = try #require(UserDefaults(suiteName: suiteName))
        defer { defaults.removePersistentDomain(forName: suiteName) }
        let service = MockWhatsNewService(outcome: .success([.makeFixture()]))

        let firstLaunchFlags = WhatsNewFlagsStore(defaults: defaults, currentVersion: "1.2.0")
        #expect(firstLaunchFlags.lastSeenVersion == "1.2.0")
        AppAuthFlagsStore(defaults: defaults).setHasLaunchedBefore()
        let secondLaunchFlags = WhatsNewFlagsStore(defaults: defaults, currentVersion: "1.2.0")
        let store = WhatsNewStore(service: service, flagsStore: secondLaunchFlags)
        await store.check(currentVersion: "1.2.0")

        #expect(service.fetchCallCount == 0)
        #expect(store.isPresented == false)
    }

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

        #expect(!store.allowsLowerPriorityPresentation)
        await store.check(currentVersion: "1.2.0", locale: .de)

        #expect(service.fetchCallCount == 1)
        #expect(store.isPresented)
        #expect(!store.allowsLowerPriorityPresentation)
        #expect(store.entries.count == 1)
        #expect(store.entries.first?.version == "1.2.0")
        #expect(service.lastRequest?.locale == .de)
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

        #expect(!store.allowsLowerPriorityPresentation)
        await store.check(currentVersion: "1.2.0")

        #expect(service.fetchCallCount == 0)
        #expect(store.isPresented == false)
        #expect(flags.lastSeenVersion == "1.2.0")
        #expect(store.allowsLowerPriorityPresentation)
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
        #expect(store.allowsLowerPriorityPresentation)
    }

    @Test func check_urlCancellation_failsOpenAndLeavesLastSeenUntouched() async {
        let service = MockWhatsNewService(outcome: .failure(URLError(.cancelled)))
        let flags = MockWhatsNewFlagsStore(lastSeenVersion: "1.1.0")
        let store = WhatsNewStore(service: service, flagsStore: flags)

        await store.check(currentVersion: "1.2.0")

        #expect(service.fetchCallCount == 1)
        #expect(flags.lastSeenVersion == "1.1.0")
        #expect(store.isPresented == false)
        #expect(store.entries.isEmpty)
        #expect(!store.allowsLowerPriorityPresentation)
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

@MainActor
private final class MockWhatsNewService: WhatsNewServiceProtocol {
    struct Request {
        let currentVersion: String
        let lastSeenVersion: String
        let locale: SupportedLocale
    }

    enum Outcome {
        case success([WhatsNewEntry])
        case failure(Error)
    }

    private let outcome: Outcome
    private let suspendsBeforeReturning: Bool
    private(set) var fetchCallCount = 0
    private(set) var lastRequest: Request?

    init(outcome: Outcome, suspendsBeforeReturning: Bool = false) {
        self.outcome = outcome
        self.suspendsBeforeReturning = suspendsBeforeReturning
    }

    func fetch(
        currentVersion: String,
        lastSeenVersion: String,
        locale: SupportedLocale
    ) async throws -> WhatsNewResponse {
        fetchCallCount += 1
        lastRequest = Request(
            currentVersion: currentVersion,
            lastSeenVersion: lastSeenVersion,
            locale: locale
        )
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
