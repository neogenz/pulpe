import SwiftUI

struct GoalDeletionPresentation {
    private(set) var impact: SavingsGoalDeletionImpact?
    private(set) var deletesForecasts = false
    private(set) var deletesTransactions = false

    init(impact: SavingsGoalDeletionImpact? = nil) {
        self.impact = impact
    }

    var mode: SavingsGoalDeletionMode {
        guard deletesForecasts else { return .goalOnly }
        return deletesTransactions
            ? .goalForecastsAndTransactions
            : .goalAndForecasts
    }

    var command: SavingsGoalDeletionCommand? {
        impact.map { SavingsGoalDeletionCommand(mode: mode, revision: $0.revision) }
    }

    var budgets: [SavingsGoalDeletionBudget] {
        (impact?.budgets ?? []).sorted {
            ($0.year, $0.month) < ($1.year, $1.month)
        }
    }

    /// Read straight off the impact, never off the selection: an income drawn
    /// from the goal survives every mode (PUL-329), so the toggles must not be
    /// able to take it out of the list the sheet announces.
    var withdrawals: [SavingsGoalWithdrawal] {
        impact?.withdrawals ?? []
    }

    var withdrawalTotal: Decimal {
        impact?.summary.withdrawalTotal ?? 0
    }

    mutating func show(_ impact: SavingsGoalDeletionImpact?) {
        self.impact = impact
        if impact?.summary.transactionCount == 0 {
            deletesTransactions = false
        }
    }

    mutating func setDeletesForecasts(_ value: Bool) {
        deletesForecasts = value
        if !value { deletesTransactions = false }
    }

    mutating func setDeletesTransactions(_ value: Bool) {
        deletesTransactions = deletesForecasts
            && (impact?.summary.transactionCount ?? 0) > 0
            && value
    }
}

/// Exhaustive deletion preview (PUL-319). Summary and destructive action stay
/// fixed while the impact list uses LazyVStack, including large histories.
struct GoalDeletionSheet: View {
    let goal: SavingsGoal
    let currency: SupportedCurrency
    let onDeleted: @MainActor (_ warning: String?) -> Void

    @Environment(\.dismiss) private var dismiss
    @Environment(SavingsGoalStore.self) private var store

    @State private var presentation = GoalDeletionPresentation()
    @State private var isLoading = true
    @State private var isApplying = false
    @State private var error: Error?

