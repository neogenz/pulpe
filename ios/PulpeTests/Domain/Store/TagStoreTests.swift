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
}

@MainActor
private final class MockTagService: TagServicing {
    var tags: [PulpeTag] = []
    private(set) var lastCreate: TagCreate?

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
        tags
    }

    func create(_ data: TagCreate) async throws -> PulpeTag {
        lastCreate = data
        return makeTag(id: "created", name: data.name)
    }
}
