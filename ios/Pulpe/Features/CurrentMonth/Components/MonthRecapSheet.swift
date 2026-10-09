import SwiftUI

/// The closed month in three figures, and where its carry-over leaves the new one
/// (PUL-111). Read-only: "Voir le détail" opens that month's budget, "C'est noté" retires
/// the card for that month. Both only report the choice; the presenter acts on it once the
/// sheet is gone.
struct MonthRecapSheet: View {
    let recap: MonthRecap
    let onShowDetails: @MainActor () -> Void
    let onAcknowledge: @MainActor () -> Void

    @Environment(UserSettingsStore.self) private var userSettingsStore
    @Environment(\.dismiss) private var dismiss

    private var currency: SupportedCurrency { userSettingsStore.currency }

    private var closedPeriodLabel: String {
        date(month: recap.month, year: recap.year)?.monthYearFormatted ?? ""
    }

    /// Native casing, not lowercased by hand: German capitalizes its month names.
    private var openedMonthName: String {
        let year = recap.openedMonth == 1 ? recap.year + 1 : recap.year
        return date(month: recap.openedMonth, year: year).map { Formatters.month.string(from: $0) } ?? ""
    }

    private var carryOverSentence: String {
        let carried = recap.carriedOver.asCompactCurrency(currency)
        let start = recap.startingAvailable.asCompactCurrency(currency)
        return AppLocale.string("\(carried) reportés sur \(openedMonthName) → tu démarres à \(start)")
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: DesignTokens.Spacing.xl) {
                VStack(alignment: .leading, spacing: DesignTokens.Spacing.xs) {
                    Text("Bilan du mois")
                        .font(PulpeTypography.stepTitle)
                        .foregroundStyle(Color.textPrimary)
                        .accessibilityAddTraits(.isHeader)
                    Text(closedPeriodLabel)
                        .font(PulpeTypography.stepSubtitle)
                        .foregroundStyle(Color.textSecondary)
                }

                VStack(spacing: DesignTokens.Spacing.md) {
                    figureRow("Revenus", amount: recap.income, tint: .financialIncome)
                    figureRow("Dépenses", amount: recap.expenses, tint: .financialExpense)
                    Divider()
                    figureRow(
                        "Solde final",
                        amount: recap.endingBalance,
                        tint: recap.endingBalance >= 0 ? .financialSavings : .financialOverBudget,
                        isTotal: true
                    )
                }

                Text(carryOverSentence)
                    .font(PulpeTypography.bodyLarge)
                    .foregroundStyle(Color.textPrimary)
                    .monospacedDigit()
                    .fixedSize(horizontal: false, vertical: true)
                    .sensitiveAmount()
                    .padding(DesignTokens.Spacing.lg)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(Color.surfaceContainer, in: .rect(cornerRadius: DesignTokens.CornerRadius.card))
            }
            .padding(DesignTokens.Spacing.xxl)
        }
        // Pinned rather than scrolled: at the medium detent the carry-over sentence can
        // sit below the fold, and the way out must not.
        .safeAreaInset(edge: .bottom, spacing: 0) {
            actions
        }
        .standardSheetPresentation(detents: [.medium, .large])
    }

    private var actions: some View {
        VStack(spacing: DesignTokens.Spacing.md) {
            Button("C'est noté") {
                onAcknowledge()
                dismiss()
            }
            .primaryButtonStyle()
            .accessibilityIdentifier("monthRecapAcknowledgeButton")

            Button("Voir le détail") {
                onShowDetails()
                dismiss()
            }
            .textLinkButtonStyle()
            .accessibilityIdentifier("monthRecapDetailsButton")
        }
        .padding(.horizontal, DesignTokens.Spacing.xxl)
        .padding(.vertical, DesignTokens.Spacing.md)
        .background(Color.sheetBackground)
    }

    private func figureRow(
        _ title: LocalizedStringKey,
        amount: Decimal,
        tint: Color,
        isTotal: Bool = false
    ) -> some View {
        HStack(alignment: .firstTextBaseline) {
            Text(title)
                .font(isTotal ? PulpeTypography.cardTitle : PulpeTypography.bodyLarge)
                .foregroundStyle(isTotal ? Color.textPrimary : Color.textSecondary)
            Spacer()
            Text(amount.asCompactCurrency(currency))
                .font(isTotal ? PulpeTypography.amountCard : PulpeTypography.amountMedium)
                .foregroundStyle(tint)
                .monospacedDigit()
                .sensitiveAmount()
        }
        .accessibilityElement(children: .combine)
    }

    private func date(month: Int, year: Int) -> Date? {
        Calendar.current.date(from: DateComponents(year: year, month: month, day: 1))
    }
}

#Preview {
    Color.clear
        .sheet(isPresented: .constant(true)) {
            MonthRecapSheet(
                recap: MonthRecap(
                    budgetId: "preview",
                    month: 9,
                    year: 2026,
                    openedMonth: 10,
                    income: 5_000,
                    expenses: 4_700,
                    endingBalance: 300,
                    carriedOver: 300,
                    startingAvailable: 5_300
                ),
                onShowDetails: {},
                onAcknowledge: {}
            )
        }
        .environment(UserSettingsStore())
}
