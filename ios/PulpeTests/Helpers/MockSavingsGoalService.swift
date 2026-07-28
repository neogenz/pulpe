import Foundation
@testable import Pulpe

/// Test double for `SavingsGoalServicing`. `@MainActor`-isolated (not an `actor`)
/// so call counts and captured payloads are readable synchronously from the
/// `@MainActor` tests that drive `SavingsGoalStore`.
@MainActor
final class MockSavingsGoalService: SavingsGoalServicing {
    var stubbedGoals: [SavingsGoal] = []
    var stubbedProgress: SavingsGoalProgress?
    var stubbedContributions: [SavingsGoalContribution] = []
    var stubbedApplyResult: SavingsGoalPlanApplyResult?
    var stubbedFutureLines: [SavingsGoalFutureLine] = []
    var stubbedDeletionImpact: SavingsGoalDeletionImpact?
    /// When set, every call throws this instead of returning.
    var error: Error?
    var getProgressError: Error?
    var getContributionsError: Error?
    var updateError: Error?
    var createError: Error?
    var deletionError: Error?

    private(set) var getAllCallCount = 0
    private(set) var getProgressCallCount = 0
    private(set) var getContributionsCallCount = 0
    private(set) var applyPlanCallCount = 0
    private(set) var createCallCount = 0
    private(set) var updateCallCount = 0
    private(set) var deleteCallCount = 0
    private(set) var getDeletionImpactCallCount = 0
    private(set) var lastCreate: SavingsGoalCreate?
    private(set) var lastUpdateId: String?
    private(set) var lastUpdate: SavingsGoalUpdate?
    private(set) var lastApplyId: String?
    private(set) var lastApplyPayload: SavingsGoalPlanApply?
    private(set) var lastDeletedId: String?
    private(set) var lastDeletionCommand: SavingsGoalDeletionCommand?

    private(set) var didEnterSecondGetAll = false
    private var secondGetAllContinuation: CheckedContinuation<Void, Never>?
    private var simulatesRefreshRace = false

    func prepareRefreshRace() {
        simulatesRefreshRace = true
    }

    func releaseSecondGetAll() {
        secondGetAllContinuation?.resume()
        secondGetAllContinuation = nil
        simulatesRefreshRace = false
    }

    func getAll() async throws -> [SavingsGoal] {
        getAllCallCount += 1
        if simulatesRefreshRace {
            if getAllCallCount == 1 {
                try await Task.sleep(for: .seconds(60))
            } else if getAllCallCount == 2 {
                didEnterSecondGetAll = true
                await withCheckedContinuation { continuation in
                    secondGetAllContinuation = continuation
                }
            }
        }
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
        if let getProgressError { throw getProgressError }
        if let error { throw error }
        if let stubbedProgress { return stubbedProgress }
        throw URLError(.badServerResponse)
    }

    func getContributions(id: String) async throws -> [SavingsGoalContribution] {
        getContributionsCallCount += 1
        if let getContributionsError { throw getContributionsError }
        if let error { throw error }
        return stubbedContributions
    }

    func applyPlan(id: String, _ payload: SavingsGoalPlanApply) async throws -> SavingsGoalPlanApplyResult {
        applyPlanCallCount += 1
        lastApplyId = id
        lastApplyPayload = payload
        if let error { throw error }
        return stubbedApplyResult ?? SavingsGoalPlanApplyResult(updatedLines: [])
    }

    private(set) var getFutureLinesCallCount = 0
    private(set) var lastFutureLinesId: String?
    private(set) var lastFutureLinesTargetDate: String?
    private(set) var generationStopCallCount = 0
    private(set) var lastGenerationStop: SavingsGoalGenerationStop?

    func getFutureLines(id: String, targetDate: String?) async throws -> [SavingsGoalFutureLine] {
        getFutureLinesCallCount += 1
        lastFutureLinesId = id
        lastFutureLinesTargetDate = targetDate
        if let error { throw error }
        return stubbedFutureLines
    }

    func applyGenerationStop(
        id _: String,
        _ payload: SavingsGoalGenerationStop
    ) async throws -> SavingsGoalGenerationStopResult {
        generationStopCallCount += 1
        lastGenerationStop = payload
        if let error { throw error }
        return SavingsGoalGenerationStopResult(affectedCount: payload.budgetLineIds.count)
    }

    func create(_ data: SavingsGoalCreate) async throws -> SavingsGoal {
        createCallCount += 1
        lastCreate = data
        if let createError { throw createError }
        if let error { throw error }
        let created = SavingsGoal(
            id: "goal-\(createCallCount)",
            userId: "user-1",
            name: data.name,
            targetAmount: data.targetAmount,
            targetDate: data.targetDate,
            status: data.status,
            createdAt: Date(timeIntervalSince1970: 0),
            updatedAt: Date(timeIntervalSince1970: 0),
            initialAmount: data.initialAmount
        )
        stubbedGoals.append(created)
        return created
    }

    func update(id: String, data: SavingsGoalUpdate) async throws -> SavingsGoal {
        updateCallCount += 1
        lastUpdateId = id
        lastUpdate = data
        if let updateError { throw updateError }
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
            updatedAt: Date(timeIntervalSince1970: 0),
            startDate: data.startDate ?? existing.startDate,
            initialAmount: data.initialAmount ?? existing.initialAmount
        )
        if let index = stubbedGoals.firstIndex(where: { $0.id == id }) {
            stubbedGoals[index] = updated
        }
        return updated
    }

    func getDeletionImpact(id _: String) async throws -> SavingsGoalDeletionImpact {
        getDeletionImpactCallCount += 1
        if let error { throw error }
        guard let stubbedDeletionImpact else {
            throw URLError(.badServerResponse)
        }
        return stubbedDeletionImpact
    }

    func delete(id: String, command: SavingsGoalDeletionCommand) async throws {
        deleteCallCount += 1
        lastDeletedId = id
        lastDeletionCommand = command
        if let deletionError { throw deletionError }
        if let error { throw error }
        stubbedGoals.removeAll { $0.id == id }
    }
}
