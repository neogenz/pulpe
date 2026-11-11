import Foundation
@testable import Pulpe
import Testing

@MainActor
struct AssetStoreTests {
    private func makeCreate() -> AssetCreate {
        AssetCreate(name: "UBS", categoryId: "", currency: .chf, direction: .own, inPulpe: false, value: 10)
    }

    @Test func loadIfNeeded_secondCallInsideTTL_readsOnce() async {
        let service = MockAssetService()
        let store = AssetStore(service: service)

        await store.loadIfNeeded()
        await store.loadIfNeeded()

        #expect(service.getNetWorthCallCount == 1)
        #expect(store.netWorth == service.stubbedNetWorth)
        #expect(store.hasLoadedOnce)
    }

    @Test func create_starterCategory_createsCategoryThenAssetThenRefetches() async throws {
        let service = MockAssetService()
        let store = AssetStore(service: service)

        try await store.create(makeCreate(), category: .starter(name: "Comptes"))

        #expect(service.calls == ["createCategory", "create", "get"])
        #expect(service.lastCreate?.categoryId == "new-category")
    }

    @Test func create_existingCategory_skipsCategoryCreation() async throws {
        let service = MockAssetService()
        let store = AssetStore(service: service)

        try await store.create(makeCreate(), category: .existing(id: "c9"))

        #expect(service.calls == ["create", "get"])
        #expect(service.lastCreate?.categoryId == "c9")
    }

    @Test func create_typeNamedLikeAnExistingOne_reusesIt() async throws {
        let service = MockAssetService()
        let store = AssetStore(service: service)
        await store.forceRefresh()

        try await store.create(makeCreate(), category: .starter(name: "comptes"))

        #expect(service.calls == ["get", "create", "get"])
        #expect(service.lastCreate?.categoryId == "c1")
    }

    @Test func save_valueOnly_recordsASnapshotWithoutPatch() async throws {
        let service = MockAssetService()
        let store = AssetStore(service: service)

        try await store.save(id: "a1", AssetEdit(value: 1500))

        #expect(service.calls == ["snapshots", "get"])
    }

    @Test func save_nameOnly_patchesWithoutSnapshot() async throws {
        let service = MockAssetService()
        let store = AssetStore(service: service)

        try await store.save(id: "a1", AssetEdit(updates: AssetUpdate(name: "UBS")))

        #expect(service.calls == ["update", "get"])
    }

    @Test func save_newTypeAndValue_createsTheTypeThenPatchesThenSnapshots() async throws {
        let service = MockAssetService()
        let store = AssetStore(service: service)

        try await store.save(id: "a1", AssetEdit(category: .starter(name: "Crypto"), value: 20))

        #expect(service.calls == ["createCategory", "update", "snapshots", "get"])
    }

    @Test func create_assetFails_refetchesAndRethrows() async {
        let service = MockAssetService()
        service.createError = APIError.assetCreateFailed
        let store = AssetStore(service: service)

        do {
            try await store.create(makeCreate(), category: .starter(name: "Comptes"))
            Issue.record("Expected a throw")
        } catch let error as APIError {
            if case .assetCreateFailed = error {} else { Issue.record("Wrong error \(error)") }
        } catch {
            Issue.record("Wrong error \(error)")
        }

        #expect(service.calls == ["createCategory", "create", "get"])
        #expect(store.isSaving == false)
    }

    @Test func write_whileAnotherIsInFlight_isDropped() async throws {
        let service = MockAssetService()
        service.holdCreateCategory = true
        let store = AssetStore(service: service)

        let first = Task { try await store.create(makeCreate(), category: .starter(name: "A")) }
        while !service.didEnterHold { await Task.yield() }
        try await store.create(makeCreate(), category: .starter(name: "B"))
        service.release()
        try await first.value

        #expect(service.createCategoryCallCount == 1)
    }

    @Test func reset_whileLoading_discardsTheLateResult() async {
        let service = MockAssetService()
        service.holdGetNetWorth = true
        let store = AssetStore(service: service)

        let load = Task { await store.forceRefresh() }
        while !service.didEnterHold { await Task.yield() }
        store.reset()
        service.release()
        await load.value

        #expect(store.netWorth == nil)
        #expect(store.hasLoadedOnce == false)
        #expect(store.isLoading == false)
    }

    @Test func readHelpers_splitActiveArchivedAndInPulpeAccounts() async {
        let service = MockAssetService()
        service.stubbedNetWorth = TestDataFactory.makeNetWorth(assets: [
            TestDataFactory.makeAsset(id: "own-chf", inPulpe: true),
            TestDataFactory.makeAsset(id: "own-eur", currency: .eur, inPulpe: true),
            TestDataFactory.makeAsset(id: "debt", direction: .owe, inPulpe: true),
            TestDataFactory.makeAsset(id: "old", inPulpe: true, archivedAt: TestDataFactory.fixedDate),
        ])
        let store = AssetStore(service: service)
        await store.forceRefresh()

        #expect(store.archivedAssets.map(\.id) == ["old"])
        #expect(store.activeAssets(direction: .owe).map(\.id) == ["debt"])
        #expect(store.inPulpeAccounts(currency: .chf).map(\.id) == ["own-chf"])
    }
}