    var body: some View {
        NavigationStack {
            Group {
                if isLoading {
                    loadingState
                } else if let impact = presentation.impact {
                    impactContent(impact)
                } else {
                    loadErrorState
                }
            }
            .background(Color.sheetBackground)
            .navigationTitle("Supprimer l'objectif")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Annuler") { dismiss() }
                        .disabled(isApplying)
                }
            }
        }
        .task { await loadImpact() }
    }

    private var loadingState: some View {
        VStack(spacing: DesignTokens.Spacing.md) {
            ProgressView()
                .controlSize(.large)
                .tint(Color.pulpePrimary)
            Text("Calcul de l'impact…")
                .font(PulpeTypography.listRowSubtitle)
                .foregroundStyle(Color.textSecondary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Calcul de l'impact de la suppression")
    }

    private var loadErrorState: some View {
        VStack(spacing: DesignTokens.Spacing.lg) {
            Image(systemName: "exclamationmark.triangle")
                .font(.title)
                .foregroundStyle(Color.financialExpense)
                .accessibilityHidden(true)
            Text("Impossible de calculer l'impact. Rien n'a été supprimé.")
                .font(PulpeTypography.bodyLarge)
                .foregroundStyle(Color.textPrimary)
                .multilineTextAlignment(.center)
            if let error {
                Text(DomainErrorLocalizer.localize(error))
                    .font(PulpeTypography.caption)
                    .foregroundStyle(Color.textSecondary)
                    .multilineTextAlignment(.center)
            }
            Button("Réessayer") {
                Task { await loadImpact() }
            }
            .primaryButtonStyle()
        }
        .padding(DesignTokens.Spacing.xl)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

private extension GoalDeletionSheet {
    private func impactContent(_ impact: SavingsGoalDeletionImpact) -> some View {
        VStack(spacing: DesignTokens.Spacing.md) {
            VStack(alignment: .leading, spacing: DesignTokens.Spacing.md) {
                Text("Vérifie tout ce qui est rattaché à « \(goal.name) » avant de choisir.")
                    .font(PulpeTypography.listRowSubtitle)
                    .foregroundStyle(Color.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)

                summary(impact.summary)
            }
            .padding(.horizontal, DesignTokens.Spacing.lg)

            impactList(impact)
            .scrollBounceBehavior(.basedOnSize)
            .accessibilityLabel("Liste complète des éléments rattachés")
        }
        .safeAreaInset(edge: .bottom) {
            Button {
                Task { await applyDeletion() }
            } label: {
                Text(isApplying ? "Suppression…" : confirmationLabel)
            }
            .destructiveButtonStyle()
            .disabled(isApplying || presentation.command == nil)
            .accessibilityLabel(confirmationLabel)
            .padding(.horizontal, DesignTokens.Spacing.lg)
            .padding(.vertical, DesignTokens.Spacing.md)
            .background(Color.sheetBackground)
        }
    }

    private func impactList(_ impact: SavingsGoalDeletionImpact) -> some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: DesignTokens.Spacing.lg) {
                selection(impact)

                if let error {
                    ErrorBanner(message: DomainErrorLocalizer.localize(error)) {
                        self.error = nil
                    }
                }

                if impact.templateLines.isEmpty && impact.budgets.isEmpty {
                    Text("Aucune prévision ni mouvement n'est rattaché à cet objectif.")
                        .font(PulpeTypography.listRowSubtitle)
                        .foregroundStyle(Color.textSecondary)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(DesignTokens.Spacing.lg)
                        .pulpeCardBackground()
                }

                if !impact.templateLines.isEmpty {
                    templateSection(impact.templateLines)
                }

                ForEach(presentation.budgets) { budget in
                    budgetSection(budget)
                }

                if !presentation.withdrawals.isEmpty {
                    withdrawalsSection
                }
            }
            .padding(.horizontal, DesignTokens.Spacing.lg)
            .padding(.bottom, DesignTokens.Spacing.xxl)
        }
    }

    private func summary(_ summary: SavingsGoalDeletionSummary) -> some View {
        ViewThatFits(in: .horizontal) {
            HStack(spacing: DesignTokens.Spacing.sm) {
                summaryCard(
                    label: "Mois Type",
                    count: String(summary.templateLineCount),
                    amount: summary.templateLineTotal
                )
                summaryCard(
                    label: "\(summary.budgetLineCount) prévision(s)",
                    count: "\(summary.budgetCount) budget(s)",
                    amount: summary.budgetLineTotal
                )
                summaryCard(
                    label: "Mouvements",
                    count: String(summary.transactionCount),
                    amount: summary.transactionTotal
                )
            }

            VStack(spacing: DesignTokens.Spacing.sm) {
                summaryCard(
                    label: "Mois Type",
                    count: String(summary.templateLineCount),
                    amount: summary.templateLineTotal
                )
                summaryCard(
                    label: "\(summary.budgetLineCount) prévision(s)",
                    count: "\(summary.budgetCount) budget(s)",
                    amount: summary.budgetLineTotal
                )
                summaryCard(
                    label: "Mouvements",
                    count: String(summary.transactionCount),
                    amount: summary.transactionTotal
                )
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Résumé de l'impact")
    }

    private func summaryCard(label: String, count: String, amount: Decimal) -> some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.xs) {
            Text(label)
                .font(PulpeTypography.metricLabel)
                .foregroundStyle(Color.textSecondary)
                .lineLimit(2)
            Text(count)
                .font(PulpeTypography.listRowTitle)
                .foregroundStyle(Color.textPrimary)
                .monospacedDigit()
            Text(amount.asCompactCurrency(currency))
                .font(PulpeTypography.metricLabelBold)
                .foregroundStyle(Color.textPrimary)
                .monospacedDigit()
                .sensitiveAmount()
        }
        .padding(DesignTokens.Spacing.md)
        .frame(maxWidth: .infinity, alignment: .leading)
        .pulpeCardBackground(cornerRadius: DesignTokens.CornerRadius.card)
    }
}

