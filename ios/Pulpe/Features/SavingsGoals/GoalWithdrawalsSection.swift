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
    // Not `private`: the rows live in `GoalWithdrawalsSection+Rows.swift`, and a
    // private property there resolves to SwiftUI's `dynamicTypeSize(_:)` modifier
    // instead — an error that names the closure, never the access level.
    @Environment(\.dynamicTypeSize) var dynamicTypeSize

    let withdrawals: [SavingsGoalWithdrawal]
    let planned: [SavingsGoalPlannedWithdrawal]
    let planOnly: [SavingsGoalPlanOnlyWithdrawal]
    let currency: SupportedCurrency
    let isLoading: Bool
    let error: Error?
    let onOpenBudget: (String) -> Void
    let onRetry: () -> Void

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

        /// Un retrait entamé est le seul qui ait deux montants à raconter. Tant
        /// que rien n'est sorti, « Prévu … · Réalisé 0 » répète le montant de la
        /// rangée et lui ajoute un zéro.
        var isPartiallyRealized: Bool {
            guard case .linked(let withdrawal) = self,
                  case .partiallyRealized = withdrawal.status else { return false }
            return true
        }

        var primaryAmountDetail: String? {
            isPartiallyRealized ? AppLocale.string("restant") : nil
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
            guard case .linked(let withdrawal) = self else { return AppLocale.string("À réaliser") }
            return switch withdrawal.status {
            case .planned: AppLocale.string("À réaliser")
            case .partiallyRealized: AppLocale.string("Partiellement réalisé")
            case .realized: AppLocale.string("Réalisé")
            }
        }

        /// `String(year)`: interpolating an `Int` would apply localized grouping
        /// ("2'026" in de-CH) — never on a year.
        var periodLabel: String {
            "\(Formatters.monthName(for: month)) " + String(year)
        }

        func contextLabel(currency: SupportedCurrency) -> String {
            AppLocale.string("Prévu \(plannedAmount.asCurrency(currency))")
                + " · " + AppLocale.string("Réalisé \(realizedAmount.asCurrency(currency))")
        }

        /// Comma-joined independent segments, each its own key: the destination
        /// segment only exists off-budget, and no language has to reorder them.
        func accessibilityLabel(currency: SupportedCurrency) -> String {
            var parts = ["\(name), \(periodLabel), \(statusLabel)"]
            if isPlanOnly { parts.append(AppLocale.string("hors budget")) }
            parts.append(AppLocale.string("prévu \(plannedAmount.asCurrency(currency))"))
            parts.append(AppLocale.string("réalisé \(realizedAmount.asCurrency(currency))"))
            parts.append(AppLocale.string("reste \(remainingAmount.asCurrency(currency))"))
            return parts.joined(separator: ", ")
        }

        var accessibilityHint: String? { budgetId == nil ? nil : AppLocale.string("Ouvre le budget") }
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
            SectionHeader(title: AppLocale.string("Retraits"))

            if isLoading, withdrawals.isEmpty, planned.isEmpty, planOnly.isEmpty {
                ProgressView("Chargement des retraits…")
                    .frame(maxWidth: .infinity)
                    .padding(DesignTokens.Spacing.xl)
            } else if error != nil, withdrawals.isEmpty, planned.isEmpty, planOnly.isEmpty {
                GoalInfoCard(
                    icon: "arrow.clockwise",
                    title: AppLocale.string("Retraits indisponibles"),
                    message: AppLocale.string("Impossible de charger les retraits pour le moment.")
                ) {
                    Button("Réessayer", action: onRetry)
                        .secondaryButtonStyle()
                }
            } else {
                let plannedItems = Self.plannedItems(planned: planned, planOnly: planOnly)
                if !plannedItems.isEmpty {
                    group(AppLocale.string("Retraits planifiés")) {
                        ForEach(Array(plannedItems.enumerated()), id: \.element.id) { index, item in
                            if index > 0 { Divider() }
                            plannedRow(item)
                        }
                    }
                }

                if !withdrawals.isEmpty {
                    group(AppLocale.string("Retraits réalisés")) {
                        ForEach(Array(withdrawals.enumerated()), id: \.element.id) { index, withdrawal in
                            if index > 0 { Divider() }
                            realizedRow(withdrawal)
                        }
                    }
                }
            }
        }
    }

    /// The grammar of the home's activity: the group is named once on the canvas,
    /// its rows share one card, and the only rules are the hairlines inside it.
    private func group<Rows: View>(
        _ label: String,
        @ViewBuilder rows: () -> Rows
    ) -> some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
            Text(label)
                .font(PulpeTypography.labelMedium)
                .foregroundStyle(Color.textTertiary)
                .accessibilityAddTraits(.isHeader)

            VStack(spacing: DesignTokens.Spacing.none) {
                rows()
            }
            .padding(.horizontal, DesignTokens.Spacing.lg)
            .padding(.vertical, DesignTokens.Spacing.xs)
            .pulpeRowCard()
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
                onOpenBudget: { _ in },
                onRetry: {}
            )

            GoalWithdrawalsSection(
                withdrawals: [],
                planned: [],
                planOnly: [],
                currency: .chf,
                isLoading: false,
                error: APIError.serverError(message: "Indisponible"),
                onOpenBudget: { _ in },
                onRetry: {}
            )
        }
        .padding()
    }
    .pulpeBackground()
}
