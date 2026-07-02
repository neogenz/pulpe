import Foundation
@testable import Pulpe
import Testing

@MainActor
struct SavingsGoalDetailViewModelTests {
    private func makeGoal(
        id: String,
        status: SavingsGoalStatus = .active
    ) -> SavingsGoal {
        SavingsGoal(
            id: id,
            userId: "user-1",
            name: "Maison",
            targetAmount: 50000,
            targetDate: "2099-01-01",
            status: status,
            createdAt: Date(timeIntervalSince1970: 0),
            updatedAt: Date(timeIntervalSince1970: 0)
        )
    }

    private func makeProgress(
        goalId: String = "g1",
        status: SavingsGoalStatus = .active,
        suggestCompletion: Bool = false,
        linkedLineCount: Int = 2
    ) -> SavingsGoalProgress {
        SavingsGoalProgress(
            goalId: goalId,
            status: status,
            targetAmount: 50000,
            targetDate: "2099-01-01",
            plannedCumulative: 12000,
            confirmed: 9000,
            achievementPercent: 18,
            monthsElapsed: 6,
            monthsRemaining: 18,
            isOverdue: false,
            pace: 2000,
            confirmedPace: 1500,
            required: 2277.78,
            projected: 36000,
            paceStatus: .behind,
            suggestCompletion: suggestCompletion,
            linkedLineCount: linkedLineCount,
            originalTargetAmount: nil,
            originalCurrency: nil,
            targetCurrency: nil,
            exchangeRate: nil
        )
    }

    @Test("load fetches progress from the service")
    func load_fetchesProgress() async {
        let service = MockSavingsGoalService()
        service.stubbedProgress = makeProgress(goalId: "g1")
        let viewModel = SavingsGoalDetailViewModel(goalId: "g1", service: service)

        await viewModel.load()

        #expect(viewModel.progress?.goalId == "g1")
        #expect(viewModel.error == nil)
        #expect(service.getProgressCallCount == 1)
    }

    @Test("changeStatus updates via the store then refetches progress (D2 path)")
    func changeStatus_updatesAndRefetches() async {
        let service = MockSavingsGoalService()
        service.stubbedGoals = [makeGoal(id: "g1", status: .active)]
        service.stubbedProgress = makeProgress(goalId: "g1", suggestCompletion: true)
        let store = SavingsGoalStore(service: service)
        await store.forceRefresh()
        let viewModel = SavingsGoalDetailViewModel(goalId: "g1", service: service)
        await viewModel.load()

        await viewModel.changeStatus(to: .completed, via: store)

        #expect(service.updateCallCount == 1)
        let updated = store.goals.first { $0.id == "g1" }
        #expect(updated?.status == .completed)
        #expect(service.getProgressCallCount == 2, "progress is refetched after a status change")
        #expect(viewModel.error == nil)
    }

    @Test("load surfaces a service error and leaves progress nil")
    func load_surfacesError() async {
        let service = MockSavingsGoalService()
        service.error = APIError.networkError(URLError(.notConnectedToInternet))
        let viewModel = SavingsGoalDetailViewModel(goalId: "g1", service: service)

        await viewModel.load()

        #expect(viewModel.progress == nil)
        #expect(viewModel.error != nil)
    }

    @Test("changeStatus surfaces a store error without refetching")
    func changeStatus_surfacesStoreError() async {
        let service = MockSavingsGoalService()
        service.stubbedGoals = [makeGoal(id: "g1", status: .active)]
        let store = SavingsGoalStore(service: service)
        await store.forceRefresh()
        let viewModel = SavingsGoalDetailViewModel(goalId: "g1", service: service)
        service.error = APIError.networkError(URLError(.timedOut))

        await viewModel.changeStatus(to: .completed, via: store)

        #expect(viewModel.error != nil)
        #expect(service.getProgressCallCount == 0, "no refetch when the status update fails")
    }
}
