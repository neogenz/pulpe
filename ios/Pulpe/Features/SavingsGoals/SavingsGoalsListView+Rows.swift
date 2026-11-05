import SwiftUI

extension SavingsGoalStatus {
    /// En cours, then En pause, then Atteints.
    static let listOrder: [SavingsGoalStatus] = [.active, .paused, .completed]

    var sectionTitle: String {
        switch self {
        case .active: AppLocale.string("En cours")
        case .paused: AppLocale.string("En pause")
        case .completed: AppLocale.string("Atteints")
        }
    }
}

/// One fact under a goal row's bar: a grey chip with its context, or a plain line.
struct SavingsGoalRowFact: Equatable {
    let chip: String?
    let text: String?

    init(goal: SavingsGoal, progress: SavingsGoalProgress?) {
        let deadline = goal.targetDateValue.map {
            Calendar.current.dateComponents([.month, .year], from: $0)
        }
        if goal.status == .paused {
            (chip, text) = (AppLocale.string("En pause"), nil)
        } else if goal.status == .completed {
            (chip, text) = (AppLocale.string("Atteint"), nil)
        } else if progress?.suggestCompletion == true {
            (chip, text) = (AppLocale.string("Cible atteinte"), AppLocale.string("à confirmer"))
        } else if progress?.isOverdue == true {
            let month = deadline.map { Formatters.monthNameInText(for: $0.month ?? 1) }
            (chip, text) = (AppLocale.string("Échéance passée"), month)
        } else {
            let date = deadline.map {
                GoalHeroPresentation.monthYear(month: $0.month ?? 1, year: $0.year ?? 0, capitalized: true)
            }
            let open = progress?.months.count { $0.state != .past && $0.lines.isEmpty } ?? 0
            let toPlan = open > 0 ? AppLocale.string("\(open) mois à planifier") : nil
            chip = nil
            text = [date, toPlan].compactMap(\.self).joined(separator: " · ").nilIfEmpty
        }
    }
}

private extension String {
    var nilIfEmpty: String? { isEmpty ? nil : self }
}

/// V2 goal row: name and saved amount, the bar, then one fact and « sur <cible> ».
/// No category icon (Fondations 07).
struct SavingsGoalRow: View {
    let goal: SavingsGoal
    let progress: SavingsGoalProgress?
    let currency: SupportedCurrency
    /// Beside the projection the row only picks the goal: no chevron promising a push.
    var isBesideDetail = false

    var body: some View {
        let fact = SavingsGoalRowFact(goal: goal, progress: progress)
        HStack(spacing: DesignTokens.Spacing.md) {
            VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
                HStack(alignment: .firstTextBaseline) {
                    Text(goal.name)
                        .font(PulpeTypography.rowTitle)
                        .foregroundStyle(Color.textPrimary)
                    Spacer(minLength: DesignTokens.Spacing.sm)
                    if let progress {
                        Text(progress.confirmed.asAmount(for: currency))
                            .font(PulpeTypography.rowAmount)
                            .foregroundStyle(Color.textPrimary)
                            .lineLimit(1)
                            .layoutPriority(1)
                            .sensitiveAmount()
                    }
                }
                if let fraction = progress?.confirmedFraction {
                    GoalProgressTrack(fraction: fraction, isMuted: goal.status == .paused)
                        .frame(height: DesignTokens.ProgressBar.height)
                }
                HStack(spacing: DesignTokens.Spacing.sm) {
                    if let chip = fact.chip { GoalFactChip(label: chip) }
                    if let text = fact.text {
                        Text(text).lineLimit(1)
                    }
                    Spacer(minLength: DesignTokens.Spacing.sm)
                    if let target = goal.targetAmount {
                        Text("sur \(target.asAmount(for: currency))")
                            .lineLimit(1)
                            .sensitiveAmount()
                    }
                }
                .font(PulpeTypography.captionRegular)
                .foregroundStyle(Color.textSecondary)
            }
            .monospacedDigit()
            if !isBesideDetail {
                RowChevron()
            }
        }
        .padding(.vertical, DesignTokens.Spacing.md)
        .frame(maxWidth: .infinity, minHeight: DesignTokens.ListRow.minHeight, alignment: .leading)
        .contentShape(Rectangle())
    }
}

/// « Mis de côté pour tes objectifs »: the confirmed total, then what was pointed this
/// month toward a goal.
struct SavingsGoalsTotalCard: View {
    let goals: [SavingsGoal]
    let progressById: [String: SavingsGoalProgress]
    let currentMonthLines: [BudgetLine]
    let currentMonth: Int?
    let currency: SupportedCurrency

    var body: some View {
        let total = progressById.values.reduce(Decimal.zero) { $0 + $1.confirmed }
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.xs) {
            Text("Mis de côté pour tes objectifs")
                .font(PulpeTypography.labelMedium.weight(.semibold))
                .foregroundStyle(Color.textSecondary)
            (Text(verbatim: total.asAmount(for: currency))
                .font(PulpeTypography.heroAmount)
                .tracking(DesignTokens.Tracking.hero)
                + Text(verbatim: " \(currency.symbol)")
                .font(PulpeTypography.heroCurrencySuffix)
                .foregroundStyle(Color.textTertiary))
                .foregroundStyle(Color.textPrimary)
                .monospacedDigit()
                .minimumScaleFactor(DesignTokens.TextScale.floor)
                .lineLimit(1)
            Text(summary)
                .font(PulpeTypography.labelMedium)
                .foregroundStyle(Color.textSecondary)
                .monospacedDigit()
                .fixedSize(horizontal: false, vertical: true)
        }
        .sensitiveAmount()
        .padding(DesignTokens.Spacing.xl)
        .frame(maxWidth: .infinity, alignment: .leading)
        .pulpeSurfaceCard()
        .accessibilityElement(children: .combine)
        .accessibilityIdentifier("savingsGoalsTotalCard")
    }

    /// « Sur 4 objectifs. En novembre, tu as pointé 500.00 pour Voyage au Japon. »
    private var summary: String {
        let count = AppLocale.string("Sur \(goals.count) objectifs.")
        let pointed = currentMonthLines.filter { $0.savingsGoalId != nil && $0.checkedAt != nil }
        guard let currentMonth, !pointed.isEmpty else { return count }
        let amount = pointed.reduce(Decimal.zero) { $0 + $1.amount }.asAmount(for: currency)
        let month = Formatters.monthNameInText(for: currentMonth)
        let goalIds = Set(pointed.compactMap(\.savingsGoalId))
        let target = goalIds.count == 1
            ? goals.first { $0.id == goalIds.first }?.name ?? ""
            : AppLocale.string("\(goalIds.count) objectifs")
        return count + " " + AppLocale.string("En \(month), tu as pointé \(amount) pour \(target).")
    }
}
