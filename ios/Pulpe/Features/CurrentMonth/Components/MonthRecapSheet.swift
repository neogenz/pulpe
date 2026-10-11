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
    /// Measured, so the sheet stops where its content does: a medium detent left half
    /// the sheet empty under the buttons.
    @State private var contentHeight: CGFloat = 0
    @State private var actionsHeight: CGFloat = 0

    private var currency: SupportedCurrency { userSettingsStore.currency }

    private var closedPeriodLabel: String {
        date(month: recap.month, year: recap.year)?.monthYearFormatted ?? ""
    }

    private var openedMonthName: String {
        Formatters.monthNameInText(for: recap.openedMonth)
    }

    private var carryOverSentence: String {
        let carried = recap.carriedOver.asCurrency(currency)
        let start = recap.startingAvailable.asCurrency(currency)
        return AppLocale.string("\(carried) reportés sur \(openedMonthName) → tu démarres à \(start)")
    }

    /// A custom detent's height leaves out the bottom safe area, which the system adds.
    private var fittedDetent: PresentationDetent {
        contentHeight > 0 ? .height(contentHeight + actionsHeight) : .medium
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

                // One format for the three figures: whole francs beside a balance to the
                // cent read as two different units ("5 200 CHF", "-1'478.2 CHF").
                FormCard {
                    figureRow("Revenus", kind: .income, amount: recap.income)
                    FormRowDivider()
                    figureRow("Dépenses", kind: .expense, amount: recap.expenses)
                    FormRowDivider()
                    balanceRow
                }

                carryOver
            }
            .padding(.horizontal, DesignTokens.Spacing.xl)
            .padding(.top, DesignTokens.Spacing.xxl)
            .padding(.bottom, DesignTokens.Spacing.lg)
            .onGeometryChange(for: CGFloat.self, of: \.size.height) { contentHeight = $0 }
        }
        // Scrolls only when the content outgrows the screen, at the largest text sizes.
        .scrollBounceBehavior(.basedOnSize)
        .safeAreaInset(edge: .bottom, spacing: 0) {
            actions
                .onGeometryChange(for: CGFloat.self, of: \.size.height) { actionsHeight = $0 }
        }
        .standardSheetPresentation(detents: [fittedDetent])
    }

    private var carryOver: some View {
        HStack(spacing: DesignTokens.Spacing.md) {
            RowIcon(systemName: "arrow.uturn.forward", tint: .pulpePrimary)
            Text(carryOverSentence)
                .font(PulpeTypography.bodyLarge)
                .foregroundStyle(Color.textPrimary)
                .monospacedDigit()
                .fixedSize(horizontal: false, vertical: true)
                .sensitiveAmount()
        }
        .padding(DesignTokens.Spacing.lg)
        .frame(maxWidth: .infinity, alignment: .leading)
        .pulpeCardBackground(cornerRadius: DesignTokens.CornerRadius.card)
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
        .padding(.horizontal, DesignTokens.Spacing.xl)
        .padding(.vertical, DesignTokens.Spacing.md)
        .background { Color.sheetBackground.ignoresSafeArea(edges: .bottom) }
    }

    private func figureRow(_ title: LocalizedStringKey, kind: TransactionKind, amount: Decimal) -> some View {
        HStack(spacing: DesignTokens.Spacing.md) {
            RowIcon(systemName: kind.icon, tint: kind.color)
            Text(title)
                .font(PulpeTypography.bodyLarge)
                .foregroundStyle(Color.textPrimary)
            Spacer(minLength: DesignTokens.Spacing.sm)
            Text(amount.asCurrency(currency))
                .font(PulpeTypography.amountMedium)
                .foregroundStyle(kind.color)
                .monospacedDigit()
                .sensitiveAmount()
        }
        .padding(.vertical, DesignTokens.Spacing.md)
        .accessibilityElement(children: .combine)
    }

    private var balanceRow: some View {
        let tint: Color = recap.endingBalance >= 0 ? .financialSavings : .financialOverBudget
        return HStack(spacing: DesignTokens.Spacing.md) {
            RowIcon(systemName: "equal", tint: tint)
            Text("Solde final")
                .font(PulpeTypography.cardTitle)
                .foregroundStyle(Color.textPrimary)
            Spacer(minLength: DesignTokens.Spacing.sm)
            Text(recap.endingBalance.asCurrency(currency))
                .font(PulpeTypography.amountCard)
                .foregroundStyle(tint)
                .monospacedDigit()
                .sensitiveAmount()
        }
        .padding(.vertical, DesignTokens.Spacing.md)
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