private extension GoalDeletionSheet {
    private func selection(_ impact: SavingsGoalDeletionImpact) -> some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.md) {
            Text("Que veux-tu supprimer ?")
                .font(PulpeTypography.cardTitle)
                .foregroundStyle(Color.textPrimary)

            Toggle(
                "Supprimer aussi toutes les prévisions rattachées",
                isOn: Binding(
                    get: { presentation.deletesForecasts },
                    set: { presentation.setDeletesForecasts($0) }
                )
            )
            .tint(Color.pulpePrimary)

            if !presentation.deletesForecasts {
                Text("Seul l'objectif sera supprimé. Tout le reste sera conservé.")
                    .font(PulpeTypography.caption)
                    .foregroundStyle(Color.textSecondary)
            } else if impact.summary.transactionCount > 0 {
                Toggle(
                    "Supprimer aussi les mouvements rattachés à ces prévisions",
                    isOn: Binding(
                        get: { presentation.deletesTransactions },
                        set: { presentation.setDeletesTransactions($0) }
                    )
                )
                .tint(Color.pulpePrimary)
            }
        }
        .padding(DesignTokens.Spacing.lg)
        .pulpeCardBackground()
    }

    private func templateSection(
        _ lines: [SavingsGoalDeletionTemplateLine]
    ) -> some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.md) {
            Text("Prévisions du Mois Type")
                .font(PulpeTypography.cardTitle)
                .foregroundStyle(Color.textPrimary)

            ForEach(lines) { line in
                impactRow(
                    title: line.name,
                    subtitle: line.templateName,
                    amount: line.amount
                )
            }
        }
        .padding(DesignTokens.Spacing.lg)
        .pulpeCardBackground()
    }

    private func budgetSection(_ budget: SavingsGoalDeletionBudget) -> some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.md) {
            Text(MonthYear(month: budget.month, year: budget.year).formatted)
                .font(PulpeTypography.cardTitle)
                .foregroundStyle(Color.textPrimary)

            ForEach(budget.lines) { line in
                VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
                    impactRow(title: line.name, subtitle: nil, amount: line.amount)

                    ForEach(line.transactions) { transaction in
                        impactRow(
                            title: transaction.name,
                            subtitle: "Réel",
                            amount: transaction.amount,
                            isNested: true
                        )
                    }
                }
            }
        }
        .padding(DesignTokens.Spacing.lg)
        .pulpeCardBackground()
    }

    /// Shown for every deletion mode, with no per-row action: an income drawn
    /// from this goal already landed in a budget the user has lived through, so
    /// it is never a candidate for deletion (PUL-329). The block states what
    /// survives instead of offering a choice that does not exist.
    private var withdrawalsSection: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.md) {
            Text("Retraits vers tes budgets")
                .font(PulpeTypography.cardTitle)
                .foregroundStyle(Color.textPrimary)

            Text(
                "Ces revenus restent dans leurs budgets, quel que soit ton choix."
                    + " Ils garderont le nom de l'objectif, mais leur lien ne mènera plus nulle part."
            )
            .font(PulpeTypography.listRowSubtitle)
            .foregroundStyle(Color.textSecondary)
            .fixedSize(horizontal: false, vertical: true)

            ForEach(presentation.withdrawals) { withdrawal in
                impactRow(
                    title: withdrawal.name,
                    subtitle: withdrawal.transactionDate.formatted(date: .abbreviated, time: .omitted),
                    amount: -withdrawal.amount
                )
            }

            Divider()

            HStack(alignment: .firstTextBaseline, spacing: DesignTokens.Spacing.md) {
                Text("Total retiré")
                    .font(PulpeTypography.listRowTitle)
                    .foregroundStyle(Color.textPrimary)
                Spacer(minLength: DesignTokens.Spacing.sm)
                Text((-presentation.withdrawalTotal).asCurrency(currency))
                    .font(PulpeTypography.metricLabelBold)
                    .foregroundStyle(Color.textPrimary)
                    .monospacedDigit()
                    .sensitiveAmount()
            }
            .accessibilityElement(children: .combine)
        }
        .padding(DesignTokens.Spacing.lg)
        .pulpeCardBackground()
    }

    private func impactRow(
        title: String,
        subtitle: String?,
        amount: Decimal,
        isNested: Bool = false
    ) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: DesignTokens.Spacing.md) {
            VStack(alignment: .leading, spacing: DesignTokens.Spacing.xxs) {
                Text(title)
                    .font(isNested ? PulpeTypography.listRowSubtitle : PulpeTypography.listRowTitle)
                    .foregroundStyle(isNested ? Color.textSecondary : Color.textPrimary)
                if let subtitle {
                    Text(subtitle)
                        .font(PulpeTypography.caption)
                        .foregroundStyle(Color.textSecondary)
                }
            }
            Spacer(minLength: DesignTokens.Spacing.sm)
            Text(amount.asCurrency(currency))
                .font(PulpeTypography.metricLabelBold)
                .foregroundStyle(Color.textPrimary)
                .monospacedDigit()
                .sensitiveAmount()
        }
        .padding(.leading, isNested ? DesignTokens.Spacing.lg : 0)
        .accessibilityElement(children: .combine)
    }

    private var confirmationLabel: String {
        switch presentation.mode {
        case .goalOnly:
            "Supprimer seulement l'objectif"
        case .goalAndForecasts:
            "Supprimer l'objectif et les prévisions"
        case .goalForecastsAndTransactions:
            "Tout supprimer"
        }
    }

    private func loadImpact(keepingError: Bool = false) async {
        isLoading = true
        if !keepingError { error = nil }
        presentation.show(nil)
        do {
            presentation.show(try await store.getDeletionImpact(id: goal.id))
        } catch {
            self.error = error
        }
        isLoading = false
    }

    private func applyDeletion() async {
        guard let command = presentation.command else { return }
        isApplying = true
        error = nil
        defer { isApplying = false }

        do {
            try await store.delete(id: goal.id, command: command)
            dismiss()
            onDeleted(nil)
        } catch let apiError as APIError {
            switch apiError {
            case .savingsGoalDeletionImpactChanged:
                error = apiError
                await loadImpact(keepingError: true)
            case .savingsGoalDeletionRecalculationFailed:
                dismiss()
                onDeleted(DomainErrorLocalizer.localize(apiError))
            default:
                error = apiError
            }
        } catch {
            self.error = error
        }
    }
}
