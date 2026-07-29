// swiftlint:disable file_length
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
        linkedLineCount: Int = 2,
        required: Decimal = 2277.78,
        months: [SavingsGoalPlanMonth] = []
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
            required: required,
            projected: 36000,
            paceStatus: .behind,
            suggestCompletion: suggestCompletion,
            linkedLineCount: linkedLineCount,
            originalTargetAmount: nil,
            originalCurrency: nil,
            targetCurrency: nil,
            exchangeRate: nil,
            months: months
        )
    }

    @Test("detail starts loading instead of rendering an empty screen")
    func initialState_isLoading() {
        let viewModel = SavingsGoalDetailViewModel(goalId: "g1", service: MockSavingsGoalService())

        #expect(viewModel.isLoading)
        #expect(viewModel.progress == nil)
        #expect(viewModel.error == nil)
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
        #expect(service.getContributionsCallCount == 1)
    }

    @Test("load fetches linked forecasts and their real transactions")
    func load_fetchesContributions() async {
        let service = MockSavingsGoalService()
        service.stubbedProgress = makeProgress(goalId: "g1")
        service.stubbedContributions = [makeContribution()]
        let viewModel = SavingsGoalDetailViewModel(goalId: "g1", service: service)

        await viewModel.load()

        #expect(viewModel.contributions.map(\.lineId) == ["line-1"])
        #expect(viewModel.contributions.first?.transactions.map(\.id) == ["tx-1"])
        #expect(viewModel.contributionsError == nil)
    }

    @Test("a contributions failure keeps the goal progress usable")
    func load_contributionsFailureIsInline() async {
        let service = MockSavingsGoalService()
        service.stubbedProgress = makeProgress(goalId: "g1")
        service.getContributionsError = APIError.networkError(URLError(.timedOut))
        let viewModel = SavingsGoalDetailViewModel(goalId: "g1", service: service)

        await viewModel.load()

        #expect(viewModel.progress != nil)
        #expect(viewModel.error == nil)
        #expect(viewModel.contributionsError != nil)
    }

    @Test("recovery applies only repairable budgets with the rounded required amount")
    func applyMissingForecasts_buildsPeriodPayload() async throws {
        let service = MockSavingsGoalService()
        let repairable = makePlanMonth(month: 8, state: .gap, isLocked: false, planned: 0)
        let missingBudget = SavingsGoalPlanMonth(
            month: 9,
            year: 2099,
            state: .gap,
            isLocked: false,
            hasBudget: false,
            isProvisionable: true,
            plannedAmount: 0,
            confirmedAmount: 0,
            plannedCumulative: 0,
            confirmedCumulative: 0,
            lines: []
        )
        let required = try #require(Decimal(string: "175.345"))
        let progress = makeProgress(
            required: required,
            months: [
                SavingsGoalPlanMonth(
                    month: repairable.month,
                    year: repairable.year,
                    state: repairable.state,
                    isLocked: repairable.isLocked,
                    hasBudget: true,
                    isProvisionable: true,
                    plannedAmount: repairable.plannedAmount,
                    confirmedAmount: repairable.confirmedAmount,
                    plannedCumulative: repairable.plannedCumulative,
                    confirmedCumulative: repairable.confirmedCumulative,
                    lines: repairable.lines
                ),
                missingBudget,
            ]
        )
        let viewModel = SavingsGoalDetailViewModel(goalId: "g1", service: service)

        let succeeded = await viewModel.applyMissingForecasts(from: progress)
        let payload = try #require(service.lastApplyPayload)

        #expect(succeeded)
        #expect(payload.monthAdjustments.isEmpty)
        #expect(payload.missingMonthAdjustments.count == 1)
        #expect(payload.missingMonthAdjustments.first?.month == 8)
        #expect(payload.missingMonthAdjustments.first?.amount == Decimal(string: "175.35"))
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

    @Test("changeStatus stays successful when only the progress refetch fails")
    func changeStatus_refetchFailure_doesNotReportMutationFailure() async {
        let service = MockSavingsGoalService()
        service.stubbedGoals = [makeGoal(id: "g1", status: .active)]
        let store = SavingsGoalStore(service: service)
        await store.forceRefresh()
        let viewModel = SavingsGoalDetailViewModel(goalId: "g1", service: service)
        service.getProgressError = APIError.networkError(URLError(.timedOut))

        await viewModel.changeStatus(to: .completed, via: store)

        #expect(store.goals.first?.status == .completed)
        #expect(service.getProgressCallCount == 1)
        #expect(viewModel.error == nil, "a failed refresh must not turn a persisted status change into an error")
    }

    // MARK: - Day-1 verdict gate (no reproach at commitment time)

    private func makePlanMonth(
        month: Int,
        state: SavingsPlanMonthState,
        isLocked: Bool,
        planned: Decimal = 200
    ) -> SavingsGoalPlanMonth {
        SavingsGoalPlanMonth(
            month: month,
            year: 2099,
            state: state,
            isLocked: isLocked,
            plannedAmount: planned,
            confirmedAmount: 0,
            plannedCumulative: planned,
            confirmedCumulative: 0,
            lines: []
        )
    }

    @Test("day 1 — no plan month closed yet: the pace verdict stays hidden")
    func hasClosedPlanMonth_day1_isFalse() {
        let months = [
            makePlanMonth(month: 7, state: .current, isLocked: false),
            makePlanMonth(month: 8, state: .future, isLocked: false),
        ]

        let hasClosed = SavingsGoalDetailViewModel.hasClosedPlanMonth(months)

        #expect(hasClosed == false)
    }

    @Test("one closed month behind: the pace verdict comes back")
    func hasClosedPlanMonth_lockedMonthBehind_isTrue() {
        let months = [
            makePlanMonth(month: 6, state: .past, isLocked: true),
            makePlanMonth(month: 7, state: .current, isLocked: false),
        ]

        let hasClosed = SavingsGoalDetailViewModel.hasClosedPlanMonth(months)

        #expect(hasClosed == true)
    }

    @Test("a locked pre-start row does not trigger a pace verdict")
    func hasClosedPlanMonth_preStartRowIsIgnored() {
        let month = SavingsGoalPlanMonth(
            month: 6,
            year: 2099,
            state: .past,
            isLocked: true,
            isContributionEligible: false,
            plannedAmount: 200,
            confirmedAmount: 200,
            plannedCumulative: 0,
            confirmedCumulative: 0,
            lines: []
        )

        #expect(SavingsGoalDetailViewModel.hasClosedPlanMonth([month]) == false)
    }

    @Test("empty timeline (legacy payload): no verdict, and no beat amount either")
    func emptyTimeline_hidesVerdictAndBeat() {
        let hasClosed = SavingsGoalDetailViewModel.hasClosedPlanMonth([])
        let beatAmount = SavingsGoalDetailViewModel.currentMonthPlannedAmount([])

        #expect(hasClosed == false)
        #expect(beatAmount == nil)
    }

    @Test("the day-1 beat carries the current month's planned amount")
    func currentMonthPlannedAmount_readsCurrentMonth() {
        let months = [
            makePlanMonth(month: 7, state: .current, isLocked: false, planned: 250),
            makePlanMonth(month: 8, state: .future, isLocked: false, planned: 300),
        ]

        let amount = SavingsGoalDetailViewModel.currentMonthPlannedAmount(months)

        #expect(amount == 250)
    }

    // MARK: - Deadline stat vs planned pace (one sentence when they diverge)

    @Test("required within the ±5 % verdict band keeps the simple stat form")
    func requiredMatchesPlannedPace_withinBand_isTrue() {
        let atEdge = SavingsGoalDetailViewModel.requiredMatchesPlannedPace(planned: 200, required: 210)
        let equal = SavingsGoalDetailViewModel.requiredMatchesPlannedPace(planned: 200, required: 200)

        #expect(atEdge == true)
        #expect(equal == true)
    }

    @Test("required drifting past the band switches to the reconciliation sentence")
    func requiredMatchesPlannedPace_outsideBand_isFalse() {
        let above = SavingsGoalDetailViewModel.requiredMatchesPlannedPace(planned: 200, required: 334)
        let below = SavingsGoalDetailViewModel.requiredMatchesPlannedPace(planned: 200, required: 150)

        #expect(above == false)
        #expect(below == false)
    }

    @Test("a zero planned pace never matches a positive required amount")
    func requiredMatchesPlannedPace_zeroPlanned_isFalse() {
        let matches = SavingsGoalDetailViewModel.requiredMatchesPlannedPace(planned: 0, required: 100)

        #expect(matches == false)
    }

    private func makeContribution() -> SavingsGoalContribution {
        SavingsGoalContribution(
            lineId: "line-1",
            name: "Épargne maison",
            amount: 500,
            checkedAt: nil,
            budgetMonth: 7,
            budgetYear: 2026,
            transactions: [
                Transaction(
                    id: "tx-1",
                    budgetId: "budget-1",
                    budgetLineId: "line-1",
                    name: "Virement épargne",
                    amount: 500,
                    kind: .saving,
                    transactionDate: Date(timeIntervalSince1970: 0),
                    category: nil,
                    checkedAt: Date(timeIntervalSince1970: 0),
                    createdAt: Date(timeIntervalSince1970: 0),
                    updatedAt: Date(timeIntervalSince1970: 0)
                ),
            ]
        )
    }
}

