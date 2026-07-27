import Foundation
@testable import Pulpe
import Testing

private typealias PulpeTag = Pulpe.Tag

@Suite("TagsSettingsViewModel")
@MainActor
struct TagsSettingsViewModelTests {
    @Test
    func load_withTags_setsCatalogAndCount() async {
        let service = StubTagService(tags: [Self.tag])
        let viewModel = TagsSettingsViewModel(service: service)

        await viewModel.load()

        #expect(!viewModel.isLoading)
        #expect(viewModel.error == nil)
        #expect(viewModel.tags == [Self.tag])
        #expect(viewModel.countLabel == "1 TAG PERSONNEL")
    }

    @Test
    func load_withEmptyCatalog_setsDistinctEmptyState() async {
        let viewModel = TagsSettingsViewModel(service: StubTagService(tags: []))

        await viewModel.load()

        #expect(!viewModel.isLoading)
        #expect(viewModel.error == nil)
        #expect(viewModel.tags.isEmpty)
        #expect(viewModel.countLabel == "0 TAGS PERSONNELS")
    }

    @Test
    func load_afterError_canRetrySuccessfully() async {
        let service = StubTagService(tags: [Self.tag], failuresBeforeSuccess: 1)
        let viewModel = TagsSettingsViewModel(service: service)

        await viewModel.load()

        #expect(viewModel.error != nil)
        #expect(viewModel.tags.isEmpty)

        await viewModel.load()

        let callCount = await service.callCount
        #expect(viewModel.error == nil)
        #expect(viewModel.tags == [Self.tag])
        #expect(callCount == 2)
    }

    private static let tag = PulpeTag(
        id: "tag-1",
        userId: "user-1",
        name: "Assurance",
        createdAt: Date(timeIntervalSince1970: 0),
        updatedAt: Date(timeIntervalSince1970: 0)
    )
}

private actor StubTagService: TagServicing {
    let tags: [PulpeTag]
    let failuresBeforeSuccess: Int
    private(set) var callCount = 0

    init(tags: [PulpeTag], failuresBeforeSuccess: Int = 0) {
        self.tags = tags
        self.failuresBeforeSuccess = failuresBeforeSuccess
    }

    func getAll() async throws -> [PulpeTag] {
        callCount += 1
        if callCount <= failuresBeforeSuccess {
            throw URLError(.notConnectedToInternet)
        }
        return tags
    }

    func create(_ data: TagCreate) async throws -> PulpeTag {
        PulpeTag(
            id: "created",
            userId: "user-1",
            name: data.name,
            createdAt: Date(timeIntervalSince1970: 0),
            updatedAt: Date(timeIntervalSince1970: 0)
        )
    }
}
