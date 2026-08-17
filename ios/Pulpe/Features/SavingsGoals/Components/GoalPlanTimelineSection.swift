import SwiftUI

struct GoalPlanTimelinePresentation {
    private static let openMonthsWindow = 3

    let months: [SavingsGoalPlanMonth]
    let isExpanded: Bool

    private var currentIndex: Int {
        months.firstIndex { $0.state == .current } ?? 0
    }

    private var collapsedMonths: [SavingsGoalPlanMonth] {
        guard !months.isEmpty else { return [] }
        let end = min(months.count, currentIndex + Self.openMonthsWindow + 1)
        return Array(months[currentIndex..<end])
    }

    var visibleMonths: [SavingsGoalPlanMonth] {
        isExpanded ? months : collapsedMonths
    }

    var hiddenCount: Int {
        max(0, months.count - visibleMonths.count)
    }

    var canToggle: Bool {
        collapsedMonths.count < months.count
    }

    var remainingUnlinkedMonthCount: Int {
        months.dropFirst(currentIndex).count(where: { $0.lines.isEmpty })
    }

    var repairableMonths: [SavingsGoalPlanMonth] {
        months.filter(\.isRepairable)
    }

    var repairMessage: String {
        AppLocale.string("""
            \(repairableMonths.count) prévisions Épargne peuvent maintenant \
            être ajoutées automatiquement.
            """)
    }

    /// A realised plan withdrawal is editable from the budget line that the
    /// plan created. Period matching alone is not enough: the same month may
    /// contain another income linked to the goal, including a legacy row whose
    /// origin is absent.
    static func budgetId(
        forFrozenMonth month: SavingsGoalPlanMonth,
        plannedWithdrawals: [SavingsGoalPlannedWithdrawal]
    ) -> String? {
        guard month.planWithdrawalConsumedAmount.rounded(2) > 0 else {
            return nil
        }
        return plannedWithdrawals.first {
            $0.month == month.month
                && $0.year == month.year
                && $0.origin == .planLinked
        }?.budgetId
    }
}

/// « Ton plan, mois par mois » (PUL-12+, pilier B) — the read-mode timeline section
/// on the goal detail. Windowed by default (current month + three future months)
/// with a « Voir tout le plan » toggle; a full 24–96 row list
/// would burn the 30 s attention budget (`docs/SAVINGS.md` §10.1).
///
/// The section header carries the « Ajuster » CTA (pilier C entry), shown
/// only when the goal is actionable (`canAdjust`).
struct GoalPlanTimelineSection: View {
    let months: [SavingsGoalPlanMonth]
    let currency: SupportedCurrency
    let plannedWithdrawals: [SavingsGoalPlannedWithdrawal]
    let canAdjust: Bool
    let canRepair: Bool
    let onAdjust: () -> Void
    let onRepair: () -> Void
    let onOpenBudget: (String) -> Void

    @State private var isExpanded = false

    private var presentation: GoalPlanTimelinePresentation {
        GoalPlanTimelinePresentation(months: months, isExpanded: isExpanded)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.md) {
            HStack(spacing: DesignTokens.Spacing.md) {
                Text("Ton plan, mois par mois")
                    .font(PulpeTypography.title2)
                    .foregroundStyle(Color.textPrimary)

                Spacer(minLength: DesignTokens.Spacing.sm)

                if canAdjust {
                    Button(action: onAdjust) {
                        Label("Ajuster", systemImage: "slider.horizontal.3")
                            .font(PulpeTypography.buttonSecondary)
                    }
                    .frame(minHeight: DesignTokens.TapTarget.minimum)
                    .textLinkButtonStyle()
                    .accessibilityLabel("Ajuster le plan")
                    .accessibilityIdentifier("savingsGoalAdjustPlanButton")
                }
            }

            if canRepair {
                GoalInfoCard(
                    icon: "calendar.badge.plus",
                    title: AppLocale.string("Tes nouveaux budgets sont prêts"),
                    message: presentation.repairMessage
                ) {
                    Button("Prévisualiser", action: onRepair)
                        .secondaryButtonStyle()
                        .accessibilityLabel("Prévisualiser les épargnes à ajouter")
                }
            }

            timelineCard

            if presentation.canToggle {
                Button {
                    withAnimation(DesignTokens.Animation.gentleSpring) { isExpanded.toggle() }
                } label: {
                    HStack(spacing: DesignTokens.Spacing.sm) {
                        if isExpanded {
                            Text("Voir moins")
                        } else {
                            Text("Voir tout le plan (\(months.count) mois)")
                        }
                        Spacer()
                        Image(systemName: isExpanded ? "chevron.up" : "chevron.down")
                            .accessibilityHidden(true)
                    }
                }
                .frame(
                    maxWidth: .infinity,
                    minHeight: DesignTokens.TapTarget.minimum,
                    alignment: .leading
                )
                .contentShape(Rectangle())
                .textLinkButtonStyle()
                .accessibilityHint(
                    isExpanded
                        ? AppLocale.string("Réduit la liste des mois")
                        : AppLocale.string("Affiche tous les mois")
                )
            }

            if presentation.remainingUnlinkedMonthCount > 0 {
                Text("\(presentation.remainingUnlinkedMonthCount) mois restants sans prévision liée à cet objectif.")
                    .font(PulpeTypography.listRowSubtitle)
                    .foregroundStyle(Color.textTertiary)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
    }

    private var timelineCard: some View {
        VStack(spacing: 0) {
            ForEach(Array(presentation.visibleMonths.enumerated()), id: \.element.id) { index, month in
                if index > 0 {
                    Divider().foregroundStyle(Color.textTertiary.opacity(DesignTokens.Opacity.secondary))
                }
                GoalPlanMonthRow(
                    month: month,
                    amount: month.plannedAmount,
                    cumulative: month.plannedCumulative,
                    currency: currency,
                    canRepair: canRepair,
                    onOpenBudget: budgetAction(for: month)
                )
            }
        }
        // pulpeCard() porte déjà l'inset lg — un padding ici le doublait (32pt)
        // et désalignait cette carte de « Ton suivi » juste en dessous.
        .pulpeCard()
    }

    private func budgetAction(for month: SavingsGoalPlanMonth) -> (() -> Void)? {
        guard let budgetId = GoalPlanTimelinePresentation.budgetId(
            forFrozenMonth: month,
            plannedWithdrawals: plannedWithdrawals
        ) else { return nil }
        return { onOpenBudget(budgetId) }
    }
}
