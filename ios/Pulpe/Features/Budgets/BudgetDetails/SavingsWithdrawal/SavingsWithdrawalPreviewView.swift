import SwiftUI

/// Step 2 of "piocher dans son épargne" (PUL-292) — the two-month preview the
/// user confirms. Presentational: the sheet owns the amount, submission and FX.
/// Copy is contractual (CA5, validated in test user) — verbatim, never "avance"
/// nor "emprunt". Months M / M+1 are derived by the sheet from the viewed month.
struct SavingsWithdrawalPreviewView: View {
    let amount: Decimal
    let currency: SupportedCurrency
    let monthName: String
    let nextMonthName: String
    let isSubmitting: Bool
    let onConfirm: () -> Void
    let onEdit: () -> Void

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: DesignTokens.Spacing.xl) {
                Text("Voici ce qu'on met en place")
                    .font(PulpeTypography.title3)
                    .foregroundStyle(Color.textPrimary)

                incomeBlock
                connector
                savingBlock

                Text("Tu tiens \(monthName). Ton épargne est reconstituée en \(nextMonthName).")
                    .font(PulpeTypography.subheadline)
                    .foregroundStyle(Color.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .padding(.horizontal, DesignTokens.Spacing.xl)
            .padding(.top, DesignTokens.Spacing.lg)
        }
        .scrollBounceBehavior(.basedOnSize)
        .pulpeBackground()
        .pulpeStickyBottomCTA { ctaStack }
        .navigationTitle("Aperçu")
        .navigationBarTitleDisplayMode(.inline)
    }

    // MARK: - Month blocks

    /// One month's block copy — bundled so `monthBlock` stays a single-parameter
    /// builder (SwiftLint parameter-count budget).
    private struct MonthBlock {
        let monthLabel: String
        let kindLabel: String
        let amountText: String
        let note: String
        var footnote: String?
        let accent: Color
    }

    private var incomeBlock: some View {
        monthBlock(MonthBlock(
            monthLabel: "\(monthName) · le mois choisi",
            kindLabel: "REVENU",
            amountText: amount.asSignedCurrency(currency, for: .income),
            note: "arrivent sur ton budget",
            footnote: "↪ pris sur ton épargne",
            accent: .financialIncome
        ))
    }

    private var savingBlock: some View {
        monthBlock(MonthBlock(
            monthLabel: "\(nextMonthName) · le mois suivant",
            kindLabel: "ÉPARGNE",
            amountText: amount.asSignedCurrency(currency, for: .saving),
            note: "mis de côté pour remettre l'argent sur ton épargne",
            accent: .financialSavings
        ))
    }

    private func monthBlock(_ block: MonthBlock) -> some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.xs) {
            Text(block.monthLabel)
                .font(PulpeTypography.caption)
                .foregroundStyle(Color.onSurfaceVariant)

            Text(block.kindLabel)
                .font(PulpeTypography.metricLabelBold)
                .tracking(DesignTokens.Tracking.uppercaseNarrow)
                .foregroundStyle(block.accent)

            Text(block.amountText)
                .font(PulpeTypography.amountCard)
                .foregroundStyle(block.accent)
                .monospacedDigit()
                .sensitiveAmount()

            Text(block.note)
                .font(PulpeTypography.subheadline)
                .foregroundStyle(Color.textSecondary)
                .fixedSize(horizontal: false, vertical: true)

            if let footnote = block.footnote {
                Text(footnote)
                    .font(PulpeTypography.caption)
                    .foregroundStyle(Color.textTertiary)
            }
        }
        .padding(DesignTokens.Spacing.lg)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.surfaceContainerLow, in: .rect(cornerRadius: DesignTokens.CornerRadius.button))
        .accessibilityElement(children: .combine)
    }

    private var connector: some View {
        Image(systemName: "arrow.down")
            .font(PulpeTypography.headline)
            .foregroundStyle(Color.textTertiary)
            .frame(maxWidth: .infinity)
            .accessibilityHidden(true)
    }

    // MARK: - CTA

    private var ctaStack: some View {
        VStack(spacing: DesignTokens.Spacing.sm) {
            Button(action: onConfirm) {
                Text("C'est parti")
            }
            .disabled(isSubmitting)
            .primaryButtonStyle(isEnabled: !isSubmitting)

            Button("Modifier le montant", action: onEdit)
                .textLinkButtonStyle()
                .disabled(isSubmitting)
                .frame(maxWidth: .infinity)
        }
    }
}

#Preview {
    NavigationStack {
        SavingsWithdrawalPreviewView(
            amount: 320,
            currency: .chf,
            monthName: "Juin",
            nextMonthName: "Juillet",
            isSubmitting: false,
            onConfirm: {},
            onEdit: {}
        )
    }
}
