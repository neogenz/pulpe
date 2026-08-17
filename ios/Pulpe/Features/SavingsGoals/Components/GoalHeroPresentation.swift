import Foundation

/// Everything the goal hero shows, resolved once from the server-computed
/// progression. A pure value on purpose: every line of the hero is conditional,
/// and conditions buried in a `body` can only be checked by launching the app.
///
/// The hero answers one question — « où j'en suis » — so it quotes a single
/// projection (`displayedProjection`) and speaks of the **cible**. The
/// trajectory section below it owns the second lens and speaks of the **plan**.
struct GoalHeroPresentation: Equatable {
    /// Two layers and their shared percent: confirmed ink over the displayed
    /// projection, both already clamped to 0…1 by the model.
    struct Bar: Equatable {
        let confirmed: Double
        let projected: Double
        let percent: String
        let accessibilityLabel: String
    }

    /// The deadline fragment keeps the identifier the detail UI tests read to
    /// tell which date variant a goal renders.
    struct DateLine: Equatable {
        let text: String
        let identifier: String?
    }

    /// « Actif » is the state of every goal at creation — a chip that is always
    /// there says nothing. It comes back the moment it carries information.
    let showsStatusChip: Bool
    let amount: String
    let targetLine: String?
    let dateLine: DateLine?
    let initialAmountLine: String?
    let bar: Bar?
    let verdict: String?
    let dayOneBeat: String?
    let projection: String?
    let requiredPace: String?

    init(progress: SavingsGoalProgress, status: SavingsGoalStatus, currency: SupportedCurrency) {
        let hasClosedPlanMonth = progress.hasClosedPlanMonth

        showsStatusChip = status != .active
        amount = progress.confirmed.asCompactCurrency(currency)
        // Compact like the hero above it: two decimals on the target beside a
        // rounded balance reads as two different figures of the same money.
        targetLine = progress.targetAmount.map { AppLocale.string("sur \($0.asCompactCurrency(currency))") }
        dateLine = Self.makeDateLine(progress)
        initialAmountLine = progress.initialAmount > 0
            ? AppLocale.string("Dont \(progress.initialAmount.asCompactCurrency(currency)) de départ")
            : nil
        bar = Self.makeBar(progress)

        // Same day-1 gate as before: no verdict until a plan month has closed,
        // and the « plan prêt » beat takes its place while none has.
        verdict = progress.paceStatus.flatMap { hasClosedPlanMonth ? Self.makeVerdict($0) : nil }
        dayOneBeat = progress.paceStatus == nil || hasClosedPlanMonth
            ? nil
            : progress.currentMonthPlannedAmount.map {
                AppLocale.string("Ton plan est prêt : \($0.asCurrency(currency)) à mettre de côté ce mois.")
            }

        projection = progress.linkedLineCount > 0
            ? Self.makeProjection(progress, currency: currency)
            : nil
        requiredPace = Self.makeRequiredPace(progress, currency: currency, hasClosedPlanMonth: hasClosedPlanMonth)
    }

    private static func makeDateLine(_ progress: SavingsGoalProgress) -> DateLine? {
        if let start = progress.startDateValue, let end = progress.targetDateValue {
            // Two dates and an arrow: nothing to translate, so no catalog key.
            return DateLine(
                text: "\(start.abbreviatedDateFormatted) → \(end.abbreviatedDateFormatted)",
                identifier: "savingsGoalDeadlineRange"
            )
        }
        if let end = progress.targetDateValue {
            return DateLine(
                text: AppLocale.string("Échéance \(end.abbreviatedDateFormatted)"),
                identifier: "savingsGoalDeadlineDate"
            )
        }
        if let start = progress.startDateValue {
            return DateLine(text: AppLocale.string("Depuis \(start.abbreviatedDateFormatted)"), identifier: nil)
        }
        return nil
    }

    private static func makeBar(_ progress: SavingsGoalProgress) -> Bar? {
        guard let projectedFraction = progress.displayedProjectionFraction else { return nil }
        let percent = Decimal(progress.achievementPercent ?? 0)
        return Bar(
            confirmed: progress.confirmedFraction ?? 0,
            projected: projectedFraction,
            percent: percent.asPercentage(),
            accessibilityLabel: AppLocale.string("\(percent.asPercentage()) de la cible épargné")
        )
    }

    private static func makeVerdict(_ pace: SavingsGoalPaceStatus) -> String {
        switch pace {
        case .behind: AppLocale.string("En dessous de la cible")
        case .onTrack: AppLocale.string("Au niveau de la cible")
        case .ahead: AppLocale.string("Au-dessus de la cible")
        }
    }

    private static func makeProjection(_ progress: SavingsGoalProgress, currency: SupportedCurrency) -> String {
        let amount = progress.displayedProjection.asCompactCurrency(currency)
        // One whole key per variant: « à l'échéance » is a subordinate clause,
        // untranslatable on its own and glued back into the sentence.
        return progress.targetDateValue == nil
            ? AppLocale.string("Ton plan te mène à \(amount) au total.")
            : AppLocale.string("Ton plan te mène à \(amount) à l'échéance.")
    }

    /// Only when the plan does **not** reach the target: repeating the plan's own
    /// rhythm under a second name is what made the old card read as noise.
    /// `required` implies an échéance server-side (`docs/SAVINGS.md` §11), so a
    /// missing `targetDateValue` means a malformed date — nothing to advise on.
    private static func makeRequiredPace(
        _ progress: SavingsGoalProgress,
        currency: SupportedCurrency,
        hasClosedPlanMonth: Bool
    ) -> String? {
        guard hasClosedPlanMonth,
              let required = progress.required,
              let targetAmount = progress.targetAmount,
              progress.displayedProjection < targetAmount,
              let deadline = progress.targetDateValue else { return nil }
        return AppLocale.string(
            "Vise \(required.asCompactCurrency(currency))/mois pour finir le \(deadline.abbreviatedDateFormatted)."
        )
    }
}
