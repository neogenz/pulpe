import Foundation
@testable import Pulpe

/// Test double for `AssetServicing`. `@MainActor` so call counts are readable synchronously
/// from the `@MainActor` store tests. `hold…` flags suspend a call until `release()`.
@MainActor
final class MockAssetService: AssetServicing {
    var stubbedNetWorth = TestDataFactory.makeNetWorth()
    var stubbedCategory = AssetCategoryRecord(id: "new-category", name: "Starter")
    /// When set, `create` throws it after the category step.
    var createError: Error?
    var snapshotsError: Error?
    var holdGetNetWorth = false
    var holdCreateCategory = false

    private(set) var getNetWorthCallCount = 0
    private(set) var createCallCount = 0
    private(set) var createCategoryCallCount = 0
    private(set) var lastCreate: AssetCreate?
    private(set) var calls: [String] = []
    private(set) var didEnterHold = false
    private var heldContinuation: CheckedContinuation<Void, Never>?

    func release() {
        heldContinuation?.resume()
        heldContinuation = nil
    }

    private func hold() async {
        didEnterHold = true
        await withCheckedContinuation { heldContinuation = $0 }
    }

    private static func record(id: String = "a1") -> AssetRecord {
        AssetRecord(
            id: id, categoryId: "c1", name: "UBS", currency: .chf,
            direction: .own, inPulpe: false, archivedAt: nil
        )
    }

    func getNetWorth() async throws -> NetWorth {
        getNetWorthCallCount += 1
        calls.append("get")
        if holdGetNetWorth { await hold() }
        return stubbedNetWorth
    }

    func create(_ data: AssetCreate) async throws -> AssetRecord {
        createCallCount += 1
        lastCreate = data
        calls.append("create")
        if let createError { throw createError }
        return Self.record()
    }

    func update(id: String, _ data: AssetUpdate) async throws -> AssetRecord {
        calls.append("update")
        return Self.record(id: id)
    }

    func delete(id: String) async throws { calls.append("delete") }

    func recordSnapshots(_ data: AssetSnapshotsCreate) async throws -> AssetSnapshotsResult {
        calls.append("snapshots")
        if let snapshotsError { throw snapshotsError }
        return AssetSnapshotsResult(recordedAt: TestDataFactory.fixedDate)
    }

    func dismissSuggestion(id: String) async throws -> AssetRecord {
        calls.append("dismiss")
        return Self.record(id: id)
    }

    func createCategory(_ data: AssetCategoryWrite) async throws -> AssetCategoryRecord {
        createCategoryCallCount += 1
        calls.append("createCategory")
        if holdCreateCategory { await hold() }
        return AssetCategoryRecord(id: stubbedCategory.id, name: data.name)
    }

    func renameCategory(id: String, _ data: AssetCategoryWrite) async throws -> AssetCategoryRecord {
        calls.append("renameCategory")
        return AssetCategoryRecord(id: id, name: data.name)
    }

    func deleteCategory(id: String) async throws { calls.append("deleteCategory") }
}