@MainActor
struct GoalPlanSimulatorViewModelTests {
    private func makeGoal(
        targetAmount: Decimal? = 1_000,
        targetDate: String? = "2099-03-01"
    ) -> SavingsGoal {
        SavingsGoal(
            id: "g1",
            userId: "user-1",
            name: "Maison",
            targetAmount: targetAmount,
            targetDate: targetDate,
            status: .active,
            createdAt: Date(timeIntervalSince1970: 0),
            updatedAt: Date(timeIntervalSince1970: 0)
        )
    }

    private func makeMonth(
        month: Int,
        planned: Decimal,
        isProvisionable: Bool = false
    ) -> SavingsGoalPlanMonth {
        SavingsGoalPlanMonth(
            month: month,
            year: 2099,
            state: isProvisionable ? .gap : .future,
            isLocked: false,
            isProvisionable: isProvisionable,
            plannedAmount: planned,
            confirmedAmount: 0,
            plannedCumulative: planned,
            confirmedCumulative: 0,
            lines: isProvisionable ? [] : [
                SavingsGoalPlanLine(
                    budgetLineId: "line-\(month)",
                    amount: planned,
                    checkedAt: nil,
                    isManuallyAdjusted: false
                ),
            ]
        )
    }

    private func makeProgress(
        months: [SavingsGoalPlanMonth]? = nil,
        initialAmount: Decimal = 0,
        targetAmount: Decimal? = 1_000,
        targetDate: String? = "2099-03-01"
    ) -> SavingsGoalProgress {
        SavingsGoalProgress(
            goalId: "g1",
            status: .active,
            targetAmount: targetAmount,
            targetDate: targetDate,
            plannedCumulative: 600,
            confirmed: 0,
            initialAmount: initialAmount,
            achievementPercent: 0,
            monthsElapsed: 0,
            monthsRemaining: 3,
            isOverdue: false,
            pace: 200,
            confirmedPace: 0,
            required: 333.34,
            projected: 600,
            paceStatus: .behind,
            suggestCompletion: false,
            linkedLineCount: 3,
            originalTargetAmount: nil,
            originalCurrency: nil,
            targetCurrency: nil,
            exchangeRate: nil,
            months: months ?? [
                makeMonth(month: 1, planned: 100),
                makeMonth(month: 2, planned: 200),
                makeMonth(month: 3, planned: 300),
            ]
        )
    }

