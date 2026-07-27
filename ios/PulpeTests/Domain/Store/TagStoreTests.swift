import Foundation
@testable import Pulpe
import Testing

private typealias PulpeTag = Pulpe.Tag

@MainActor
struct TagStoreTests {
    @Test("load, create and reset keep one sorted catalog")
    func catalogLifecycle() async throws {
        let service = MockTagService()
        service.tags = [
            service.makeTag(id: "2", name: "Transport"),
            service.makeTag(id: "1", name: "Courses"),
        ]
        let store = TagStore(service: service)

        await store.forceRefresh()

        #expect(store.tags.map(\.name) == ["Courses", "Transport"])
        #expect(store.namesById["1"] == "Courses")
        #expect(store.hasLoadedOnce)

        let created = try await store.create(name: "Assurance")

        #expect(created.name == "Assurance")
        #expect(store.tags.map(\.name) == ["Assurance", "Courses", "Transport"])
        #expect(service.lastCreate?.name == "Assurance")

        store.reset()

        #expect(store.tags.isEmpty)
        #expect(!store.hasLoadedOnce)
        #expect(store.error == nil)
    }

    @Test("a create finishing after reset cannot mutate the next session")
    func createAfterResetIsDiscarded() async {
        let service = MockTagService()
        let store = TagStore(service: service)
        service.gateCreate()

        let creation = Task { try await store.create(name: "Privé A") }
        await waitForCondition("create must reach the service") { service.didEnterCreate }

        store.reset()
        service.tags = [service.makeTag(id: "session-b", name: "Session B")]
        await store.forceRefresh()
        service.releaseCreate()

        await #expect(throws: CancellationError.self) {
            try await creation.value
        }
        #expect(store.tags.map(\.name) == ["Session B"])
    }

    @Test("a refresh in the same session does not discard a valid create")
    func createSurvivesSameSessionRefresh() async throws {
        let service = MockTagService()
        let store = TagStore(service: service)
        service.tags = [service.makeTag(id: "existing", name: "Courses")]
        service.gateCreate()

        let creation = Task { try await store.create(name: "Assurance") }
        await waitForCondition("create must reach the service") { service.didEnterCreate }

        await store.forceRefresh()
        service.releaseCreate()
        let created = try await creation.value

        #expect(created.name == "Assurance")
        #expect(store.tags.map(\.name) == ["Assurance", "Courses"])
    }

    @Test("a refresh finishing after create cannot overwrite it")
    func staleRefreshCannotOverwriteCreate() async throws {
        let service = MockTagService()
        service.tags = [service.makeTag(id: "existing", name: "Courses")]
        let store = TagStore(service: service)
        await store.forceRefresh()

        service.gateGetAll()
        let refresh = Task {
            await store.forceRefresh()
        }
        await waitForCondition("refresh must reach the service") {
            service.getAllCallCount == 2
        }

        _ = try await store.create(name: "Assurance")
        service.releaseGetAll()
        await refresh.value

        #expect(store.tags.map(\.name) == ["Assurance", "Courses"])
        #expect(!store.isLoading)
    }
}

@MainActor
private final class MockTagService: TagServicing {
    var tags: [PulpeTag] = []
    private(set) var getAllCallCount = 0
    private(set) var lastCreate: TagCreate?
    private(set) var didEnterCreate = false
    private var getAllContinuation: CheckedContinuation<Void, Never>?
    private var createContinuation: CheckedContinuation<Void, Never>?
    private var shouldGateGetAll = false
    private var shouldGateCreate = false

    func gateGetAll() {
        shouldGateGetAll = true
    }

    func releaseGetAll() {
        shouldGateGetAll = false
        getAllContinuation?.resume()
        getAllContinuation = nil
    }

    func gateCreate() {
        shouldGateCreate = true
    }

    func releaseCreate() {
        shouldGateCreate = false
        createContinuation?.resume()
        createContinuation = nil
    }

    func makeTag(id: String, name: String) -> PulpeTag {
        PulpeTag(
            id: id,
            userId: "user-1",
            name: name,
            createdAt: Date(timeIntervalSince1970: 0),
            updatedAt: Date(timeIntervalSince1970: 0)
        )
    }

    func getAll() async throws -> [PulpeTag] {
        getAllCallCount += 1
        if shouldGateGetAll {
            await withCheckedContinuation { continuation in
                getAllContinuation = continuation
            }
        }
        return tags
    }

    func create(_ data: TagCreate) async throws -> PulpeTag {
        lastCreate = data
        didEnterCreate = true
        if shouldGateCreate {
            await withCheckedContinuation { continuation in
                createContinuation = continuation
            }
        }
        return makeTag(id: "created", name: data.name)
    }
}
