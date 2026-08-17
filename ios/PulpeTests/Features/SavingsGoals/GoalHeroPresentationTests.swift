import Foundation
@testable import Pulpe
import Testing

/// The hero is one conditional line after another. Asserting the *branch* — the
/// resolved copy compared against the same catalog lookup — keeps these tests
/// about which sentence shows, never about how a language spells it.
@MainActor
struct GoalHeroPresentationTests {
    private let currency = SupportedCurrency.chf

    private func makeMonth(
        month: Int,
        state: SavingsPlanMonthState,
        isLocked: Bool,
        planned: Decimal = 300,
        projectedCumulative: Decimal? = nil
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
            projectedCumulative: projectedCumulative,
            lines: []
        )
    }

    private func makeProgress(
        targetAmount: Decimal? = 3_000,
        targetDate: String? = "2099-12-14",
        startDate: String? = "2099-01-05",
        plannedProjection: Decimal = 3_600,
        projected: Decimal? = 3_600,
        confirmed: Decimal = 2_100,
        initialAmount: Decimal = 0,
        achievementPercent: Int? = 70,
        required: Decimal? = 320,
        paceStatus: SavingsGoalPaceStatus? = .onTrack,
        linkedLineCount: Int = 1,
        months: [SavingsGoalPlanMonth]? = nil
    ) -> SavingsGoalProgress {
        SavingsGoalProgress(
            goalId: "g1",
            status: .active,
            startDate: startDate,
            targetAmount: targetAmount,
            targetDate: targetDate,
            plannedCumulative: 2_400,
            plannedProjection: plannedProjection,
            confirmed: confirmed,
            initialAmount: initialAmount,
            achievementPercent: achievementPercent,
            monthsElapsed: 6,
            monthsRemaining: 6,
            isOverdue: false,
            pace: 300,
            confirmedPace: 300,
            required: required,
            projected: projected,
            paceStatus: paceStatus,
            suggestCompletion: false,
            linkedLineCount: linkedLineCount,
            originalTargetAmount: nil,
            originalCurrency: nil,
            targetCurrency: nil,
            exchangeRate: nil,
            months: months ?? [
                makeMonth(month: 5, state: .past, isLocked: true),
                makeMonth(month: 6, state: .current, isLocked: false),
            ]
        )
    }

    private func makePresentation(
        _ progress: SavingsGoalProgress,
        status: SavingsGoalStatus = .active
    ) -> GoalHeroPresentation {
        GoalHeroPresentation(progress: progress, status: status, currency: currency)
    }

    // MARK: - Verdict vs day-1 beat

    @Test("a closed plan month turns the pace status into the cible verdict")
    func verdict_readsAgainstTheTarget() {
        let presentation = makePresentation(makeProgress())

        #expect(presentation.verdict == AppLocale.string("Au niveau de la cible"))
        #expect(presentation.dayOneBeat == nil)
    }

    @Test("before the first month closes, the day-1 beat replaces the verdict")
    func dayOneBeat_standsInForTheVerdict() {
        let progress = makeProgress(months: [
            makeMonth(month: 6, state: .current, isLocked: false, planned: 300.01),
        ])

        let presentation = makePresentation(progress)

        #expect(presentation.verdict == nil)
        #expect(presentation.dayOneBeat?.contains(Decimal(string: "300.01")!.asAdaptiveCurrency(currency)) == true)
    }

    @Test("no pace status at all leaves both the verdict and the beat empty")
    func noPaceStatus_leavesBothEmpty() {
        let progress = makeProgress(paceStatus: nil, months: [makeMonth(month: 6, state: .current, isLocked: false)])

        let presentation = makePresentation(progress)

        #expect(presentation.verdict == nil)
        #expect(presentation.dayOneBeat == nil)
    }

    // MARK: - Projection and required pace

    @Test("the projection quotes the displayed figure and names the échéance")
    func projection_quotesTheDisplayedProjection() {
        let presentation = makePresentation(makeProgress(projected: 3_600.01))

        #expect(presentation.projection == AppLocale.string(
            "Ton plan te mène à \(Decimal(string: "3600.01")!.asAdaptiveCurrency(currency)) à l'échéance."
        ))
    }

    /// Sans cible ni échéance le serveur ne calcule plus `projected`, et le repli
    /// historique `plannedProjection` somme les contributions sans jamais
    /// retrancher un retrait : la phrase annonçait 3 600 quand la courbe finissait
    /// à 2 900. Le dernier `projectedCumulative` ferme la même courbe que le chart.
    @Test("a targetless plan quotes the balance the curve reaches, not the gross plan")
    func projection_quotesTheNetBalanceWhenTheServerHasNoProjection() {
        let presentation = makePresentation(makeProgress(
            targetAmount: nil,
            targetDate: nil,
            projected: nil,
            months: [
                makeMonth(month: 5, state: .past, isLocked: true, projectedCumulative: 3_200),
                makeMonth(month: 6, state: .current, isLocked: false, projectedCumulative: 2_900),
            ]
        ))

        #expect(presentation.projection == AppLocale.string(
            "Ton plan te mène à \(Decimal(2_900).asCompactCurrency(currency)) au total."
        ))
    }

    @Test("without a plan there is no plan to project")
    func projection_hiddenWithoutLinkedLines() {
        let presentation = makePresentation(makeProgress(linkedLineCount: 0))

        #expect(presentation.projection == nil)
    }

    @Test("a plan that reaches the target says nothing about a required pace")
    func requiredPace_hiddenWhenThePlanSuffices() {
        let presentation = makePresentation(makeProgress())

        #expect(presentation.requiredPace == nil, "3 600 ≥ 3 000: repeating the plan under another name")
    }

    @Test("a plan short of the target advises the pace that closes the gap")
    func requiredPace_shownWhenThePlanFallsShort() {
        let presentation = makePresentation(makeProgress(
            plannedProjection: 2_400,
            projected: 2_400,
            required: 320.01
        ))

        #expect(
            presentation.requiredPace?.contains(
                Decimal(string: "320.01")!.asAdaptiveCurrency(currency)
            ) == true
        )
    }

    // MARK: - Bar, chip, meta

    @Test("the bar layers confirmed over the displayed projection and shares one percent")
    func bar_layersConfirmedOverProjection() throws {
        let bar = try #require(makePresentation(makeProgress()).bar)

        #expect(bar.confirmed == 0.7)
        #expect(bar.projected == 1, "3 600 against a 3 000 target clamps to a full bar")
        #expect(bar.percent == Decimal(70).asPercentage())
    }

    @Test("no target, no bar to draw")
    func bar_absentWithoutATarget() {
        let presentation = makePresentation(makeProgress(targetAmount: nil, achievementPercent: nil))

        #expect(presentation.bar == nil)
    }

    @Test("the status chip only shows once the status carries information")
    func statusChip_hiddenOnAnActiveGoal() {
        let progress = makeProgress()

        #expect(makePresentation(progress, status: .active).showsStatusChip == false)
        #expect(makePresentation(progress, status: .paused).showsStatusChip == true)
        #expect(makePresentation(progress, status: .completed).showsStatusChip == true)
    }

    @Test("the date fragment keeps the identifier of the variant it renders")
    func dateLine_keepsItsIdentifier() {
        let range = makePresentation(makeProgress()).dateLine
        let deadlineOnly = makePresentation(makeProgress(startDate: nil)).dateLine
        let none = makePresentation(makeProgress(targetDate: nil, startDate: nil)).dateLine

        #expect(range?.identifier == "savingsGoalDeadlineRange")
        #expect(deadlineOnly?.identifier == "savingsGoalDeadlineDate")
        #expect(none == nil)
    }

    @Test("the starting stock only earns a line when there is one")
    func initialAmountLine_onlyWhenThereIsAStock() {
        #expect(makePresentation(makeProgress()).initialAmountLine == nil)
        #expect(makePresentation(makeProgress(initialAmount: 500)).initialAmountLine?.isEmpty == false)
    }
}