    private func makeViewModel(
        progress: SavingsGoalProgress? = nil,
        service: MockSavingsGoalService = MockSavingsGoalService()
    ) -> GoalPlanSimulatorViewModel {
        GoalPlanSimulatorViewModel(
            goal: makeGoal(),
            progress: progress ?? makeProgress(),
            currency: .chf,
            payDay: 1,
            service: service
        )
    }

    @Test("opens on the current plan without pending changes")
    func init_usesBaseline() {
        let viewModel = makeViewModel()

        #expect(viewModel.planChanges.isEmpty)
        #expect(viewModel.isDirty == false)
        #expect(viewModel.canApply == false)
    }

    @Test("a monthly override keeps the global amount as the baseline for every other month")
    func setMonth_preservesGlobalBaseline() {
        let viewModel = makeViewModel()
        let overriddenKey = 2099 * 12 + 2

        viewModel.setGlobalAmount(250)
        viewModel.setMonth(key: overriddenKey, amount: 400)

        #expect(viewModel.globalAmount == 250)
        #expect(viewModel.sliderValue == 250)
        #expect(viewModel.simulatedAmount(forKey: 2099 * 12 + 1) == 250)
        #expect(viewModel.simulatedAmount(forKey: overriddenKey) == 400)
        #expect(viewModel.simulatedAmount(forKey: 2099 * 12 + 3) == 250)
        #expect(viewModel.hasVariableMonthlyAmounts)
    }

    @Test("a new global gesture replaces every monthly override")
    func setGlobalAmount_clearsOverrides() {
        let viewModel = makeViewModel()
        let overriddenKey = 2099 * 12 + 2
        viewModel.setGlobalAmount(250)
        viewModel.setMonth(key: overriddenKey, amount: 400)

        viewModel.setGlobalAmount(300)

        #expect(viewModel.overrides.isEmpty)
        #expect(viewModel.globalAmount == 300)
        #expect(viewModel.draft.months.allSatisfy { $0.simulatedAmount == 300 })
    }

