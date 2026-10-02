import SwiftUI

/// Step 2 of "Rapprocher mes comptes": the checked balance the accounts are held
/// against, and what it is made of — all read from the loaded month, never recomputed.
struct ReconcileSummaryStep: View {
    let flow: ReconcileAccountsFlow
    let month: ReconcileAccountsSheet.Month
    let currency: SupportedCurrency
    let onShowItemsToCheck: @MainActor () -> Void
    let onClose: @MainActor () -> Void

    private var realized: BudgetFormulas.RealizedMetrics { month.realizedMetrics }

    var body: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.xl) {
            balanceHeader
            FormCard {
                ReconcileAmountRow(
                    title: AppLocale.string("Revenus pointés"),
                    value: realized.realizedIncome.asSignedCurrency(currency, for: .income)
                )
                FormRowDivider()
                ReconcileAmountRow(
                    title: AppLocale.string("Dépenses pointées"),
                    value: realized.realizedSpending.asSignedCurrency(currency, for: .expense)
                )
                FormRowDivider()
                ReconcileAmountRow(
                    title: AppLocale.string("Épargne pointée"),
                    value: realized.checkedSavingsAmount.asSignedCurrency(currency, for: .saving)
                )
                FormRowDivider()
                ReconcileAmountRow(
                    title: AppLocale.string("Report du mois précédent"),
                    value: month.rollover.asArithmeticSignedCurrency(currency)
                )
            }
            Text("Seuls les éléments pointés comptent ici. Ce qu'il reste à pointer peut expliquer un écart.")
                .font(PulpeTypography.caption)
                .foregroundStyle(Color.textSecondary)
                .fixedSize(horizontal: false, vertical: true)
            Button(action: onShowItemsToCheck) {
                Label("Voir ce qu'il reste à pointer", systemImage: "checklist")
                    .font(PulpeTypography.labelLarge)
            }
            .textLinkButtonStyle()
            .frame(minHeight: DesignTokens.TapTarget.minimum)
            .accessibilityIdentifier("reconcileItemsToCheckLink")
        }
        .reconcileStep(AppLocale.string("Ton solde pointé"), onClose: onClose) {
            Button("Comparer avec mes comptes") { flow.continueToVerdict() }
                .primaryButtonStyle()
                .accessibilityIdentifier("reconcileCompareButton")
        }
    }

    private var balanceHeader: some View {
        VStack(spacing: DesignTokens.Spacing.sm) {
            Text("Solde pointé")
                .font(PulpeTypography.subheadline)
                .foregroundStyle(Color.textSecondary)
            Text(realized.realizedBalance.asCurrency(currency))
                .font(PulpeTypography.amountHero)
                .monospacedDigit()
                .multilineTextAlignment(.center)
                .sensitiveAmount()
            if let periodLabel = month.periodLabel {
                Text("Période : \(periodLabel)")
                    .font(PulpeTypography.caption)
                    .foregroundStyle(Color.textTertiary)
            }
        }
        .frame(maxWidth: .infinity)
        .accessibilityElement(children: .combine)
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
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.xl) {
            comparison
            switch verdict {
            case .upToDate:
                upToDate
            case .adjustment(let kind, let amount):
                adjustment(kind: kind, amount: amount)
            case nil:
                EmptyView()
            }
        }
        .reconcileStep(AppLocale.string("Écart"), isSubmitting: flow.isSubmitting, onClose: onClose) {
            footer
        }
        .keyboardFieldNavigation(focus: $focusedField, order: [.label])
    }

    private var comparison: some View {
        let difference = flow.difference(realizedBalance: realizedBalance) ?? 0
        return FormCard {
            ReconcileAmountRow(
                title: AppLocale.string("Tes comptes"),
                value: (flow.total ?? 0).asCurrency(currency)
            )
            FormRowDivider()
            ReconcileAmountRow(
                title: AppLocale.string("Solde pointé"),
                value: realizedBalance.asCurrency(currency)
            )
            FormRowDivider()
            ReconcileAmountRow(
                title: AppLocale.string("Écart"),
                value: difference.asArithmeticSignedCurrency(currency),
                isEmphasized: true
            )
        }
    }

    private var upToDate: some View {
        VStack(spacing: DesignTokens.Spacing.sm) {
            Image(systemName: "checkmark.circle.fill")
                .font(PulpeTypography.headline)
                .imageScale(.large)
                .foregroundStyle(Color.financialSavings)
            Text("Tout est à jour")
                .font(PulpeTypography.headline)
            Text("Tes comptes et ton solde pointé sont identiques, au centime près.")
                .font(PulpeTypography.subheadline)
                .foregroundStyle(Color.textSecondary)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .accessibilityElement(children: .combine)
    }

    private func adjustment(kind: TransactionKind, amount: Decimal) -> some View {
        let formatted = amount.asCurrency(currency)
        let gapText = kind == .income
            ? AppLocale.string("Tes comptes ont \(formatted) de plus que ton solde pointé.")
            : AppLocale.string("Tes comptes ont \(formatted) de moins que ton solde pointé.")
        let remedyText = kind == .income
            ? AppLocale.string("Pour les aligner, on note un revenu pointé de ce montant.")
            : AppLocale.string("Pour les aligner, on note une dépense pointée de ce montant.")
        return VStack(alignment: .leading, spacing: DesignTokens.Spacing.lg) {
            Text(gapText)
                .font(PulpeTypography.body)
                .fixedSize(horizontal: false, vertical: true)
                .sensitiveAmount()
            Text(remedyText)
                .font(PulpeTypography.subheadline)
                .foregroundStyle(Color.textSecondary)
                .fixedSize(horizontal: false, vertical: true)
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
                    tint: kind.color
                )
            }
        }
    }

    @ViewBuilder
    private var footer: some View {
        switch verdict {
        case .upToDate:
            let canFinish = flow.canConfirmUpToDate(realizedBalance: realizedBalance, of: month.budgetId)
            Button("Terminer", action: onFinish)
                .disabled(!canFinish)
                .primaryButtonStyle(isEnabled: canFinish)
                .accessibilityIdentifier("reconcileFinishButton")
        case .adjustment:
            let canSubmit = flow.canSubmitAdjustment(realizedBalance: realizedBalance, of: month.budgetId)
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

/// One title / amount line of a reconciliation card. The title arrives localized.
private struct ReconcileAmountRow: View {
    let title: String
    let value: String
    var isEmphasized = false
    var tint: Color = .textPrimary

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: DesignTokens.Spacing.md) {
            Text(title)
                .font(PulpeTypography.bodyLarge)
                .foregroundStyle(Color.textPrimary)
            Spacer(minLength: DesignTokens.Spacing.sm)
            Text(value)
                .font(isEmphasized ? PulpeTypography.listRowTitle : PulpeTypography.bodyLarge)
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
