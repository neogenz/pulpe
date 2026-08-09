import SwiftUI

/// « Retraits » (PUL-329) — the money that LEFT this goal for a budget.
///
/// Deliberately its own section, after « Ton suivi »: contributions grow the
/// stock, withdrawals shrink it, and merging them would force the reader to
/// decode a sign on every row. The amount therefore carries its minus sign but
/// keeps the ordinary text colour — a withdrawal is a decision, never an
/// anomaly (RG-002, l'épargne n'alerte jamais). The server sorts newest first;
/// realized history preserves that order, while future withdrawals share one
/// chronological list regardless of their destination.
///
/// `isRelevant` is the caller's gate: a goal nobody ever drew from says nothing
/// by staying silent, so the whole section disappears rather than announcing an
/// emptiness the user never asked about.
struct GoalWithdrawalsSection: View {
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    let withdrawals: [SavingsGoalWithdrawal]
    let planned: [SavingsGoalPlannedWithdrawal]
    let planOnly: [SavingsGoalPlanOnlyWithdrawal]
    let currency: SupportedCurrency
    let isLoading: Bool
    let error: Error?
    let onOpenBudget: (String) -> Void

    enum PlannedItem: Identifiable {
        case linked(SavingsGoalPlannedWithdrawal)
        case planOnly(SavingsGoalPlanOnlyWithdrawal)

        var id: String {
            switch self {
            case .linked(let withdrawal): "linked-\(withdrawal.id)"
            case .planOnly(let withdrawal): "plan-only-\(withdrawal.id)"
            }
        }

        var name: String {
            switch self {
            case .linked(let withdrawal): withdrawal.name
            case .planOnly(let withdrawal): withdrawal.name
            }
        }

        var month: Int {
            switch self {
            case .linked(let withdrawal): withdrawal.month
            case .planOnly(let withdrawal): withdrawal.month
            }
        }

        var year: Int {
            switch self {
            case .linked(let withdrawal): withdrawal.year
            case .planOnly(let withdrawal): withdrawal.year
            }
        }

        var plannedAmount: Decimal {
            switch self {
            case .linked(let withdrawal): withdrawal.plannedAmount
            case .planOnly(let withdrawal): withdrawal.plannedAmount
            }
        }

        var realizedAmount: Decimal {
            switch self {
            case .linked(let withdrawal): withdrawal.realizedAmount
            case .planOnly: 0
            }
        }

        var primaryAmount: Decimal {
            switch self {
            case .linked(let withdrawal):
                switch withdrawal.status {
                case .partiallyRealized: withdrawal.remainingAmount
                case .planned, .realized: withdrawal.plannedAmount
                }
            case .planOnly(let withdrawal): withdrawal.plannedAmount
            }
        }

        var primaryAmountDetail: String? {
            guard case .linked(let withdrawal) = self,
                  case .partiallyRealized = withdrawal.status else { return nil }
            return "restant"
        }

        var remainingAmount: Decimal {
            switch self {
            case .linked(let withdrawal): withdrawal.remainingAmount
            case .planOnly(let withdrawal): withdrawal.plannedAmount
            }
        }

        var budgetId: String? {
            guard case .linked(let withdrawal) = self else { return nil }
            return withdrawal.budgetId
        }

        var isPlanOnly: Bool {
            if case .planOnly = self { return true }
            return false
        }

        var statusLabel: String {
            guard case .linked(let withdrawal) = self else { return "À réaliser" }
            return switch withdrawal.status {
            case .planned: "À réaliser"
            case .partiallyRealized: "Partiellement réalisé"
            case .realized: "Réalisé"
            }
        }

        var periodLabel: String {
            let components = DateComponents(year: year, month: month, day: 1)
            return (Calendar.current.date(from: components) ?? .now)
                .formatted(.dateTime.month(.wide).year())
        }

        func contextLabel(currency: SupportedCurrency) -> String {
            "Prévu \(plannedAmount.asCurrency(currency)) · Réalisé \(realizedAmount.asCurrency(currency))"
        }

        func accessibilityLabel(currency: SupportedCurrency) -> String {
            let destination = isPlanOnly ? ", hors budget" : ""
            return "\(name), \(periodLabel), \(statusLabel)\(destination), "
                + "prévu \(plannedAmount.asCurrency(currency)), "
                + "réalisé \(realizedAmount.asCurrency(currency)), "
                + "reste \(remainingAmount.asCurrency(currency))"
        }

        var accessibilityHint: String? { budgetId == nil ? nil : "Ouvre le budget" }
    }