    @Test("apply sends provisionable gaps by period and materialized months by line")
    func apply_splitsMissingPeriodsFromMaterializedLines() async throws {
        let service = MockSavingsGoalService()
        let progress = makeProgress(months: [
            makeMonth(month: 1, planned: 100),
            makeMonth(month: 2, planned: 200),
            makeMonth(month: 3, planned: 0, isProvisionable: true),
        ])
        let viewModel = makeViewModel(progress: progress, service: service)
        viewModel.setGlobalAmount(250)

        #expect(viewModel.planChanges.count == 3)
        #expect(viewModel.planChanges.filter { $0.month.isProvisionable }.count == 1)

        let succeeded = await viewModel.apply()
        let payload = try #require(service.lastApplyPayload)

        #expect(succeeded)
        #expect(payload.monthAdjustments.count == 2)
        #expect(payload.missingMonthAdjustments.count == 1)
        #expect(payload.missingMonthAdjustments.first?.month == 3)
        #expect(payload.missingMonthAdjustments.first?.year == 2099)
        #expect(payload.missingMonthAdjustments.first?.amount == 250)
    }

    @Test("revert clears changes and the discard-warning state")
    func revert_restoresCleanBaseline() {
        let viewModel = makeViewModel()
        viewModel.setGlobalAmount(250)

        viewModel.revert()

        #expect(viewModel.planChanges.isEmpty)
        #expect(viewModel.isDirty == false)
        #expect(viewModel.canApply == false)
    }

    @Test("an initial amount seeds the simulated cumulative, changing the verdict")
    func initialAmount_seedsSimulatedFinalAndVerdict() {
        let withoutSeed = makeViewModel()
        let withSeed = makeViewModel(progress: makeProgress(initialAmount: 400))

        #expect(withoutSeed.draft.simulatedFinal == 600)
        #expect(withoutSeed.draft.attainedPeriod == nil)

        #expect(withSeed.draft.simulatedFinal == 1_000)
        #expect(withSeed.draft.attainedPeriod == BudgetPeriod(month: 3, year: 2099))
        #expect(withSeed.verdictText != withoutSeed.verdictText)
    }

    @Test("redistribution preserves a manually adjusted month")
    func redistribute_preservesPinnedMonth() {
        let viewModel = makeViewModel()
        let pinnedKey = 2099 * 12 + 1
        viewModel.setMonth(key: pinnedKey, amount: 400)

        viewModel.redistribute()

        #expect(viewModel.simulatedAmount(forKey: pinnedKey) == 400)
        #expect(viewModel.simulatedAmount(forKey: 2099 * 12 + 2) == 300)
        #expect(viewModel.simulatedAmount(forKey: 2099 * 12 + 3) == 300)
    }

    @Test("cents-exact redistribution exposes a variable monthly state")
    func redistribute_exposesVariableState() {
        let viewModel = makeViewModel()

        viewModel.redistribute()

        #expect(viewModel.hasVariableMonthlyAmounts)
        #expect(viewModel.globalAmount == nil)
    }

    @Test("a targetless open pot remains simulatable without target verdict or redistribution")
    func targetlessGoal_simulatesWithoutTargetOperations() {
        let progress = makeProgress(targetAmount: nil, targetDate: nil)
        let viewModel = GoalPlanSimulatorViewModel(
            goal: makeGoal(targetAmount: nil, targetDate: nil),
            progress: progress,
            currency: .chf,
            payDay: 1,
            service: MockSavingsGoalService()
        )

        #expect(viewModel.draft.simulatedFinal == 600)
        #expect(viewModel.draft.gapToTarget == nil)
        #expect(viewModel.draft.isTargetMet == nil)
        #expect(viewModel.canRedistribute == false)
        #expect(viewModel.verdictText.contains("auras prévu"))

        viewModel.setGlobalAmount(250)
        #expect(viewModel.draft.simulatedFinal == 750)
        #expect(viewModel.planChanges.count == 3)
    }
}

@MainActor
struct SavingsGoalGenerationStopViewModelTests {
    @Test("loadFutureLines exposes the advisory candidates")
    func loadFutureLines_exposesCandidates() async {
        let service = MockSavingsGoalService()
        service.stubbedFutureLines = [
            SavingsGoalFutureLine(budgetLineId: "l1", amount: 200, month: 8, year: 2099),
        ]
        let viewModel = SavingsGoalDetailViewModel(goalId: "g1", service: service)

        await viewModel.loadFutureLines()

        #expect(viewModel.futureLines.count == 1)
        #expect(viewModel.futureLines.first?.budgetLineId == "l1")
    }
}
