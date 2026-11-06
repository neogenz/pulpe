import SwiftUI

/// One line of « À venir »: a run of months ahead, or a withdrawal still to come.
enum GoalUpcomingItem: Identifiable, Equatable {
    case months(GoalMonthByMonthPresentation.Segment)
    case withdrawal(GoalWithdrawals.PlannedItem)

    var id: String {
        switch self {
        case .months(let segment): "months-\(segment.id)"
        case .withdrawal(let item): item.id
        }
    }

    /// By month, a run before a withdrawal of the same month.
    private var sortKey: Int {
        switch self {
        case .months(let segment): ((segment.months.first?.year ?? 0) * 100 + (segment.months.first?.month ?? 0)) * 2
        case .withdrawal(let item): (item.year * 100 + item.month) * 2 + 1
        }
    }

    /// Months ahead and withdrawals to come in one list, by date: what goes in and what
    /// goes out read on the same line of time. The current month belongs to « Ce mois-ci »,
    /// and a withdrawal already fully made to the history.
    static func items(
        segments: [GoalMonthByMonthPresentation.Segment],
        planned: [SavingsGoalPlannedWithdrawal],
        planOnly: [SavingsGoalPlanOnlyWithdrawal]
    ) -> [GoalUpcomingItem] {
        let runs = segments
            .filter { ($0.kind == .planned || $0.kind == .empty) && $0.months.first?.state != .current }
            .map(GoalUpcomingItem.months)
        let withdrawals = GoalWithdrawals.plannedItems(
            planned: planned.filter { $0.status != .realized },
            planOnly: planOnly
        ).map(GoalUpcomingItem.withdrawal)
        return (runs + withdrawals).sorted { $0.sortKey < $1.sortKey }
    }

    static func == (lhs: GoalUpcomingItem, rhs: GoalUpcomingItem) -> Bool { lhs.id == rhs.id }
}

/// « À venir » of the goal detail.
struct GoalUpcomingSection: View {
    let items: [GoalUpcomingItem]
    let currency: SupportedCurrency
    /// The withdrawals could not load: the list may be missing some.
    let withdrawalsFailed: Bool
    let onOpenBudget: (String) -> Void
    let onRetry: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.md) {
            SectionHeader(title: AppLocale.string("À venir"))
            if !items.isEmpty {
                VStack(spacing: DesignTokens.Spacing.none) {
                    ForEach(Array(items.enumerated()), id: \.element.id) { index, item in
                        if index > 0 { Divider().overlay(Color.outlineVariant) }
                        row(item)
                    }
                }
                .padding(.horizontal, DesignTokens.Spacing.lg)
                .pulpeSurfaceCard()
            }
            if withdrawalsFailed {
                GoalInfoCard(
                    icon: "arrow.clockwise",
                    title: AppLocale.string("Retraits indisponibles"),
                    message: AppLocale.string("Impossible de charger les retraits pour le moment.")
                ) {
                    Button("Réessayer", action: onRetry)
                        .secondaryButtonStyle()
                }
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("savingsGoalUpcomingSection")
    }

    @ViewBuilder
    private func row(_ item: GoalUpcomingItem) -> some View {
        switch item {
        case .months(let segment):
            PulpeListRow(title: segment.title, subtitle: segment.subtitle, showsChevron: false) {
                if let amount = segment.amount {
                    Text(amount.asAmount(for: currency))
                        .monospacedDigit()
                        .sensitiveAmount()
                } else {
                    GoalFactChip(label: AppLocale.string("Rien de prévu"))
                }
            }
            // One VoiceOver stop per run: its months, what they hold, and the amount.
            .accessibilityElement(children: .combine)
            .accessibilityIdentifier(segment.months.first.map {
                "savingsGoalPlanMonthRow-\($0.year)-\($0.month)"
            } ?? "savingsGoalPlanMonthRow")
        case .withdrawal(let withdrawal):
            GoalPlannedWithdrawalRow(item: withdrawal, currency: currency, onOpenBudget: onOpenBudget)
        }
    }
}
