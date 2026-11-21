import SwiftUI

// MARK: - Cards

extension ReconcileCompareStepView {
    /// Checking card purchases on the bill day is right too: then what I owe has no place here.
    var owedBox: some View {
        let owed = AccountReconciliation.amount(cents: flow.oweCents).asInlineCurrency(currency)
        // Hidden amounts leave the action readable: the label drops its amount instead of blurring.
        let remove = amountsHidden
            ? AppLocale.string("Retirer « Je dois »") : AppLocale.string("Retirer « Je dois \(owed) »")
        return FormCard {
            VStack(alignment: .leading, spacing: DesignTokens.Spacing.md) {
                Text("Tu coches tes achats de carte à la facture ?")
                    .font(PulpeTypography.rowTitleRegular)
                    .foregroundStyle(Color.textPrimary)
                    .fixedSize(horizontal: false, vertical: true)
                Button {
                    withAnimation(reduceMotion ? nil : DesignTokens.Animation.gentleSpring) { flow.removeOwedRows() }
                } label: {
                    Text(remove).monospacedDigit()
                }
                .secondaryButtonStyle(size: .small)
                .disabled(flow.isChecking || flow.isWriting)
                .accessibilityIdentifier("reconcileRemoveOwedButton")
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.vertical, DesignTokens.Spacing.lg)
        }
    }

    /// Under 10.00, an example says what such a gap can be: a café paid 3.80 and noted 3.00, never my own
    /// money, so it is the one amount of the step written without the currency, as on the web.
    func smallGapCard(gap: Decimal) -> some View {
        let cafe: (paid: Decimal, noted: Decimal) = gap < 0 ? (Decimal(380) / 100, 3) : (3, Decimal(380) / 100)
        let paid = cafe.paid.asAmount(for: currency), noted = cafe.noted.asAmount(for: currency)
        return FormCard {
            VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
                Text("Un arrondi ou des frais de ta banque ?")
                    .font(PulpeTypography.rowTitle)
                    .foregroundStyle(Color.textPrimary)
                Text(AppLocale.string("Café · payé \(paid) · noté \(noted)"))
                    .font(PulpeTypography.captionRegular)
                    .monospacedDigit()
                    .foregroundStyle(Color.textSecondary)
            }
            .fixedSize(horizontal: false, vertical: true)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.vertical, DesignTokens.Spacing.lg)
        }
    }

    /// Why « Disponible à dépenser » and the compared figure differ once they match.
    func matchedCard(_ comparison: ReconcileAccountsFlow.Comparison) -> some View {
        let breakdown = AccountReconciliation.matchedBreakdown(
            available: month.available, compared: comparison.compared, startingAmount: comparison.startingAmount
        )
        return FormCard {
            if breakdown.stillPlanned != 0 {
                let title = breakdown.stillPlanned < 0
                    ? AppLocale.string("Encore prévu") : AppLocale.string("Encore à recevoir")
                figureRow(title) {
                    Text(verbatim: signedCurrency(breakdown.stillPlanned))
                }
                FormRowDivider()
            }
            if breakdown.beforePulpe != 0 {
                // The row is the edit button; its amount keeps the card's ink, the pencil says it opens.
                Button { editsStartingAmount = true } label: {
                    figureRow(AppLocale.string("D'avant Pulpe"), isEditable: true) {
                        Text(verbatim: signedCurrency(breakdown.beforePulpe))
                    }
                }
                .plainPressedButtonStyle()
                .contentShape(Rectangle())
                .disabled(flow.isWriting || flow.isChecking)
                .accessibilityIdentifier("reconcileStartingAmountButton")
                FormRowDivider()
            }
            // Green says money is left; a month already past its plan stays in ink.
            figureRow(
                AppLocale.string("À dépenser ce mois"),
                tint: breakdown.remaining >= 0 ? Color.financialSavings : Color.textPrimary
            ) {
                Text(verbatim: breakdown.remaining.asCurrency(currency))
            }
        }
        // A bare id on a container would replace the ids of every row in it, the edit button's too.
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("reconcileMatchedBreakdown")
    }

    /// What the checks of this comparison found; what is left is already in the title.
    func foundBar(found: Decimal, gap: Decimal) -> some View {
        let total = found + gap.absoluteValue
        let progress = total > 0 ? NSDecimalNumber(decimal: found / total).doubleValue : 0
        return VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
            ZStack(alignment: .leading) {
                ProgressBarShape(progress: 1).fill(Color.sunk)
                ProgressBarShape(progress: CGFloat(progress)).fill(Color.pulpePrimary)
            }
            .frame(height: DesignTokens.ProgressBar.thickHeight)
            .accessibilityHidden(true)
            Text(AppLocale.string("\(found.asInlineCurrency(currency)) trouvés"))
                .font(PulpeTypography.captionRegular)
                .monospacedDigit()
                .foregroundStyle(Color.textSecondary)
                .sensitiveAmount()
        }
        .padding(.vertical, DesignTokens.Spacing.md)
        .accessibilityIdentifier("reconcileFound")
    }

    /// Says a figure opens its editor; never blurred with the amount.
    var editPencil: some View {
        Image(systemName: "pencil")
            .font(PulpeTypography.captionRegular.weight(.semibold))
            .foregroundStyle(Color.pulpePrimary)
            .accessibilityHidden(true)
    }

    /// "+60.00 CHF" / "−60.00 CHF": signed by its own value with a true minus, like the web's `signed()`.
    func signedCurrency(_ value: Decimal) -> String {
        "\(value < 0 ? "\u{2212}" : "+")\(value.absoluteValue.asInlineCurrency(currency))"
    }
}
