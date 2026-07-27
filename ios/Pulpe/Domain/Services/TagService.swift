protocol TagServicing: Sendable {
    func getAll() async throws -> [Tag]
    func create(_ data: TagCreate) async throws -> Tag
}

actor TagService: TagServicing {
    static let shared = TagService()

    private let apiClient: APIClient

    init(apiClient: APIClient = .shared) {
        self.apiClient = apiClient
    }

    func getAll() async throws -> [Tag] {
        try await apiClient.request(.tags, method: .get)
    }

    func create(_ data: TagCreate) async throws -> Tag {
        try await apiClient.request(.tags, body: data, method: .post)
    }
}
