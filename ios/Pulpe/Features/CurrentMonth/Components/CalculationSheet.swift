import SwiftUI

/// « Le calcul » (V2), opened from the Accueil's hero: the disponible, the formula that makes
/// it, its gap to the plan explained, and the pointed balance that leads to « Comparer avec
/// mes comptes ». The Budgets tab keeps `RealizedBalanceSheet`.
struct CalculationSheet: View {
    @Environment(CurrentMonthStore.self) private var store
    @Environment(UserSettingsStore.self) private var userSettingsStore
    @Environment(\.amountsHidden) private var amountsHidden
    @State private var isReconciling = false

    private var currency: SupportedCurrency { userSettingsStore.currency }

    private var monthName: String {
        store.budget.map { Formatters.monthNameInText(for: $0.month) } ?? ""
    }

    private var previousMonth: Int {
        guard let month = store.budget?.month else { return 0 }
        return month == 1 ? 12 : month - 1
    }

    /// The hero's own reading of the plan, so the two screens quote one number.
    private var plannedBalance: Decimal {
        store.balanceTrajectory?.plannedBalance ?? store.plannedRemaining
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: DesignTokens.Spacing.lg) {
                    figure
                    formulaCard
                    planSection
                }
                .padding(.horizontal, DesignTokens.Spacing.xl)
                .padding(.top, DesignTokens.Spacing.sm)
                .padding(.bottom, DesignTokens.Spacing.xl)
            }
            .scrollBounceBehavior(.basedOnSize)
            .background(Color.sheetBackground)
            .safeAreaInset(edge: .bottom, spacing: DesignTokens.Spacing.none) { footer }
            .navigationTitle(AppLocale.string("Le calcul"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    SheetCloseButton()
                }
            }
        }
        .standardSheetPresentation()
        .sheet(isPresented: $isReconciling) { CurrentMonthReconcileSheet() }
        .trackScreen("Calculation")
    }

    // MARK: - Figure

    private var figure: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.xs) {
            Text("Disponible à dépenser en \(monthName)")
                .font(PulpeTypography.metricLabel)
                .foregroundStyle(Color.textSecondary)
            (Text(verbatim: store.metrics.remaining.asAmount(for: currency))
                .font(PulpeTypography.bigAmount)
                + Text(verbatim: " \(currency.symbol)")
                .font(PulpeTypography.bigCurrencySuffix)
                .foregroundStyle(Color.textSecondary))
                .foregroundStyle(Color.textPrimary)
                .lineLimit(1)
                .minimumScaleFactor(DesignTokens.TextScale.floor)
                .contentTransition(.numericText())
                .sensitiveAmount()
                .accessibilityIdentifier("calculationAvailable")
        }
        .accessibilityElement(children: .combine)
    }

    // MARK: - Formula

    private var formulaCard: some View {
        let rows = CalculationPresentation.rows(
            budgetLines: store.budgetLines,
            transactions: store.transactions,
            rollover: store.metrics.rollover,
            previousMonth: previousMonth
        )
        return FormCard {
            ForEach(Array(rows.enumerated()), id: \.offset) { _, row in
                FormulaRow(title: row.title, caption: row.caption, amount: row.amount.asFormulaAmount(for: currency))
                FormRowDivider()
            }
            FormulaRow(
                title: AppLocale.string("Disponible à dépenser"),
                amount: store.metrics.remaining.asAmount(for: currency),
                isTotal: true
            )
        }
        .accessibilityIdentifier("calculationFormula")
    }

    // MARK: - Plan

    private var planSection: some View {
        let gap = HeroVerdictPresentation(
            plannedBalance: plannedBalance,
            estimatedBalance: store.metrics.remaining
        ).variance
        return VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
            Text("Par rapport à ton plan")
                .font(PulpeTypography.metricLabel)
                .foregroundStyle(Color.textSecondary)
                .padding(.leading, DesignTokens.Spacing.xs)
                .accessibilityAddTraits(.isHeader)
            FormCard {
                FormulaRow(
                    title: AppLocale.string("Écart au plan"),
                    caption: AppLocale.string("Prévu au départ : \(plannedBalance.asAmount(for: currency))"),
                    amount: gap.asFormulaAmount(for: currency),
                    tint: gap < 0 ? .financialOverBudget : gap > 0 ? .pulpePrimary : .textPrimary
                )
            }
            if let explanation = gapExplanation(gap: gap) {
                Text(explanation)
                    .font(PulpeTypography.captionRegular)
                    .foregroundStyle(Color.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(.leading, DesignTokens.Spacing.xs)
                    .sensitiveAmount()
                    .accessibilityIdentifier("calculationGapExplanation")
            }
        }
    }

    /// The overruns and the movements no prévision covers when the month is behind its plan,
    /// then where its pace lands.
    private func gapExplanation(gap: Decimal) -> String? {
        let causes = gap < 0
            ? CalculationPresentation.gapCauses(
                overruns: store.driftLines.map { ($0.line.name, -$0.consumption.available) },
                unplannedOutflows: store.transactions.filter { $0.isFree && $0.kind == .expense },
                currency: currency
            )
            : nil
        let rhythm = store.balanceTrajectory.flatMap {
            HomeHeroCard.rhythmSentence(for: $0, currency: currency, amountsHidden: amountsHidden)
        }
        let parts = [causes, rhythm].compactMap { $0 }
        return parts.isEmpty ? nil : parts.joined(separator: " ")
    }

    // MARK: - Footer

    private var footer: some View {
        VStack(spacing: DesignTokens.Spacing.sm) {
            let balance = Text(verbatim: store.realizedMetrics.realizedBalance.asAmount(for: currency))
                .fontWeight(.bold)
                .foregroundStyle(Color.textPrimary)
            Text("Ton solde pointé : \(balance), ce que donnent tes mouvements pointés.")
                .font(PulpeTypography.captionRegular)
                .foregroundStyle(Color.textSecondary)
                .multilineTextAlignment(.center)
                .fixedSize(horizontal: false, vertical: true)
                .sensitiveAmount()
            if store.budget != nil {
                Button(AppLocale.string("Comparer avec mes comptes")) { isReconciling = true }
                    .secondaryButtonStyle()
                    .accessibilityIdentifier("reconcileAccountsButton")
            }
        }
        .padding(.horizontal, DesignTokens.Spacing.xl)
        .padding(.vertical, DesignTokens.Spacing.md)
        .background(Color.sheetBackground)
    }
}
