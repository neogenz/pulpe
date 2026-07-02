import Foundation
@testable import Pulpe

/// Test double for `SavingsGoalServicing`. `@MainActor`-isolated (not an `actor`)
/// so call counts and captured payloads are readable synchronously from the
/// `@MainActor` tests that drive `SavingsGoalStore`.
@MainActor
final class MockSavingsGoalService: SavingsGoalServicing {
    var stubbedGoals: [SavingsGoal] = []
    var stubbedProgress: SavingsGoalProgress?
    /// When set, every call throws this instead of returning.
    var error: Error?

    private(set) var getAllCallCount = 0
    private(set) var getProgressCallCount = 0
    private(set) var createCallCount = 0
    private(set) var updateCallCount = 0
    private(set) var deleteCallCount = 0
    private(set) var lastCreate: SavingsGoalCreate?
    private(set) var lastUpdateId: String?
    private(set) var lastUpdate: SavingsGoalUpdate?
    private(set) var lastDeletedId: String?

    func getAll() async throws -> [SavingsGoal] {
        getAllCallCount += 1
        if let error { throw error }
        return stubbedGoals
    }

    func get(id: String) async throws -> SavingsGoal {
        if let error { throw error }
        if let goal = stubbedGoals.first(where: { $0.id == id }) { return goal }
        throw URLError(.badServerResponse)
    }

    func getProgress(id: String) async throws -> SavingsGoalProgress {
        getProgressCallCount += 1
        if let error { throw error }
        if let stubbedProgress { return stubbedProgress }
        throw URLError(.badServerResponse)
    }

    func create(_ data: SavingsGoalCreate) async throws -> SavingsGoal {
        createCallCount += 1
        lastCreate = data
        if let error { throw error }
        let created = SavingsGoal(
            id: "goal-\(createCallCount)",
            userId: "user-1",
            name: data.name,
            targetAmount: data.targetAmount,
            targetDate: data.targetDate,
            status: data.status,
            createdAt: Date(timeIntervalSince1970: 0),
            updatedAt: Date(timeIntervalSince1970: 0)
        )
        stubbedGoals.append(created)
        return created
    }

    func update(id: String, data: SavingsGoalUpdate) async throws -> SavingsGoal {
        updateCallCount += 1
        lastUpdateId = id
        lastUpdate = data
        if let error { throw error }
        guard let existing = stubbedGoals.first(where: { $0.id == id }) else {
            throw URLError(.badServerResponse)
        }
        let updated = SavingsGoal(
            id: existing.id,
            userId: existing.userId,
            name: data.name ?? existing.name,
            targetAmount: data.targetAmount ?? existing.targetAmount,
            targetDate: data.targetDate ?? existing.targetDate,
            status: data.status ?? existing.status,
            createdAt: existing.createdAt,
            updatedAt: Date(timeIntervalSince1970: 0)
        )
        if let index = stubbedGoals.firstIndex(where: { $0.id == id }) {
            stubbedGoals[index] = updated
        }
        return updated
    }

    func delete(id: String) async throws {
        deleteCallCount += 1
        lastDeletedId = id
        if let error { throw error }
        stubbedGoals.removeAll { $0.id == id }
    }
}
