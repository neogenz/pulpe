import Foundation
@testable import Pulpe
import Testing

/// The V2 goal hero card is one conditional line after another. Asserting the branch,
/// resolved against the same catalog lookup, keeps these tests about which line shows.
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
        isOverdue: Bool = false,
        suggestCompletion: Bool? = false,
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
            isOverdue: isOverdue,
            pace: 300,
            confirmedPace: 300,
            required: required,
            projected: projected,
            paceStatus: paceStatus,
            suggestCompletion: suggestCompletion,
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

    @Test func ordinaryActiveGoalShowsTilesAndSentence() {
        let hero = GoalHeroPresentation(progress: makeProgress(), status: .active, currency: currency)
        #expect(hero.tiles.map(\.identifier) == ["savingsGoalPaceTile", "savingsGoalDateTile"])
        #expect(hero.sentence?.contains("320.00") == true)
        #expect(hero.caption == AppLocale.string("sur \(Decimal(3_000).asAmount(for: currency))"))
        #expect(hero.dateLine?.identifier == "savingsGoalDeadlineRange")
    }

    @Test func barSaysWhatIsLeftThenWhatIsMissingOnceLate() {
        let ordinary = GoalHeroPresentation(progress: makeProgress(), status: .active, currency: currency)
        #expect(ordinary.bar?.trailing == AppLocale.string("il reste \(Decimal(900).asAmount(for: currency))"))

        let late = GoalHeroPresentation(progress: makeProgress(isOverdue: true), status: .active, currency: currency)
        #expect(late.bar?.trailing == AppLocale.string("il manque \(Decimal(900).asAmount(for: currency))"))
        #expect(late.tiles.isEmpty)
        #expect(late.sentence == nil)
    }

    @Test func reachedGoalSaysCibleAtteinte() {
        let hero = GoalHeroPresentation(
            progress: makeProgress(confirmed: 3_000, achievementPercent: 100, suggestCompletion: true),
            status: .active,
            currency: currency
        )
        #expect(hero.bar?.trailing == AppLocale.string("cible atteinte"))
        #expect(hero.tiles.isEmpty)
    }

    @Test func pausedGoalMutesTheBarAndDropsTiles() {
        let hero = GoalHeroPresentation(progress: makeProgress(), status: .paused, currency: currency)
        #expect(hero.bar?.isMuted == true)
        #expect(hero.tiles.isEmpty)
        #expect(hero.sentence == nil)
    }

    @Test func initialAmountJoinsTheCaption() {
        let hero = GoalHeroPresentation(progress: makeProgress(initialAmount: 400), status: .active, currency: currency)
        let target = Decimal(3_000).asAmount(for: currency)
        let initial = Decimal(400).asAmount(for: currency)
        #expect(hero.caption == AppLocale.string("sur \(target) · dont \(initial) de départ"))
    }

    @Test func noTargetMeansNoBar() {
        let hero = GoalHeroPresentation(progress: makeProgress(targetAmount: nil), status: .active, currency: currency)
        #expect(hero.bar == nil)
    }
}
