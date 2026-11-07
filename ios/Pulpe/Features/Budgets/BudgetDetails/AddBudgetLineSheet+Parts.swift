import SwiftUI

/// The lower half of "Nouvelle prévision": "Quand ?", the impact, the optional pickers and the CTA.
/// Split out of the sheet to keep it under the feature's 350-LOC budget; the state it reads is
/// declared non-private on the sheet for this reason.
extension AddBudgetLineSheet {
    /// A month before the one in progress is closed: nothing new can be written into it.
    var isClosedMonth: Bool {
        let live = BudgetPeriodCalculator.periodForDate(Date(), payDayOfMonth: userSettingsStore.payDayOfMonth)
        return anchorYear * 12 + anchorMonth < live.year * 12 + live.month
    }

    /// "Chaque mois" writes into the model, so it needs one and an open month.
    var offersEveryMonth: Bool { templateId != nil && !isClosedMonth }

    var amountCaption: String? {
        switch mode {
        case .spread: AppLocale.string("au total")
        case .everyMonth: AppLocale.string("par mois")
        case .once: nil
        }
    }

    /// What this month carries: the amount, or its share of the spread.
    private var monthShare: Decimal? {
        guard let amount, amount > 0 else { return nil }
        guard isSpreadMode else { return amount }
        return SpreadSplit.splitTotalPreserving(total: amount, partCount: max(spreadCalculator.selectedCount, 1)).first
    }

    var whenSection: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.md) {
            Text("Quand ?")
                .font(PulpeTypography.metricLabel)
                .foregroundStyle(Color.onSurfaceVariant)
            SpreadModeToggle(selection: $mode, kind: kind, isEveryMonthDisabled: !offersEveryMonth)
            if isSpreadMode {
                spreadStepper
                    .transition(.revealBelowTrigger)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .animation(DesignTokens.Animation.smoothEaseOut, value: isSpreadMode)
    }

    private var spreadStepper: some View {
        FormCard {
            HStack {
                Text("Sur combien de mois")
                    .font(PulpeTypography.rowTitle)
                    .foregroundStyle(Color.textPrimary)
                Spacer()
                stepButton(systemName: "minus", label: "Moins de mois", delta: -1)
                Text("\(spreadMonthCount)")
                    .font(PulpeTypography.rowTitle.monospacedDigit())
                    .frame(minWidth: DesignTokens.TapTarget.minimum / 2)
                    .accessibilityIdentifier("spreadMonthCount")
                stepButton(systemName: "plus", label: "Plus de mois", delta: 1)
            }
            .padding(DesignTokens.Spacing.lg)
            if let share = monthShare {
                FormRowDivider()
                VStack(alignment: .leading, spacing: DesignTokens.Spacing.xs) {
                    Text("Soit \(share.asAmount(for: inputCurrency)) par mois")
                        .font(PulpeTypography.rowTitle)
                        .foregroundStyle(Color.textPrimary)
                    if let range = spreadRangeCaption {
                        Text(range)
                            .font(PulpeTypography.caption)
                            .foregroundStyle(Color.onSurfaceVariant)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(DesignTokens.Spacing.lg)
            }
        }
    }

    private func stepButton(systemName: String, label: LocalizedStringKey, delta: Int) -> some View {
        Button {
            spreadMonthCount = min(max(spreadMonthCount + delta, 2), SpreadCalculator.maxMonths)
        } label: {
            Image(systemName: systemName)
                .font(PulpeTypography.rowTitle)
                .foregroundStyle(Color.textPrimary)
                .frame(width: DesignTokens.TapTarget.minimum, height: DesignTokens.TapTarget.minimum)
                .background(Color.sunk, in: Circle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(label)
    }

    private var spreadRangeCaption: String? {
        guard let first = spreadCalculator.selectedMonths.first, let last = spreadCalculator.selectedMonths.last else {
            return nil
        }
        return AppLocale.string("De \(first.name.lowercased()) à \(last.name.lowercased())")
    }

    @ViewBuilder
    var impactBlock: some View {
        if let ledger, let share = monthShare, !isPlannedWithdrawalMode, !isSavingsWithdrawalMode {
            let impact = MovementImpact.forecast(ledger: ledger, budgetId: budgetId, kind: kind, amount: share)
            let currency = userSettingsStore.currency
            ImpactBlock(
                title: impact.title(currency: currency),
                before: impact.before,
                after: impact.after,
                currency: currency,
                tone: impact.tone == .over ? .over : (impact.tone == .ok ? .ok : .neutral),
                showsFigures: impact.tone != .neutral
            )
            .transition(.revealBelowTrigger)
        }
    }

    /// Only the pickers that apply: a goal for a saving, an origin for an income.
    @ViewBuilder
    var detailsCard: some View {
        if Self.showsSavingsGoalPicker(kind: kind) || kind == .income {
            FormCard {
                if Self.showsSavingsGoalPicker(kind: kind) {
                    SavingsGoalPickerField(
                        selection: $savingsGoalId,
                        budgetPeriod: Self.savingsGoalPeriod(
                            spreadMonths: isSpreadMode ? spreadCalculator.selectedMonths : [],
                            anchorMonth: anchorMonth,
                            anchorYear: anchorYear
                        ),
                        style: .row
                    )
                }
                if kind == .income {
                    originPicker
                }
                if isPlannedWithdrawalMode {
                    FormRowDivider()
                    SavingsGoalPickerField(
                        selection: $sourceSavingsGoalId,
                        mode: .plannedWithdrawal,
                        budgetPeriod: BudgetPeriod(month: anchorMonth, year: anchorYear),
                        withdrawalAmount: convertedAmount,
                        style: .row
                    )
                    // The picker ends on its note, free text with no row height of its own.
                    .padding(.bottom, DesignTokens.Spacing.lg)
                }
            }
        }
    }

    private var ctaTitle: String {
        if isSavingsWithdrawalMode { return AppLocale.string("Continuer") }
        if isPlannedWithdrawalMode { return AppLocale.string("Planifier le retrait") }
        if isSpreadMode, let share = monthShare {
            return AppLocale.string("Réserver \(share.asAmount(for: inputCurrency)) par mois")
        }
        return AppLocale.string("Ajouter")
    }

    var addButton: some View {
        VStack(spacing: DesignTokens.Spacing.sm) {
            Button { Task { await submit() } } label: {
                Text(ctaTitle)
            }
            .disabled(!canSubmit)
            .primaryButtonStyle(isEnabled: canSubmit)
            .accessibilityIdentifier("addBudgetLineSubmit")

            if let hint = validationHint {
                Text(hint)
                    .font(PulpeTypography.caption)
                    .foregroundStyle(Color.onSurfaceVariant)
                    .transition(.opacity.combined(with: .move(edge: .top)))
            }
        }
        .animation(DesignTokens.Animation.smoothEaseInOut, value: validationHint)
    }
}
