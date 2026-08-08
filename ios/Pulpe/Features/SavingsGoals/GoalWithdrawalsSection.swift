import SwiftUI

/// « Retraits » (PUL-329) — the money that LEFT this goal for a budget.
///
/// Deliberately its own section, after « Ton suivi »: contributions grow the
/// stock, withdrawals shrink it, and merging them would force the reader to
/// decode a sign on every row. The amount therefore carries its minus sign but
/// keeps the ordinary text colour — a withdrawal is a decision, never an
/// anomaly (RG-002, l'épargne n'alerte jamais). The server sorts newest first;
/// this view does not re-sort.
///
/// `isRelevant` is the caller's gate: a goal nobody ever drew from says nothing
/// by staying silent, so the whole section disappears rather than announcing an
/// emptiness the user never asked about.
struct GoalWithdrawalsSection: View {
    let withdrawals: [SavingsGoalWithdrawal]
    let planned: [SavingsGoalPlannedWithdrawal]
    let planOnly: [SavingsGoalPlanOnlyWithdrawal]
    let currency: SupportedCurrency
    let isLoading: Bool
    let error: Error?
    let onOpenBudget: (String) -> Void

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
                if !planned.isEmpty || !planOnly.isEmpty {
                    Text("Retraits planifiés")
                        .font(PulpeTypography.headline)
                        .foregroundStyle(Color.textPrimary)
                    ForEach(planned) { withdrawal in
                        plannedRow(withdrawal)
                    }
                    ForEach(planOnly) { withdrawal in
                        planOnlyRow(withdrawal)
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

    private func planOnlyRow(_ withdrawal: SavingsGoalPlanOnlyWithdrawal) -> some View {
        HStack(spacing: DesignTokens.Spacing.md) {
            Image(systemName: "calendar.badge.minus")
                .font(PulpeTypography.actionIcon)
                .foregroundStyle(Color.textTertiary)
            VStack(alignment: .leading, spacing: DesignTokens.Spacing.xxs) {
                Text(withdrawal.name)
                    .font(PulpeTypography.listRowTitle)
                Text("\(planOnlyPeriod(withdrawal)) · Hors budget")
                    .font(PulpeTypography.listRowSubtitle)
                    .foregroundStyle(Color.textTertiary)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            Text((-withdrawal.plannedAmount).asCurrency(currency))
                .font(PulpeTypography.amountCard)
                .monospacedDigit()
                .sensitiveAmount()
        }
        .pulpeCard()
        .accessibilityElement(children: .combine)
    }

    private func planOnlyPeriod(_ withdrawal: SavingsGoalPlanOnlyWithdrawal) -> String {
        let components = DateComponents(year: withdrawal.year, month: withdrawal.month, day: 1)
        return (Calendar.current.date(from: components) ?? .now)
            .formatted(.dateTime.month(.wide).year())
    }

    private func notice(_ message: String) -> some View {
        Text(message)
            .font(PulpeTypography.listRowSubtitle)
            .foregroundStyle(Color.textSecondary)
            .fixedSize(horizontal: false, vertical: true)
            .frame(maxWidth: .infinity, alignment: .leading)
            .pulpeCard()
    }

    private func plannedRow(_ withdrawal: SavingsGoalPlannedWithdrawal) -> some View {
        Button {
            onOpenBudget(withdrawal.budgetId)
        } label: {
            HStack(spacing: DesignTokens.Spacing.md) {
                Image(systemName: "calendar")
                    .font(PulpeTypography.actionIcon)
                    .foregroundStyle(Color.textTertiary)

                VStack(alignment: .leading, spacing: DesignTokens.Spacing.xxs) {
                    Text(withdrawal.name)
                        .font(PulpeTypography.listRowTitle)
                        .foregroundStyle(Color.textPrimary)
                        .fixedSize(horizontal: false, vertical: true)
                    Text(plannedSubtitle(withdrawal))
                        .font(PulpeTypography.listRowSubtitle)
                        .foregroundStyle(Color.textTertiary)
                    if withdrawal.status == .partiallyRealized {
                        Text("Reste à réaliser · \((-withdrawal.remainingAmount).asCurrency(currency))")
                            .font(PulpeTypography.listRowSubtitle)
                            .foregroundStyle(Color.textSecondary)
                            .sensitiveAmount()
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)

                Text((-withdrawal.plannedAmount).asCurrency(currency))
                    .font(PulpeTypography.amountCard)
                    .monospacedDigit()
                    .foregroundStyle(Color.textPrimary)
                    .sensitiveAmount()

                Image(systemName: "chevron.right")
                    .font(PulpeTypography.caption)
                    .foregroundStyle(Color.textTertiary)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .pulpeCard()
        }
        .plainPressedButtonStyle()
        .accessibilityElement(children: .combine)
        .accessibilityHint("Ouvre le budget de cette prévision")
    }

    private func plannedSubtitle(_ withdrawal: SavingsGoalPlannedWithdrawal) -> String {
        let components = DateComponents(year: withdrawal.year, month: withdrawal.month, day: 1)
        let date = Calendar.current.date(from: components) ?? .now
        let period = date.formatted(.dateTime.month(.wide).year())
        let status = switch withdrawal.status {
        case .planned: "À réaliser"
        case .partiallyRealized: "Partiellement réalisé"
        case .realized: "Réalisé"
        }
        return "\(period) · \(status)"
    }

    private func realizedRow(_ withdrawal: SavingsGoalWithdrawal) -> some View {
        Button {
            onOpenBudget(withdrawal.budgetId)
        } label: {
            HStack(spacing: DesignTokens.Spacing.md) {
                Image(systemName: "arrow.up.right")
                    .font(PulpeTypography.actionIcon)
                    .foregroundStyle(Color.textTertiary)

                VStack(alignment: .leading, spacing: DesignTokens.Spacing.xxs) {
                    // No line limit anywhere in this row: the goal's own screen is
                    // where a long name belongs in full, at any Dynamic Type size.
                    Text(withdrawal.name)
                        .font(PulpeTypography.listRowTitle)
                        .foregroundStyle(Color.textPrimary)
                        .fixedSize(horizontal: false, vertical: true)
                    Text(
                        "\(withdrawal.transactionDate.formatted(date: .abbreviated, time: .omitted)) · "
                            + (withdrawal.checkedAt == nil ? "À pointer" : "Pointé")
                    )
                        .font(PulpeTypography.listRowSubtitle)
                        .foregroundStyle(Color.textTertiary)
                }
                .frame(maxWidth: .infinity, alignment: .leading)

                Text((-withdrawal.amount).asCurrency(currency))
                    .font(PulpeTypography.amountCard)
                    .monospacedDigit()
                    .foregroundStyle(Color.textPrimary)
                    .fixedSize(horizontal: false, vertical: true)
                    .sensitiveAmount()

                Image(systemName: "chevron.right")
                    .font(PulpeTypography.caption)
                    .foregroundStyle(Color.textTertiary)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .pulpeCard()
        }
        .plainPressedButtonStyle()
        .contentShape(.rect(cornerRadius: DesignTokens.CornerRadius.lg))
        // Combined so VoiceOver reads the whole name, its date and its amount;
        // the hint carries the destination the chevron only hints at visually.
        .accessibilityElement(children: .combine)
        .accessibilityHint("Ouvre le budget de ce revenu")
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
