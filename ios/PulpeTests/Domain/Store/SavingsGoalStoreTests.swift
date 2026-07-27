import Foundation
@testable import Pulpe
import Testing

@MainActor
struct SavingsGoalStoreTests {
    private func makeGoal(
        id: String,
        name: String = "Goal",
        status: SavingsGoalStatus = .active
    ) -> SavingsGoal {
        SavingsGoal(
            id: id,
            userId: "user-1",
            name: name,
            targetAmount: 1000,
            targetDate: "2099-01-01",
            status: status,
            createdAt: Date(timeIntervalSince1970: 0),
            updatedAt: Date(timeIntervalSince1970: 0)
        )
    }

    private func makeDeletionImpact(goalId: String = "g1") -> SavingsGoalDeletionImpact {
        SavingsGoalDeletionImpact(
            goalId: goalId,
            summary: SavingsGoalDeletionSummary(
                templateLineCount: 0,
                templateLineTotal: 0,
                budgetCount: 0,
                budgetLineCount: 0,
                budgetLineTotal: 0,
                transactionCount: 0,
                transactionTotal: 0
            ),
            templateLines: [],
            budgets: [],
            revision: SavingsGoalDeletionRevision(
                templateLines: [],
                budgetLines: [],
                transactions: []
            )
        )
    }

    private func deletionCommand(
        mode: SavingsGoalDeletionMode = .goalOnly
    ) -> SavingsGoalDeletionCommand {
        SavingsGoalDeletionCommand(
            mode: mode,
            revision: makeDeletionImpact().revision
        )
    }

    @Test("forceRefresh loads goals, ACTIVE before COMPLETED")
    func forceRefresh_loadsAndSorts() async {
        let service = MockSavingsGoalService()
        service.stubbedGoals = [
            makeGoal(id: "done", name: "Alpha", status: .completed),
            makeGoal(id: "active", name: "Zebra", status: .active),
        ]
        let store = SavingsGoalStore(service: service)

        await store.forceRefresh()

        #expect(store.goals.count == 2)
        #expect(store.goals.first?.status == .active, "ACTIVE goals sort before COMPLETED")
        #expect(store.goals.last?.status == .completed)
        #expect(store.hasLoadedOnce)
        #expect(store.error == nil)
    }

    @Test("create appends to the cache and forwards the DTO")
    func create_appends() async throws {
        let service = MockSavingsGoalService()
        let store = SavingsGoalStore(service: service)

        let created = try await store.create(
            SavingsGoalCreate(name: "Maison", targetAmount: 5000, targetDate: "2099-01-01", status: .active)
        )

        #expect(store.goals.count == 1)
        #expect(store.goals.first?.id == created.id)
        #expect(service.lastCreate?.name == "Maison")
    }

    @Test("create refreshes committed data when baseline recalculation fails")
    func create_partialFailureRefreshesAndInvalidates() async {
        let service = MockSavingsGoalService()
        service.stubbedGoals = [makeGoal(id: "committed", name: "Maison")]
        service.createError = APIError.from(
            code: "ERR_SAVINGS_GOAL_BASELINE_RECALCULATION_FAILED",
            message: nil
        )
        let store = SavingsGoalStore(service: service)
        nonisolated(unsafe) var invalidationCount = 0
        store.onBudgetDataMutation = { invalidationCount += 1 }

        do {
            _ = try await store.create(
                SavingsGoalCreate(
                    name: "Maison",
                    targetAmount: 5000,
                    targetDate: "2099-01-01",
                    status: .active,
                    monthlyContribution: 250
                )
            )
            Issue.record("Expected the partial failure to be rethrown")
        } catch let error as APIError {
            #expect(
                error.errorDescription ==
                    "L'objectif et sa prévision mensuelle ont bien été créés, mais les soldes "
                    + "n'ont pas pu être actualisés — recharge la page sans recréer l'objectif"
            )
        } catch {
            Issue.record("Expected APIError, got \(error)")
        }

