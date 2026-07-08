import SwiftUI

/// « Ton plan, mois par mois » (PUL-12+, pilier B) — the read-mode timeline section
/// on the goal detail. Windowed by default (last locked month for context + the
/// upcoming open months) with a « Voir tout le plan » toggle; a full 24–96 row list
/// would burn the 30 s attention budget (`docs/SAVINGS_PLAN.md` §2 pilier B).
///
/// The section header carries the « Ajuster mon plan » CTA (pilier C entry), shown
/// only when the goal is actionable (`canAdjust`).
struct GoalPlanTimelineSection: View {
    let months: [SavingsGoalPlanMonth]
    let currency: SupportedCurrency
    let canAdjust: Bool
    let onAdjust: () -> Void

    @State private var isExpanded = false

    /// Upcoming open months shown before the "Voir tout" fold, past the current one.
    private let openMonthsWindow = 3

    private var currentIndex: Int {
        months.firstIndex { $0.state == .current } ?? 0
    }

    private var windowedMonths: [SavingsGoalPlanMonth] {
        guard !isExpanded else { return months }
        guard !months.isEmpty else { return [] }

        let lastLockedIndex = months.lastIndex { $0.isLocked }
        let start = min(lastLockedIndex ?? currentIndex, currentIndex)
        let end = min(months.count - 1, currentIndex + openMonthsWindow)
        guard start <= end else { return Array(months[currentIndex...currentIndex]) }
        return Array(months[start...end])
    }

    private var gapCount: Int {
        months.filter { $0.state == .gap }.count
    }

    private var hiddenCount: Int {
        months.count - windowedMonths.count
    }

    var body: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.md) {
            Text("Ton plan, mois par mois")
                .font(PulpeTypography.headline)
                .foregroundStyle(Color.textPrimary)

            if canAdjust {
                Button(action: onAdjust) {
                    PulpeChip(icon: "slider.horizontal.3", label: "Ajuster mon plan", style: .outlined)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Ajuster mon plan")
            }

            timelineCard

            if !isExpanded, hiddenCount > 0 {
                Button {
                    withAnimation(DesignTokens.Animation.gentleSpring) { isExpanded = true }
                } label: {
                    Text("Voir tout le plan (\(months.count) mois)")
                }
                .textLinkButtonStyle()
            }

            if gapCount > 0 {
                Text("\(gapCount) mois sans budget — ils s'ajouteront quand tu créeras ces budgets.")
                    .font(PulpeTypography.listRowSubtitle)
                    .foregroundStyle(Color.textTertiary)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
    }

    private var timelineCard: some View {
        VStack(spacing: 0) {
            ForEach(Array(windowedMonths.enumerated()), id: \.element.id) { index, month in
                if index > 0 {
                    Divider().foregroundStyle(Color.textTertiary.opacity(DesignTokens.Opacity.secondary))
                }
                GoalPlanMonthRow(
                    month: month,
                    amount: month.plannedAmount,
                    cumulative: month.plannedCumulative,
                    currency: currency
                )
            }
        }
        .padding(DesignTokens.Spacing.lg)
        .pulpeCard()
    }
}
