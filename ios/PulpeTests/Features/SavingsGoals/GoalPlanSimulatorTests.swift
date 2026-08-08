import Foundation
@testable import Pulpe
import Testing

/// Regression coverage for the zero-valued gap creation (see
/// `frontend/.../goal-plan-simulator-store.spec.ts` for the web mirror of
/// these three scenarios). The wire schema requires a positive amount on
/// `missingMonthAdjustments`, so a redistribution that lands a gap month on
/// exactly 0 must never leak into `apply()`'s payload.
@MainActor
struct GoalPlanSimulatorTests {
    private static let lineId = "line-current"

    private static func recapSource() throws -> String {
        var url = URL(fileURLWithPath: #filePath)
        url = url.deletingLastPathComponent() // SavingsGoals/
        url = url.deletingLastPathComponent() // Features/
        url = url.deletingLastPathComponent() // PulpeTests/
        url = url.deletingLastPathComponent() // ios/
        return try String(
            contentsOf: url.appendingPathComponent(
                "Pulpe/Features/SavingsGoals/Simulator/GoalPlanApplyRecapSheet.swift"
            ),
            encoding: .utf8
        )
    }

    private func makeGoal() -> SavingsGoal {
        SavingsGoal(
            id: "g1",
            userId: "user-1",
            name: "Maison",
            targetAmount: 500,
            targetDate: "2026-12-31",
            status: .active,
            createdAt: Date(timeIntervalSince1970: 0),
            updatedAt: Date(timeIntervalSince1970: 0)
        )
    }

    private func openMonth(amount: Decimal) -> SavingsGoalPlanMonth {
        SavingsGoalPlanMonth(
            month: 6,
            year: 2026,
            state: .current,
            isLocked: false,
            plannedAmount: amount,
            confirmedAmount: 0,
            plannedCumulative: amount,
            confirmedCumulative: 0,
            lines: [
                SavingsGoalPlanLine(
                    budgetLineId: Self.lineId,
                    amount: amount,
                    checkedAt: nil,
                    isManuallyAdjusted: false
                ),
            ]
        )
    }

    private func gapMonth(hasBudget: Bool = true) -> SavingsGoalPlanMonth {
        SavingsGoalPlanMonth(
            month: 7,
            year: 2026,
            state: .gap,
            isLocked: false,
            hasBudget: hasBudget,
            isProvisionable: true,
            plannedAmount: 0,
            confirmedAmount: 0,
            plannedCumulative: 0,
            confirmedCumulative: 0,
            lines: []
        )
    }

    private func makeProgress(
        targetAmount: Decimal,
        initialAmount: Decimal,
        months: [SavingsGoalPlanMonth]
    ) -> SavingsGoalProgress {
        SavingsGoalProgress(
            goalId: "g1",
            status: .active,
            targetAmount: targetAmount,
            targetDate: "2026-12-31",
            plannedCumulative: 0,
            confirmed: 0,
            initialAmount: initialAmount,
            achievementPercent: 0,
            monthsElapsed: 0,
            monthsRemaining: 6,
            isOverdue: false,
            pace: 0,
            confirmedPace: 0,
            required: nil,
            projected: nil,
            paceStatus: nil,
            suggestCompletion: nil,
            linkedLineCount: 1,
            originalTargetAmount: nil,
            originalCurrency: nil,
            targetCurrency: nil,
            exchangeRate: nil,
            months: months
        )
    }

    @Test("linked-income recap explains automatic pointing after realization")
    func recap_explainsAutomaticPointing() throws {
        let source = try Self.recapSource()

        #expect(source.contains(
            "Réalise-la dans le budget : le Réel créé sera automatiquement pointé."
        ))
    }

    @Test("omits a zero-valued gap creation while keeping a zero-valued existing-line adjustment")
    func apply_omitsZeroGapCreation_keepsZeroLineAdjustment() async throws {
        let service = MockSavingsGoalService()
        let progress = makeProgress(
            targetAmount: 200,
            initialAmount: 200,
            months: [openMonth(amount: 200), gapMonth()]
        )
        let viewModel = GoalPlanSimulatorViewModel(
            goal: makeGoal(),
            progress: progress,
            currency: .chf,
            payDay: nil,
            service: service
        )

        viewModel.redistribute()
        let succeeded = await viewModel.apply()
        let payload = try #require(service.lastApplyPayload)

        #expect(succeeded)
        #expect(service.applyPlanCallCount == 1)
        #expect(payload.monthAdjustments.count == 1)
        #expect(payload.monthAdjustments.first?.budgetLineId == Self.lineId)
        #expect(payload.monthAdjustments.first?.amount == 0)
        #expect(payload.missingMonthAdjustments.isEmpty)
    }

    @Test("keeps a valid adjustment when a zero-valued gap creation is dropped from the same submission")
    func apply_keepsValidAdjustment_besideDroppedZeroGap() async throws {
        let service = MockSavingsGoalService()
        let progress = makeProgress(
            targetAmount: 500,
            initialAmount: 0,
            months: [openMonth(amount: 200), gapMonth()]
        )
        let viewModel = GoalPlanSimulatorViewModel(
            goal: makeGoal(),
            progress: progress,
            currency: .chf,
            payDay: nil,
            service: service
        )

        viewModel.setMonth(key: 2026 * 12 + 6, amount: 500)
        viewModel.redistribute()
        let succeeded = await viewModel.apply()
        let payload = try #require(service.lastApplyPayload)

        #expect(succeeded)
        #expect(payload.monthAdjustments.count == 1)
        #expect(payload.monthAdjustments.first?.budgetLineId == Self.lineId)
        #expect(payload.monthAdjustments.first?.amount == 500)
        #expect(payload.missingMonthAdjustments.isEmpty)
    }

    @Test("routes a negative month to the chosen linked-income destination without a saving line")
    func apply_routesSignedWithdrawalDestination() async throws {
        let service = MockSavingsGoalService()
        let viewModel = GoalPlanSimulatorViewModel(
            goal: makeGoal(),
            progress: makeProgress(
                targetAmount: 10_000,
                initialAmount: 10_000,
                months: [openMonth(amount: 1_260)]
            ),
            currency: .chf,
            payDay: nil,
            service: service
        )

        viewModel.setMonth(key: 2026 * 12 + 6, amount: -4_500)
        let succeeded = await viewModel.apply(withdrawalDestination: .linkedIncome)
        let payload = try #require(service.lastApplyPayload)

        #expect(succeeded)
        #expect(payload.monthAdjustments.isEmpty)
        #expect(payload.planWithdrawalAdjustments.first?.amount == -4_500)
        #expect(payload.planWithdrawalAdjustments.first?.destination == .linkedIncome)
    }

    @Test("keeps a goal-only negative movement when the month has no budget")
    func apply_routesPlanOnlyWithdrawalWithoutBudget() async throws {
        let service = MockSavingsGoalService()
        let viewModel = GoalPlanSimulatorViewModel(
            goal: makeGoal(),
            progress: makeProgress(
                targetAmount: 10_000,
                initialAmount: 10_000,
                months: [gapMonth(hasBudget: false)]
            ),
            currency: .chf,
            payDay: nil,
            service: service
        )

        viewModel.setMonth(key: 2026 * 12 + 7, amount: -450)
        let succeeded = await viewModel.apply()
        let payload = try #require(service.lastApplyPayload)

        #expect(succeeded)
        #expect(payload.monthAdjustments.isEmpty)
        #expect(payload.missingMonthAdjustments.isEmpty)
        #expect(payload.planWithdrawalAdjustments.first?.amount == -450)
        #expect(payload.planWithdrawalAdjustments.first?.destination == .goalOnly)
    }

    @Test("keeps the global savings control non-negative without clamping")
    func globalAmount_rejectsNegativeValue() {
        let viewModel = GoalPlanSimulatorViewModel(
            goal: makeGoal(),
            progress: makeProgress(
                targetAmount: 10_000,
                initialAmount: 0,
                months: [openMonth(amount: 1_260)]
            ),
            currency: .chf,
            payDay: nil,
            service: MockSavingsGoalService()
        )

        viewModel.setGlobalAmount(300)
        viewModel.setGlobalAmount(-450)

        #expect(viewModel.globalAmount == 300)
        #expect(viewModel.draft.months.allSatisfy { $0.simulatedAmount == 300 })
    }

    @Test("skips the apply call when the only change is a zero-valued gap creation")
    func apply_skipsCall_whenOnlyChangeIsZeroGapCreation() async {
        let service = MockSavingsGoalService()
        let progress = makeProgress(
            targetAmount: 500,
            initialAmount: 500,
            months: [gapMonth()]
        )
        let viewModel = GoalPlanSimulatorViewModel(
            goal: makeGoal(),
            progress: progress,
            currency: .chf,
            payDay: nil,
            service: service
        )

        viewModel.redistribute()
        let succeeded = await viewModel.apply()

        #expect(!succeeded)
        #expect(service.applyPlanCallCount == 0)
    }

    @Test("excludes a zero-valued gap creation from the recap preview, disabling apply")
    func planChanges_excludesZeroGapCreation_disablesApply() {
        let service = MockSavingsGoalService()
        let progress = makeProgress(
            targetAmount: 500,
            initialAmount: 500,
            months: [gapMonth()]
        )
        let viewModel = GoalPlanSimulatorViewModel(
            goal: makeGoal(),
            progress: progress,
            currency: .chf,
            payDay: nil,
            service: service
        )

        viewModel.redistribute()

        #expect(viewModel.planChanges.isEmpty)
        #expect(!viewModel.canApply)
    }

    @Test("keeps only the valid adjustment in the recap preview, matching the payload")
    func planChanges_mixedZeroGapAndValidAdjustment_matchesPayload() async throws {
        let service = MockSavingsGoalService()
        let progress = makeProgress(
            targetAmount: 500,
            initialAmount: 0,
            months: [openMonth(amount: 200), gapMonth()]
        )
        let viewModel = GoalPlanSimulatorViewModel(
            goal: makeGoal(),
            progress: progress,
            currency: .chf,
            payDay: nil,
            service: service
        )

        viewModel.setMonth(key: 2026 * 12 + 6, amount: 500)
        viewModel.redistribute()

        #expect(viewModel.planChanges.count == 1)
        #expect(viewModel.planChanges.first?.month.month == 6)
        #expect(viewModel.planChanges.first?.simulatedAmount == 500)

        let succeeded = await viewModel.apply()
        let payload = try #require(service.lastApplyPayload)

        #expect(succeeded)
        #expect(payload.monthAdjustments.count == 1)
        #expect(payload.monthAdjustments.first?.amount == 500)
        #expect(payload.missingMonthAdjustments.isEmpty)
    }
}
