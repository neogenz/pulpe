import Foundation

/// Net-worth API surface (PUL-366). A protocol so stores can be driven by a test double.
protocol AssetServicing: Sendable {
    func getNetWorth() async throws -> NetWorth
    func create(_ data: AssetCreate) async throws -> AssetRecord
    func update(id: String, _ data: AssetUpdate) async throws -> AssetRecord
    func delete(id: String) async throws
    func recordSnapshots(_ data: AssetSnapshotsCreate) async throws -> AssetSnapshotsResult
    func dismissSuggestion(id: String) async throws -> AssetRecord
    func createCategory(_ data: AssetCategoryWrite) async throws -> AssetCategoryRecord
    func renameCategory(id: String, _ data: AssetCategoryWrite) async throws -> AssetCategoryRecord
}

actor AssetService: AssetServicing {
    static let shared = AssetService()

    private let apiClient: APIClient

    init(apiClient: APIClient = .shared) {
        self.apiClient = apiClient
    }

    func getNetWorth() async throws -> NetWorth {
        try await apiClient.request(.assets, method: .get)
    }

    func create(_ data: AssetCreate) async throws -> AssetRecord {
        try await apiClient.request(.assets, body: data, method: .post)
    }

    func update(id: String, _ data: AssetUpdate) async throws -> AssetRecord {
        try await apiClient.request(.asset(id: id), body: data, method: .patch)
    }

    func delete(id: String) async throws {
        try await apiClient.requestVoid(.asset(id: id), method: .delete)
    }

    func recordSnapshots(_ data: AssetSnapshotsCreate) async throws -> AssetSnapshotsResult {
        try await apiClient.request(.assetSnapshots, body: data, method: .post)
    }

    func dismissSuggestion(id: String) async throws -> AssetRecord {
        try await apiClient.request(.assetDismissSuggestion(id: id), method: .post)
    }

    func createCategory(_ data: AssetCategoryWrite) async throws -> AssetCategoryRecord {
        try await apiClient.request(.assetCategories, body: data, method: .post)
    }

    func renameCategory(id: String, _ data: AssetCategoryWrite) async throws -> AssetCategoryRecord {
        try await apiClient.request(.assetCategory(id: id), body: data, method: .patch)
    }
}
