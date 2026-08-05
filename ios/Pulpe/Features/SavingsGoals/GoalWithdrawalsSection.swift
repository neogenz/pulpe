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
    let currency: SupportedCurrency
    let isLoading: Bool
    let error: Error?
    let onOpen: (SavingsGoalWithdrawal) -> Void

    static func isRelevant(
        withdrawals: [SavingsGoalWithdrawal],
        isLoading: Bool,
        error: Error?
    ) -> Bool {
        !withdrawals.isEmpty || isLoading || error != nil
    }

    var body: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.md) {
            Text("Retraits")
                .font(PulpeTypography.title2)
                .foregroundStyle(Color.textPrimary)

            if isLoading, withdrawals.isEmpty {
                ProgressView("Chargement des retraits…")
                    .frame(maxWidth: .infinity)
                    .padding(DesignTokens.Spacing.xl)
            } else if error != nil, withdrawals.isEmpty {
                // No retry button: the whole detail reloads on pull-to-refresh,
                // and a failed history never blocks reading the progression.
                notice("Impossible de charger les retraits pour le moment.")
            } else {
                ForEach(withdrawals) { withdrawal in
                    row(withdrawal)
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

    private func row(_ withdrawal: SavingsGoalWithdrawal) -> some View {
        Button {
            onOpen(withdrawal)
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
                    Text(withdrawal.transactionDate.formatted(date: .abbreviated, time: .omitted))
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
                currency: .chf,
                isLoading: false,
                error: nil,
                onOpen: { _ in }
            )

            GoalWithdrawalsSection(
                withdrawals: [],
                currency: .chf,
                isLoading: false,
                error: APIError.serverError(message: "Indisponible"),
                onOpen: { _ in }
            )
        }
        .padding()
    }
    .pulpeBackground()
}
