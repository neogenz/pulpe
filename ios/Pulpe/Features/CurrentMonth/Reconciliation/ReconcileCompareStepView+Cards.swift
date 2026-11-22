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
            available: month.available, compared: comparison.compared
        )
        return FormCard {
            // The figure the lines below start from, so the card adds up: 4 120.00, −320.00, 3 800.00.
            figureRow(AppLocale.string("Sur tes comptes")) {
                Text(verbatim: comparison.accounts.asCurrency(currency))
            }
            FormRowDivider()
            if breakdown.stillPlanned != 0 {
                let title = breakdown.stillPlanned < 0
                    ? AppLocale.string("Encore prévu") : AppLocale.string("Encore à recevoir")
                figureRow(title) {
                    Text(verbatim: signedCurrency(breakdown.stillPlanned))
                }
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
        // A bare id on a container would replace the ids of every row in it.
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("reconcileMatchedBreakdown")
    }

    /// The sentence over the rows and the button that leaves them (spec.md §4.2). Below Pulpe, a saving among
    /// the rows shown widens both to savings; a « Je dois » row keeps the card's sentence, not its button.
    static func suggestionsWording(
        _ comparison: ReconcileAccountsFlow.Comparison, hasOwedRow: Bool
    ) -> (lead: String, dismiss: String) {
        guard comparison.gap < 0 else {
            return (
                AppLocale.string("Coche les revenus que tu vois dans l'app de ta banque."),
                AppLocale.string("Aucun revenu ne correspond")
            )
        }
        let namesSavings = comparison.suggestions.contains { $0.kind == .saving }
        let lead = hasOwedRow ? AppLocale.string("Coche les achats faits avec ta carte.")
            : namesSavings ? AppLocale.string("Coche les dépenses et l'épargne que tu vois dans l'app de ta banque.")
            : AppLocale.string("Coche les dépenses que tu vois dans l'app de ta banque.")
        let dismiss = namesSavings
            ? AppLocale.string("Rien ne correspond") : AppLocale.string("Aucune dépense ne correspond")
        return (lead, dismiss)
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

    /// "+60.00 CHF" / "−60.00 CHF": signed by its own value with a true minus, like the web's `signed()`.
    func signedCurrency(_ value: Decimal) -> String {
        "\(value < 0 ? "\u{2212}" : "+")\(value.absoluteValue.asInlineCurrency(currency))"
    }
}
