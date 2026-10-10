import SwiftUI

/// Step 2 of "Rapprocher mes comptes": the checked balance the accounts are held
/// against, and what it is made of — all read from the loaded month, never recomputed.
struct ReconcileSummaryStep: View {
    let flow: ReconcileAccountsFlow
    let month: ReconcileAccountsSheet.Month
    let currency: SupportedCurrency
    let onClose: @MainActor () -> Void

    private var realized: BudgetFormulas.RealizedMetrics { month.realizedMetrics }

    var body: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.xl) {
            ReconcileHeader(
                title: AppLocale.string("Solde pointé"),
                value: realized.realizedBalance.asCurrency(currency),
                caption: month.periodLabel.map { AppLocale.string("Période : \($0)") }
            )
            // Each part opens on its nature disc and carries its color, as on the ledger:
            // four rows of the same black read as one block nobody parsed.
            FormCard {
                ReconcileAmountRow(
                    title: AppLocale.string("Report du mois précédent"),
                    value: month.rollover.asArithmeticSignedCurrency(currency),
                    icon: .init(systemName: "arrow.uturn.forward", tint: .onSurfaceVariant)
                )
                FormRowDivider()
                kindRow(.income, title: AppLocale.string("Revenus pointés"), amount: realized.realizedIncome)
                FormRowDivider()
                kindRow(.expense, title: AppLocale.string("Dépenses pointées"), amount: realized.realizedSpending)
                FormRowDivider()
                kindRow(.saving, title: AppLocale.string("Épargne pointée"), amount: realized.checkedSavingsAmount)
                // In the same card: one row never gets a card of its own (One Ledger Rule).
                if month.uncheckedCount > 0 {
                    FormRowDivider()
                    itemsToCheckRow
                }
            }
            if month.uncheckedCount > 0 {
                Text("Seuls les éléments pointés comptent ici. Ce qu'il reste à pointer peut expliquer un écart.")
                    .font(PulpeTypography.caption)
                    .foregroundStyle(Color.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .reconcileStep(AppLocale.string("Ton solde pointé"), onClose: onClose) {
            Button("Comparer avec mes comptes") { flow.continueToVerdict() }
                .primaryButtonStyle()
                .accessibilityIdentifier("reconcileCompareButton")
        }
    }

    private func kindRow(_ kind: TransactionKind, title: String, amount: Decimal) -> some View {
        ReconcileAmountRow(
            title: title,
            value: amount.asSignedCurrency(currency, for: kind),
            tint: kind.color,
            icon: .init(systemName: kind.icon, tint: kind.color)
        )
    }

    /// Pushed inside the flow: the month's own page would have dropped every account typed.
    private var itemsToCheckRow: some View {
        Button(action: flow.showItemsToCheck) {
            HStack(spacing: DesignTokens.Spacing.md) {
                RowIcon(systemName: "checklist", tint: .pulpePrimary)
                Text("Opérations à pointer")
                    .font(PulpeTypography.bodyLarge)
                    .foregroundStyle(Color.textPrimary)
                Spacer(minLength: DesignTokens.Spacing.sm)
                Text(month.uncheckedCount, format: .number)
                    .font(PulpeTypography.bodyLarge)
                    .monospacedDigit()
                    .foregroundStyle(Color.textSecondary)
                Image(systemName: "chevron.right")
                    .font(PulpeTypography.caption)
                    .foregroundStyle(Color.textTertiary)
                    .accessibilityHidden(true)
            }
            .padding(.vertical, DesignTokens.Spacing.md)
            .frame(minHeight: DesignTokens.ListRow.minHeight)
            .contentShape(Rectangle())
        }
        .plainPressedButtonStyle()
        .accessibilityIdentifier("reconcileItemsToCheckRow")
    }
}

/// Step 3 of "Rapprocher mes comptes": the cent-exact gap, then either "Tout est à jour"
/// or the one adjustment that closes it. Its label can change; its amount cannot — it is
/// what makes the checked balance equal the accounts.
struct ReconcileVerdictStep: View {
    @Bindable var flow: ReconcileAccountsFlow
    /// Read live, with its identity: the flow refuses a balance from another month.
    let month: ReconcileAccountsSheet.Month
    let currency: SupportedCurrency
    let onSubmit: @MainActor () async -> Void
    let onFinish: @MainActor () -> Void
    let onClose: @MainActor () -> Void

    @FocusState private var focusedField: Field?

    enum Field: Hashable {
        case label
    }

    init(
        flow: ReconcileAccountsFlow,
        month: ReconcileAccountsSheet.Month,
        currency: SupportedCurrency,
        onSubmit: @escaping @MainActor () async -> Void,
        onFinish: @escaping @MainActor () -> Void,
        onClose: @escaping @MainActor () -> Void
    ) {
        self.flow = flow
        self.month = month
        self.currency = currency
        self.onSubmit = onSubmit
        self.onFinish = onFinish
        self.onClose = onClose
    }

    private var realizedBalance: Decimal { month.realizedMetrics.realizedBalance }

    private var verdict: AccountReconciliation.Verdict? {
        flow.verdict(realizedBalance: realizedBalance)
    }

    var body: some View {
        // The verdict first, the two figures behind it next, then what closes the gap.
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.xl) {
            switch verdict {
            case .upToDate:
                upToDate
                comparison
            case .adjustment(let kind, let amount):
                ReconcileHeader(
                    title: kind == .income
                        ? AppLocale.string("En plus sur tes comptes")
                        : AppLocale.string("En moins sur tes comptes"),
                    value: amount.asSignedCurrency(currency, for: kind),
                    tint: kind.color,
                    caption: AppLocale.string("par rapport à ton solde pointé")
                )
                comparison
                adjustment(kind: kind, amount: amount)
            case nil:
                comparison
            }
        }
        .reconcileStep(AppLocale.string("Écart"), isSubmitting: flow.isSubmitting, onClose: onClose) {
            footer
        }
    }

    private var comparison: some View {
        FormCard {
            ReconcileAmountRow(
                title: AppLocale.string("Tes comptes"),
                value: (flow.total ?? 0).asCurrency(currency),
                icon: .init(systemName: "building.columns", tint: .onSurfaceVariant)
            )
            FormRowDivider()
            ReconcileAmountRow(
                title: AppLocale.string("Solde pointé"),
                value: realizedBalance.asCurrency(currency),
                icon: .init(systemName: "checkmark", tint: .pulpePrimary)
            )
        }
    }

    private var upToDate: some View {
        VStack(spacing: DesignTokens.Spacing.sm) {
            Image(systemName: "checkmark.circle.fill")
                .font(PulpeTypography.heroIcon)
                .foregroundStyle(Color.financialSavings)
                .accessibilityHidden(true)
            Text("Tout est à jour")
                .font(PulpeTypography.title2)
            Text("Tes comptes et ton solde pointé sont identiques, au centime près.")
                .font(PulpeTypography.subheadline)
                .foregroundStyle(Color.textSecondary)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .accessibilityElement(children: .combine)
    }

    private func adjustment(kind: TransactionKind, amount: Decimal) -> some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
            FormCard {
                FormTextField(
                    hint: AppLocale.string("Ajustement"),
                    text: $flow.adjustmentLabel,
                    label: AppLocale.string("Description"),
                    accessibilityLabel: AppLocale.string("Description de l'ajustement"),
                    focusBinding: $focusedField,
                    field: .label,
                    style: .row
                )
                FormRowDivider()
                ReconcileAmountRow(
                    title: kind.label,
                    value: amount.asSignedCurrency(currency, for: kind),
                    tint: kind.color,
                    icon: .init(systemName: kind.icon, tint: kind.color)
                )
            }
            Text(kind == .income
                ? "Noté comme revenu pointé, cet ajustement aligne ton solde pointé sur tes comptes."
                : "Noté comme dépense pointée, cet ajustement aligne ton solde pointé sur tes comptes.")
                .font(PulpeTypography.caption)
                .foregroundStyle(Color.textSecondary)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    @ViewBuilder
    private var footer: some View {
        switch verdict {
        case .upToDate:
            let canFinish = !month.hasPointingInFlight
                && flow.canConfirmUpToDate(realizedBalance: realizedBalance, of: month.budgetId)
            Button("Terminer", action: onFinish)
                .disabled(!canFinish)
                .primaryButtonStyle(isEnabled: canFinish)
                .accessibilityIdentifier("reconcileFinishButton")
        case .adjustment:
            let canSubmit = !month.hasPointingInFlight
                && flow.canSubmitAdjustment(realizedBalance: realizedBalance, of: month.budgetId)
            Button {
                Task { await onSubmit() }
            } label: {
                if flow.isSubmitting {
                    ProgressView()
                } else {
                    Text("Enregistrer l'ajustement")
                }
            }
            .disabled(!canSubmit)
            .primaryButtonStyle(isEnabled: canSubmit)
            .accessibilityIdentifier("reconcileSubmitButton")
        case nil:
            EmptyView()
        }
    }
}

/// The figure a step is about, centered above its card. The strings arrive localized.
private struct ReconcileHeader: View {
    let title: String
    let value: String
    var tint: Color = .textPrimary
    var caption: String?

    var body: some View {
        VStack(spacing: DesignTokens.Spacing.sm) {
            Text(title)
                .font(PulpeTypography.subheadline)
                .foregroundStyle(Color.textSecondary)
            Text(value)
                .font(PulpeTypography.amountHero)
                .monospacedDigit()
                .foregroundStyle(tint)
                .sensitiveAmount()
            if let caption {
                Text(caption)
                    .font(PulpeTypography.caption)
                    .foregroundStyle(Color.textSecondary)
            }
        }
        .multilineTextAlignment(.center)
        .frame(maxWidth: .infinity)
        .accessibilityElement(children: .combine)
    }
}

/// One title / amount line of a reconciliation card. The title arrives localized.
private struct ReconcileAmountRow: View {
    struct Icon {
        let systemName: String
        let tint: Color
    }

    let title: String
    let value: String
    var tint: Color = .textPrimary
    var icon: Icon?

    var body: some View {
        // A disc has no baseline: rows that open on one center on it.
        HStack(alignment: icon == nil ? .firstTextBaseline : .center, spacing: DesignTokens.Spacing.md) {
            if let icon {
                RowIcon(systemName: icon.systemName, tint: icon.tint)
            }
            Text(title)
                .font(PulpeTypography.bodyLarge)
                .foregroundStyle(Color.textPrimary)
            Spacer(minLength: DesignTokens.Spacing.sm)
            Text(value)
                .font(PulpeTypography.bodyLarge)
                .monospacedDigit()
                .foregroundStyle(tint)
                .multilineTextAlignment(.trailing)
                .sensitiveAmount()
        }
        .padding(.vertical, DesignTokens.Spacing.md)
        .frame(minHeight: DesignTokens.ListRow.minHeight)
        .accessibilityElement(children: .combine)
    }
}
