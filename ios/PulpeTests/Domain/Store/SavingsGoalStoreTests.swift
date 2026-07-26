// swiftlint:disable type_body_length
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

    @Test("deadline reconciliation is one PATCH and invalidates budget data")
    func update_reconciliationForwardsAtomicallyAndInvalidates() async throws {
        let service = MockSavingsGoalService()
        service.stubbedGoals = [makeGoal(id: "g1")]
        let store = SavingsGoalStore(service: service)
        nonisolated(unsafe) var invalidationCount = 0
        store.onBudgetDataMutation = { invalidationCount += 1 }
        await store.forceRefresh()

        _ = try await store.update(
            id: "g1",
            data: SavingsGoalUpdate(
                name: "Maison",
                targetDate: .some("2098-01-01"),
                reconciliation: SavingsGoalGenerationStop(
                    mode: .freeze,
                    budgetLineIds: ["line-1"]
                )
            )
        )

        #expect(service.updateCallCount == 1)
        #expect(service.generationStopCallCount == 0)
        #expect(service.lastUpdate?.name == "Maison")
        #expect(service.lastUpdate?.reconciliation?.mode == .freeze)
        #expect(service.lastUpdate?.reconciliation?.budgetLineIds == ["line-1"])
        #expect(invalidationCount == 1)
    }

    @Test("deadline preview forwards the requested target date")
    func futureLines_forwardsTargetDate() async throws {
        let service = MockSavingsGoalService()
        let store = SavingsGoalStore(service: service)

        _ = try await store.getFutureLines(id: "g1", targetDate: "2030-04-27")

        #expect(service.lastFutureLinesId == "g1")
        #expect(service.lastFutureLinesTargetDate == "2030-04-27")
    }

    @Test("required refresh never retries PATCH and only reopens for fresh candidates")
    func reconciliationRequired_refreshesBeforeAnotherDecision() async throws {
        let service = MockSavingsGoalService()
        let store = SavingsGoalStore(service: service)
        var patch = SavingsGoalUpdate(
            name: "Maison",
            targetDate: .some("2030-04-27"),
            reconciliation: SavingsGoalGenerationStop(mode: .freeze, budgetLineIds: ["stale"])
        )

        let empty = try await SavingsGoalDetailView.refreshedDeadlineDecision(
            id: "g1",
            update: patch,
            targetDate: "2030-04-27",
            store: store
        )
        #expect(empty?.lines == nil)
        #expect(service.updateCallCount == 0)

        service.stubbedFutureLines = [
            SavingsGoalFutureLine(budgetLineId: "fresh", amount: 100, month: 5, year: 2030),
        ]
        patch.reconciliation = SavingsGoalGenerationStop(mode: .remove, budgetLineIds: ["stale"])
        let refreshed = try await SavingsGoalDetailView.refreshedDeadlineDecision(
            id: "g1",
            update: patch,
            targetDate: "2030-04-27",
            store: store
        )
        let decision = try #require(refreshed)

        #expect(decision.lines.map(\.budgetLineId) == ["fresh"])
        #expect(decision.update.reconciliation?.budgetLineIds == nil, "A fresh decision is mandatory")
        #expect(service.updateCallCount == 0, "Refreshing must never auto-retry the PATCH")
    }

    @Test("committed reconciliation recalculation failure refreshes goals without retrying PATCH")
    func update_reconciliationPartialFailureRefreshesGoals() async {
        let service = MockSavingsGoalService()
        service.stubbedGoals = [makeGoal(id: "g1", name: "Avant")]
        let store = SavingsGoalStore(service: service)
        nonisolated(unsafe) var invalidationCount = 0
        store.onBudgetDataMutation = { invalidationCount += 1 }
        await store.forceRefresh()
        service.stubbedGoals = [makeGoal(id: "g1", name: "Après")]
        service.updateError = APIError.savingsGoalReconciliationRecalculationFailed

        await #expect(throws: APIError.self) {
            _ = try await store.update(
                id: "g1",
                data: SavingsGoalUpdate(
                    reconciliation: SavingsGoalGenerationStop(mode: .remove, budgetLineIds: ["line-1"])
                )
            )
        }

        #expect(service.updateCallCount == 1)
        #expect(service.getAllCallCount == 2)
        #expect(store.goals.first?.name == "Après")
        #expect(invalidationCount == 1)
    }

    @Test("all deadline reconciliation API codes are localized and classified")
    func reconciliationErrors_areMapped() {
        let required = APIError.from(code: "ERR_SAVINGS_GOAL_RECONCILIATION_REQUIRED", message: nil)
        let conflict = APIError.from(code: "ERR_SAVINGS_GOAL_RECONCILIATION_CONFLICT", message: nil)
        let failed = APIError.from(code: "ERR_SAVINGS_GOAL_RECONCILIATION_FAILED", message: nil)
        let recalculation = APIError.from(
            code: "ERR_SAVINGS_GOAL_RECONCILIATION_RECALCULATION_FAILED",
            message: nil
        )

        #expect(required.requiresSavingsGoalReconciliationRefresh)
        #expect(conflict.requiresSavingsGoalReconciliationRefresh)
        #expect(!failed.requiresSavingsGoalReconciliationRefresh)
        #expect(!recalculation.requiresSavingsGoalReconciliationRefresh)
        #expect([required, conflict, failed, recalculation].allSatisfy { $0.errorDescription != nil })
    }

    @Test("future-lines endpoint encodes targetDate as a query item")
    func futureLinesEndpoint_encodesTargetDate() throws {
        let baseURL = try #require(URL(string: "https://api.pulpe.app"))
        let request = Endpoint.savingsGoalFutureLines(
            id: "goal-1",
            targetDate: "2030-04-27"
        ).urlRequest(baseURL: baseURL)
        let url = try #require(request.url)
        let components = try #require(URLComponents(url: url, resolvingAgainstBaseURL: false))

        #expect(components.path == "/savings-goals/goal-1/future-lines")
        #expect(components.queryItems == [URLQueryItem(name: "targetDate", value: "2030-04-27")])
    }

    @Test("delete removes the goal from the cache")
    func delete_removes() async throws {
        let service = MockSavingsGoalService()
        service.stubbedGoals = [makeGoal(id: "g1")]
        let store = SavingsGoalStore(service: service)
        nonisolated(unsafe) var invalidationCount = 0
        store.onBudgetDataMutation = { invalidationCount += 1 }
        await store.forceRefresh()

        try await store.delete(id: "g1")

        #expect(store.goals.isEmpty)
        #expect(service.lastDeletedId == "g1")
        #expect(invalidationCount == 1)
    }

    @Test("delete does not invalidate sibling stores when the API call fails")
    func delete_failure_doesNotInvalidate() async {
        let service = MockSavingsGoalService()
        service.stubbedGoals = [makeGoal(id: "g1")]
        let store = SavingsGoalStore(service: service)
        nonisolated(unsafe) var invalidationCount = 0
        store.onBudgetDataMutation = { invalidationCount += 1 }
        await store.forceRefresh()
        service.error = APIError.networkError(URLError(.notConnectedToInternet))

        await #expect(throws: APIError.self) {
            try await store.delete(id: "g1")
        }

        #expect(store.goals.map(\.id) == ["g1"])
        #expect(invalidationCount == 0)
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