        #expect(store.goals.map(\.id) == ["committed"])
        #expect(service.getAllCallCount == 1)
        #expect(invalidationCount == 1)
    }

    @Test("update replaces the goal in the cache (status change)")
    func update_replaces() async throws {
        let service = MockSavingsGoalService()
        service.stubbedGoals = [makeGoal(id: "g1", status: .active)]
        let store = SavingsGoalStore(service: service)
        await store.forceRefresh()

        _ = try await store.update(id: "g1", data: SavingsGoalUpdate(status: .completed))

        #expect(store.goals.first { $0.id == "g1" }?.status == .completed)
        #expect(service.lastUpdate?.status == .completed)
    }

    @Test("getDeletionImpact always asks the service for a fresh preview")
    func getDeletionImpact_fetchesFresh() async throws {
        let service = MockSavingsGoalService()
        service.stubbedDeletionImpact = makeDeletionImpact()
        let store = SavingsGoalStore(service: service)

        _ = try await store.getDeletionImpact(id: "g1")
        _ = try await store.getDeletionImpact(id: "g1")

        #expect(service.getDeletionImpactCallCount == 2)
    }

    @Test(
        "delete forwards each mode and the displayed revision",
        arguments: SavingsGoalDeletionMode.allCases
    )
    func delete_forwardsCommand(mode: SavingsGoalDeletionMode) async throws {
        let service = MockSavingsGoalService()
        service.stubbedGoals = [makeGoal(id: "g1")]
        let store = SavingsGoalStore(service: service)
        nonisolated(unsafe) var invalidationCount = 0
        store.onBudgetDataMutation = { invalidationCount += 1 }
        await store.forceRefresh()

        let command = deletionCommand(mode: mode)
        try await store.delete(id: "g1", command: command)

        #expect(store.goals.isEmpty)
        #expect(service.lastDeletedId == "g1")
        #expect(service.lastDeletionCommand == command)
        #expect(invalidationCount == 1)
    }

    @Test("delete preserves the goal when the displayed impact changed")
    func delete_conflictPreservesGoal() async {
        let service = MockSavingsGoalService()
        service.stubbedGoals = [makeGoal(id: "g1")]
        let store = SavingsGoalStore(service: service)
        nonisolated(unsafe) var invalidationCount = 0
        store.onBudgetDataMutation = { invalidationCount += 1 }
        await store.forceRefresh()
        service.deletionError = APIError.from(
            code: "ERR_SAVINGS_GOAL_DELETION_IMPACT_CHANGED",
            message: nil
        )

        await #expect(throws: APIError.self) {
            try await store.delete(id: "g1", command: deletionCommand())
        }

        #expect(store.goals.map(\.id) == ["g1"])
        #expect(invalidationCount == 0)
    }

    @Test("delete settles committed state when recalculation failed")
    func delete_partialFailureSettlesCommittedState() async {
        let service = MockSavingsGoalService()
        service.stubbedGoals = [makeGoal(id: "g1")]
        let store = SavingsGoalStore(service: service)
        nonisolated(unsafe) var invalidationCount = 0
        store.onBudgetDataMutation = { invalidationCount += 1 }
        await store.forceRefresh()
        service.deletionError = APIError.from(
            code: "ERR_SAVINGS_GOAL_DELETION_RECALCULATION_FAILED",
            message: nil
        )

        await #expect(throws: APIError.self) {
            try await store.delete(id: "g1", command: deletionCommand())
        }

        #expect(store.goals.isEmpty)
        #expect(invalidationCount == 1)
    }

    @Test("applyGenerationStop forwards the decision and invalidates sibling stores once")
    func applyGenerationStop_forwardsAndInvalidates() async throws {
        let service = MockSavingsGoalService()
        let store = SavingsGoalStore(service: service)
        nonisolated(unsafe) var invalidationCount = 0
        store.onBudgetDataMutation = { invalidationCount += 1 }

        let result = try await store.applyGenerationStop(
            id: "g1",
            SavingsGoalGenerationStop(mode: .remove, budgetLineIds: ["l1", "l2"])
        )

        #expect(service.lastGenerationStop?.mode == .remove)
        #expect(service.lastGenerationStop?.budgetLineIds == ["l1", "l2"])
        #expect(result.affectedCount == 2)
        #expect(invalidationCount == 1)
    }

    @Test("applyGenerationStop invalidates sibling stores when the decision committed but recalculation failed")
    func applyGenerationStop_partialFailureInvalidates() async {
        let service = MockSavingsGoalService()
        service.error = APIError.from(
            code: "ERR_SAVINGS_GOAL_GENERATION_STOP_RECALCULATION_FAILED",
            message: nil
        )
        let store = SavingsGoalStore(service: service)
        nonisolated(unsafe) var invalidationCount = 0
        store.onBudgetDataMutation = { invalidationCount += 1 }

        do {
            _ = try await store.applyGenerationStop(
                id: "g1",
                SavingsGoalGenerationStop(mode: .remove, budgetLineIds: ["l1"])
            )
            Issue.record("Expected the partial failure to be rethrown")
        } catch let error as APIError {
            #expect(
                error.errorDescription ==
                    "La décision a bien été enregistrée, mais les soldes n'ont pas pu être actualisés — "
                    + "recharge la page sans réessayer"
            )
        } catch {
            Issue.record("Expected APIError, got \(error)")
        }

        #expect(invalidationCount == 1)
    }

    @Test("forceRefresh surfaces an API error")
    func forceRefresh_surfacesError() async {
        let service = MockSavingsGoalService()
        service.error = APIError.networkError(URLError(.notConnectedToInternet))
        let store = SavingsGoalStore(service: service)

        await store.forceRefresh()

        #expect(store.error != nil)
        #expect(store.goals.isEmpty)
    }

    @Test("forceRefresh keeps loading while the latest request is pending")
    func forceRefresh_overlappingRequests_keepsLatestLoadingState() async {
        let service = MockSavingsGoalService()
        service.prepareRefreshRace()
        let store = SavingsGoalStore(service: service)

        let firstRefresh = Task { await store.forceRefresh() }
        await waitForCondition("first refresh must start") {
            service.getAllCallCount == 1
        }

        let secondRefresh = Task { await store.forceRefresh() }
        await waitForCondition("second refresh must reach the service") {
            service.didEnterSecondGetAll
        }
        await firstRefresh.value

        #expect(store.isLoading, "The cancelled request must not clear the latest request's loading state")

        service.releaseSecondGetAll()
        await secondRefresh.value
        #expect(!store.isLoading)
    }

    @Test("reset clears the cache")
    func reset_clears() async {
        let service = MockSavingsGoalService()
        service.stubbedGoals = [makeGoal(id: "g1")]
        let store = SavingsGoalStore(service: service)
        await store.forceRefresh()
        #expect(!store.goals.isEmpty)

        store.reset()

        #expect(store.goals.isEmpty)
        #expect(store.hasLoadedOnce == false)
        #expect(store.error == nil)
    }
}