    nonisolated static func plannedItems(
        planned: [SavingsGoalPlannedWithdrawal],
        planOnly: [SavingsGoalPlanOnlyWithdrawal]
    ) -> [PlannedItem] {
        (planned.map(PlannedItem.linked) + planOnly.map(PlannedItem.planOnly))
            .sorted { lhs, rhs in
                if lhs.year != rhs.year { return lhs.year < rhs.year }
                if lhs.month != rhs.month { return lhs.month < rhs.month }
                return lhs.id < rhs.id
            }
    }

    static func isRelevant(
        withdrawals: [SavingsGoalWithdrawal],
        planned: [SavingsGoalPlannedWithdrawal],
        planOnly: [SavingsGoalPlanOnlyWithdrawal] = [],
        isLoading: Bool,
        error: Error?
    ) -> Bool {
        !withdrawals.isEmpty || !planned.isEmpty || !planOnly.isEmpty || isLoading || error != nil
    }

    var body: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.md) {
            Text("Retraits")
                .font(PulpeTypography.title2)
                .foregroundStyle(Color.textPrimary)

            if isLoading, withdrawals.isEmpty, planned.isEmpty, planOnly.isEmpty {
                ProgressView("Chargement des retraits…")
                    .frame(maxWidth: .infinity)
                    .padding(DesignTokens.Spacing.xl)
            } else if error != nil, withdrawals.isEmpty, planned.isEmpty, planOnly.isEmpty {
                // No retry button: the whole detail reloads on pull-to-refresh,
                // and a failed history never blocks reading the progression.
                notice("Impossible de charger les retraits pour le moment.")
            } else {
                let plannedItems = Self.plannedItems(planned: planned, planOnly: planOnly)
                if !plannedItems.isEmpty {
                    Text("Retraits planifiés")
                        .font(PulpeTypography.headline)
                        .foregroundStyle(Color.textPrimary)
                    ForEach(plannedItems) { item in
                        plannedRow(item)
                    }
                }

                if !withdrawals.isEmpty {
                    Text("Retraits réalisés")
                        .font(PulpeTypography.headline)
                        .foregroundStyle(Color.textPrimary)
                    ForEach(withdrawals) { withdrawal in
                        realizedRow(withdrawal)
                    }
                }
            }
        }
    }

    private func notice(_ message: String) -> some View {
        Text(message)
            .font(PulpeTypography.listRowSubtitle)
            .foregroundStyle(Color.textSecondary)
            .fixedSize(horizontal: false, vertical: true)
            .frame(maxWidth: .infinity, alignment: .leading)
            .pulpeCard()
    }

    @ViewBuilder
    private func plannedRow(_ item: PlannedItem) -> some View {
        if let budgetId = item.budgetId {
            Button {
                onOpenBudget(budgetId)
            } label: {
                plannedRowContent(item)
            }
            .plainPressedButtonStyle()
            .frame(minHeight: DesignTokens.TapTarget.minimum)
            .contentShape(.rect(cornerRadius: DesignTokens.CornerRadius.lg))
            .accessibilityElement(children: .ignore)
            .accessibilityLabel(item.accessibilityLabel(currency: currency))
            .accessibilityHint(item.accessibilityHint ?? "")
        } else {
            plannedRowContent(item)
                .accessibilityElement(children: .ignore)
                .accessibilityLabel(item.accessibilityLabel(currency: currency))
        }
    }

    private func plannedRowContent(_ item: PlannedItem) -> some View {
        HStack(alignment: .top, spacing: DesignTokens.Spacing.md) {
            Image(systemName: item.isPlanOnly ? "calendar.badge.minus" : "calendar")
                .font(PulpeTypography.actionIcon)
                .foregroundStyle(Color.textTertiary)

            if dynamicTypeSize.isAccessibilitySize {
                VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
                    plannedDescription(item)
                    HStack(spacing: DesignTokens.Spacing.sm) {
                        Spacer(minLength: DesignTokens.Spacing.none)
                        plannedAmount(item)
                        if item.budgetId != nil { plannedChevron }
                    }
                }
            } else {
                plannedDescription(item)
                Spacer(minLength: DesignTokens.Spacing.sm)
                plannedAmount(item)
                if item.budgetId != nil { plannedChevron }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .pulpeCard()
    }

    private func plannedDescription(_ item: PlannedItem) -> some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.xxs) {
            Text(item.name)
                .font(PulpeTypography.listRowTitle)
                .foregroundStyle(Color.textPrimary)
                .fixedSize(horizontal: false, vertical: true)
            Text("\(item.periodLabel) · \(item.statusLabel)\(item.isPlanOnly ? " · Hors budget" : "")")
                .font(PulpeTypography.listRowSubtitle)
                .foregroundStyle(Color.textTertiary)
                .fixedSize(horizontal: false, vertical: true)
            if !item.isPlanOnly {
                Text(item.contextLabel(currency: currency))
                    .font(PulpeTypography.listRowSubtitle)
                    .foregroundStyle(Color.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)
                    .sensitiveAmount()
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var plannedChevron: some View {
        Image(systemName: "chevron.right")
            .font(PulpeTypography.caption)
            .foregroundStyle(Color.textTertiary)
            .accessibilityHidden(true)
    }

    private func realizedRow(_ withdrawal: SavingsGoalWithdrawal) -> some View {
        Button {
            onOpenBudget(withdrawal.budgetId)
        } label: {
            HStack(alignment: .top, spacing: DesignTokens.Spacing.md) {
                Image(systemName: "arrow.up.right")
                    .font(PulpeTypography.actionIcon)
                    .foregroundStyle(Color.textTertiary)

                if dynamicTypeSize.isAccessibilitySize {
                    VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
                        realizedDescription(withdrawal)
                        HStack(spacing: DesignTokens.Spacing.sm) {
                            Spacer(minLength: DesignTokens.Spacing.none)
                            realizedAmount(withdrawal)
                            plannedChevron
                        }
                    }
                } else {
                    realizedDescription(withdrawal)
                    Spacer(minLength: DesignTokens.Spacing.sm)
                    realizedAmount(withdrawal)
                    plannedChevron
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .pulpeCard()
        }
        .plainPressedButtonStyle()
        .frame(minHeight: DesignTokens.TapTarget.minimum)
        .contentShape(.rect(cornerRadius: DesignTokens.CornerRadius.lg))
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(realizedAccessibilityLabel(withdrawal))
        .accessibilityHint("Ouvre le budget")
    }

    private func realizedDescription(_ withdrawal: SavingsGoalWithdrawal) -> some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.xxs) {
            Text(withdrawal.name)
                .font(PulpeTypography.listRowTitle)
                .foregroundStyle(Color.textPrimary)
                .fixedSize(horizontal: false, vertical: true)
            Text(realizedStatus(withdrawal))
                .font(PulpeTypography.listRowSubtitle)
                .foregroundStyle(Color.textTertiary)
                .fixedSize(horizontal: false, vertical: true)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func realizedAmount(_ withdrawal: SavingsGoalWithdrawal) -> some View {
        Text((-withdrawal.amount).asCurrency(currency))
            .font(PulpeTypography.amountCard)
            .monospacedDigit()
            .foregroundStyle(Color.textPrimary)
            .fixedSize(horizontal: false, vertical: true)
            .sensitiveAmount()
    }

    private func realizedStatus(_ withdrawal: SavingsGoalWithdrawal) -> String {
        "\(withdrawal.transactionDate.formatted(date: .abbreviated, time: .omitted)) · "
            + (withdrawal.checkedAt == nil ? "À pointer" : "Pointé")
    }

    private func realizedAccessibilityLabel(_ withdrawal: SavingsGoalWithdrawal) -> String {
        "\(withdrawal.name), \(realizedStatus(withdrawal)), retrait réalisé "
            + withdrawal.amount.asCurrency(currency)
    }
}

private extension GoalWithdrawalsSection {
    func plannedAmount(_ item: PlannedItem) -> some View {
        VStack(alignment: .trailing, spacing: DesignTokens.Spacing.xxs) {
            Text((-item.primaryAmount).asCurrency(currency))
                .font(PulpeTypography.amountCard)
                .monospacedDigit()
                .foregroundStyle(Color.textPrimary)
                .fixedSize(horizontal: false, vertical: true)
                .sensitiveAmount()

            if let detail = item.primaryAmountDetail {
                Text(detail)
                    .font(PulpeTypography.listRowSubtitle)
                    .foregroundStyle(Color.textSecondary)
                    .accessibilityHidden(true)
            }
        }
    }
}

#Preview {
    ScrollView {
        VStack(spacing: DesignTokens.Spacing.xl) {
            GoalWithdrawalsSection(
                withdrawals: [
                    SavingsGoalWithdrawal(
                        transactionId: "tx-1",
                        budgetId: "budget-1",
                        name: "Apport cuisine",
                        transactionDate: Date(timeIntervalSince1970: 1_753_000_000),
                        amount: 4500
                    ),
                    SavingsGoalWithdrawal(
                        transactionId: "tx-2",
                        budgetId: "budget-2",
                        name: "Remplacement du lave-vaisselle du studio",
                        transactionDate: Date(timeIntervalSince1970: 1_750_000_000),
                        amount: 899.55
                    ),
                ],
                planned: [],
                planOnly: [],
                currency: .chf,
                isLoading: false,
                error: nil,
                onOpenBudget: { _ in }
            )

            GoalWithdrawalsSection(
                withdrawals: [],
                planned: [],
                planOnly: [],
                currency: .chf,
                isLoading: false,
                error: APIError.serverError(message: "Indisponible"),
                onOpenBudget: { _ in }
            )
        }
        .padding()
    }
    .pulpeBackground()
}
