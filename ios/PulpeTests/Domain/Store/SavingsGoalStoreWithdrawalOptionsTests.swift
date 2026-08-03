import Foundation
@testable import Pulpe
import Testing

/// The withdrawal-option cache (PUL-329). Balances go stale faster than the goals
/// themselves, so this suite pins when the store may reuse them and when it must
/// go back to the server.
@MainActor
struct SavingsGoalStoreWithdrawalOptionsTests {
    private func makeGoal(id: String) -> SavingsGoal {
        SavingsGoal(
            id: id,
            userId: "user-1",
            name: "Goal",
            targetAmount: 1000,
            targetDate: "2099-01-01",
            status: .active,
            createdAt: Date(timeIntervalSince1970: 0),
            updatedAt: Date(timeIntervalSince1970: 0)
        )
    }

    /// A deletion is simply the cheapest mutation to trigger; the rule under test
    /// is the invalidation, not the deletion itself.
    private func deletionCommand() -> SavingsGoalDeletionCommand {
        SavingsGoalDeletionCommand(
            mode: .goalOnly,
            revision: SavingsGoalDeletionRevision(
                templateLines: [],
                budgetLines: [],
                transactions: []
            )
        )
    }

    private func makeWithdrawalOption(id: String = "g1") -> SavingsGoalWithdrawalOption {
        SavingsGoalWithdrawalOption(
            goalId: id,
            name: "Maison",
            status: .active,
            availableAmount: 10000,
            currency: .chf
        )
    }

    @Test("withdrawal options are served from the short-lived cache on a second read")
    func fetchWithdrawalOptions_reusesTheCachedBalances() async throws {
        let service = MockSavingsGoalService()
        service.stubbedWithdrawalOptions = [makeWithdrawalOption()]
        let store = SavingsGoalStore(service: service)

        _ = try await store.fetchWithdrawalOptions()
        let cached = try await store.fetchWithdrawalOptions()

        #expect(service.getWithdrawalOptionsCallCount == 1)
        #expect(cached.first?.availableAmount == 10000)
    }

    @Test("a forced read bypasses the cache after a server refusal")
    func fetchWithdrawalOptions_forceRefreshHitsTheService() async throws {
        let service = MockSavingsGoalService()
        service.stubbedWithdrawalOptions = [makeWithdrawalOption()]
        let store = SavingsGoalStore(service: service)

        _ = try await store.fetchWithdrawalOptions()
        _ = try await store.fetchWithdrawalOptions(forceRefresh: true)

        #expect(service.getWithdrawalOptionsCallCount == 2)
    }

    @Test("a budget-data mutation makes the displayed balances stale")
    func fetchWithdrawalOptions_invalidatedByMutation() async throws {
        let service = MockSavingsGoalService()
        service.stubbedGoals = [makeGoal(id: "g1")]
        service.stubbedWithdrawalOptions = [makeWithdrawalOption()]
        let store = SavingsGoalStore(service: service)
        _ = try await store.fetchWithdrawalOptions()

        try await store.delete(id: "g1", command: deletionCommand())
        _ = try await store.fetchWithdrawalOptions()

        #expect(service.getWithdrawalOptionsCallCount == 2)
    }
}
