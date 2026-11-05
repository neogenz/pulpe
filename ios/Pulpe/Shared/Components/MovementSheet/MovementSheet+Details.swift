import SwiftUI

/// The lower half of the movement sheet: the savings origin of an income, the details card,
/// the edit-only actions and the submit button.
extension MovementSheet {
    // MARK: - Savings origin (PUL-329 / PUL-292)

    @ViewBuilder
    var savingsOriginCard: some View {
        if savingsOriginRule.isOffered, realization == nil {
            FormCard {
                SavingsOriginToggle(
                    isOn: $isFromSavings,
                    origin: $savingsOrigin,
                    offersRepay: onRequestSavingsWithdrawal != nil,
                    tintColor: kind.color
                )
                if savingsOriginRule.isActive {
                    SavingsGoalPickerField(
                        selection: $savingsGoalId,
                        mode: .withdrawal,
                        withdrawalAmount: convertedAmount,
                        withdrawalRefreshToken: withdrawalRefreshToken,
                        onWithdrawalReadinessChange: { isWithdrawalReady = $0 },
                        style: .row
                    )
                }
            }
            .transition(.opacity)
        }
    }

    // MARK: - Details

    @ViewBuilder
    var detailsCard: some View {
        if isEditing {
            FormCard {
                TransactionDateSelector(date: $transactionDate, currency: userSettingsStore.currency, style: .row)
                FormRowDivider()
                TagPickerField(selection: $selectedTagIds, style: .row)
            }
        } else if !routesToWithdrawal, !savingsOriginRule.isActive {
            FormCard {
                if realization == nil {
                    CheckedToggle(isOn: $isChecked, tintColor: Color.pulpePrimary, style: .row)
                    FormRowDivider()
                }
                TransactionDateSelector(date: $transactionDate, currency: userSettingsStore.currency, style: .row)
            }
        }
    }

    /// The announced withdrawal being realized: which goal, what it holds, what is left to take.
    func realizationHeader(_ realization: AddAllocatedTransactionLogic.RealizationPrefill) -> some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.xs) {
            SavingsGoalSourceLabel(source: realization.goalSource)
            if let confirmedBalance {
                Text("Solde actuel · \(confirmedBalance.asAdaptiveCurrency(userSettingsStore.currency))")
                    .font(PulpeTypography.footnote)
                    .foregroundStyle(Color.onSurfaceVariant)
                    .sensitiveAmount()
            }
            if let remaining = realization.remainingAmount {
                Text("Montant restant prévu · \(remaining.asAdaptiveCurrency(userSettingsStore.currency))")
                    .font(PulpeTypography.footnote)
                    .foregroundStyle(Color.onSurfaceVariant)
                    .sensitiveAmount()
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    // MARK: - Actions

    var canSpread: Bool {
        guard let tx = context.editing, editActions?.spread != nil else { return false }
        return tx.budgetLineId == nil && tx.kind != .income
    }

    @ViewBuilder
    var editButtons: some View {
        if let tx = context.editing, let editActions {
            HStack(spacing: DesignTokens.Spacing.md) {
                if canSpread {
                    Button("Lisser sur plusieurs mois") {
                        dismiss()
                        editActions.spread?(tx)
                    }
                    .secondaryButtonStyle(size: .small)
                    .accessibilityIdentifier("movementSpread")
                }
                Button("Supprimer") {
                    dismiss()
                    editActions.delete(tx)
                }
                .destructiveButtonStyle(size: .small)
                .accessibilityIdentifier("movementDelete")
            }
        }
    }

    var submitTitle: String {
        if isEditing { return AppLocale.string("Enregistrer") }
        if routesToWithdrawal { return AppLocale.string("Continuer") }
        if realization != nil { return AppLocale.string("Confirmer le retrait") }
        guard let amount, amount > 0 else { return AppLocale.string("Ajouter") }
        return AppLocale.string("Ajouter \(amount.asCurrency(inputCurrency))")
    }

    var submitButton: some View {
        VStack(spacing: DesignTokens.Spacing.sm) {
            Button { Task { await submit() } } label: {
                Text(submitTitle).contentTransition(.numericText())
            }
            .disabled(!canSubmit)
            .primaryButtonStyle(isEnabled: canSubmit)
            .accessibilityIdentifier(isEditing ? "movementSave" : "addTransactionSubmit")

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
