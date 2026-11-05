import SwiftUI

/// « Bilan d'octobre » (PUL-111, V2): what the closed month carried over, the summary that adds
/// up to it, and « Ce qui a compté », read from that month's details in one fetch. Read-only:
/// « Voir le budget d'octobre » opens that month, « C'est noté » retires the row. Both only
/// report the choice; the presenter acts on it once the sheet is gone.
struct MonthRecapSheet: View {
    let recap: MonthRecap
    let onShowDetails: @MainActor () -> Void
    let onAcknowledge: @MainActor () -> Void
    /// The closed month's details. A failure only drops « Ce qui a compté ».
    var loadDetails: @Sendable (String) async throws -> BudgetDetails = {
        try await BudgetService.shared.getBudgetWithDetails(id: $0)
    }

    @Environment(UserSettingsStore.self) private var userSettingsStore
    @Environment(\.dismiss) private var dismiss
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var findings: [MonthRecapFindings.Finding] = []

    private var currency: SupportedCurrency { userSettingsStore.currency }
    private var closedName: String { Formatters.monthNameInText(for: recap.month) }

    private var title: String {
        CalculationPresentation.elides(closedName)
            ? AppLocale.string("Bilan d'\(closedName)")
            : AppLocale.string("Bilan de \(closedName)")
    }

    private var showBudgetTitle: String {
        CalculationPresentation.elides(closedName)
            ? AppLocale.string("Voir le budget d'\(closedName)")
            : AppLocale.string("Voir le budget de \(closedName)")
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: DesignTokens.Spacing.lg) {
                    carryOver
                    summaryCard
                    if !findings.isEmpty { findingsSection }
                }
                .padding(.horizontal, DesignTokens.Spacing.xl)
                .padding(.top, DesignTokens.Spacing.sm)
                .padding(.bottom, DesignTokens.Spacing.xl)
                .animation(reduceMotion ? nil : DesignTokens.Animation.smoothEaseOut, value: findings)
            }
            .scrollBounceBehavior(.basedOnSize)
            .background(Color.sheetBackground)
            .safeAreaInset(edge: .bottom, spacing: DesignTokens.Spacing.none) { actions }
            .navigationTitle(title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    SheetCloseButton()
                }
            }
        }
        .standardSheetPresentation()
        .task {
            guard let details = try? await loadDetails(recap.budgetId) else { return }
            findings = MonthRecapFindings.make(
                lines: details.budgetLines,
                transactions: details.transactions,
                month: recap.month,
                currency: currency
            )
        }
    }

    // MARK: - Carry-over

    private var carryOver: some View {
        VStack(spacing: DesignTokens.Spacing.xs) {
            Text(AppLocale.string("\(Formatters.monthName(for: recap.month)) est terminé"))
                .font(PulpeTypography.metricLabel)
                .foregroundStyle(Color.textSecondary)
            (Text(verbatim: recap.carriedOver.asAmount(for: currency))
                .font(PulpeTypography.bigAmount)
                + Text(verbatim: " \(currency.symbol)")
                .font(PulpeTypography.bigCurrencySuffix)
                .foregroundStyle(Color.textSecondary))
                .foregroundStyle(Color.textPrimary)
                .lineLimit(1)
                .minimumScaleFactor(DesignTokens.TextScale.floor)
                .sensitiveAmount()
            Text(AppLocale.string(
                "reportés sur \(Formatters.monthNameInText(for: recap.openedMonth)), déjà comptés dans ton disponible"
            ))
            .font(PulpeTypography.bannerText)
            .foregroundStyle(Color.textSecondary)
        }
        .multilineTextAlignment(.center)
        .fixedSize(horizontal: false, vertical: true)
        .frame(maxWidth: .infinity)
        .accessibilityElement(children: .combine)
    }

    // MARK: - Summary

    /// Revenus + report − dépenses − épargne = solde final, the figure carried over above.
    private var summaryCard: some View {
        FormCard {
            FormulaRow(title: AppLocale.string("Revenus"), amount: recap.income.asFormulaAmount(for: currency))
            FormRowDivider()
            FormulaRow(
                title: CalculationPresentation.reportTitle(of: recap.month == 1 ? 12 : recap.month - 1),
                amount: recap.previousRollover.asFormulaAmount(for: currency)
            )
            FormRowDivider()
            FormulaRow(title: AppLocale.string("Dépenses"), amount: (-recap.spending).asFormulaAmount(for: currency))
            FormRowDivider()
            FormulaRow(
                title: AppLocale.string("Épargne versée"),
                amount: (-recap.savings).asFormulaAmount(for: currency)
            )
            FormRowDivider()
            FormulaRow(
                title: AppLocale.string("Solde final"),
                amount: recap.carriedOver.asAmount(for: currency),
                isTotal: true
            )
        }
        .accessibilityIdentifier("monthRecapSummary")
    }

    // MARK: - Findings

    private var findingsSection: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
            Text("Ce qui a compté")
                .font(PulpeTypography.metricLabel)
                .foregroundStyle(Color.textSecondary)
                .padding(.leading, DesignTokens.Spacing.xs)
                .accessibilityAddTraits(.isHeader)
            VStack(spacing: DesignTokens.Spacing.none) {
                ForEach(Array(findings.enumerated()), id: \.offset) { index, finding in
                    if index > 0 { FormRowDivider() }
                    PulpeListRow(title: finding.title, subtitle: finding.subtitle, showsChevron: false) {
                        if let overrun = finding.overrun {
                            Text(verbatim: overrun.asFormulaAmount(for: currency))
                                .foregroundStyle(Color.financialOverBudget)
                                .sensitiveAmount()
                        }
                    }
                    .sensitiveAmount()
                }
            }
            .padding(.horizontal, DesignTokens.Spacing.lg)
            .pulpeSurfaceCard()
            .accessibilityIdentifier("monthRecapFindings")
        }
        .transition(.opacity)
    }

    // MARK: - Actions

    private var actions: some View {
        VStack(spacing: DesignTokens.Spacing.sm) {
            Button(AppLocale.string("C'est noté")) {
                onAcknowledge()
                dismiss()
            }
            .primaryButtonStyle()
            .accessibilityIdentifier("monthRecapAcknowledgeButton")

            Button(showBudgetTitle) {
                onShowDetails()
                dismiss()
            }
            .tertiaryButtonStyle()
            .accessibilityIdentifier("monthRecapDetailsButton")
        }
        .padding(.horizontal, DesignTokens.Spacing.xl)
        .padding(.vertical, DesignTokens.Spacing.md)
        .background { Color.sheetBackground.ignoresSafeArea(edges: .bottom) }
    }
}

#Preview {
    Color.clear
        .sheet(isPresented: .constant(true)) {
            MonthRecapSheet(
                recap: MonthRecap(
                    budgetId: "preview",
                    month: 10,
                    year: 2026,
                    openedMonth: 11,
                    income: 6_200,
                    expenses: 6_225.50,
                    savings: 1_088,
                    previousRollover: 365.50,
                    endingBalance: -25.50,
                    carriedOver: 340,
                    startingAvailable: 6_540
                ),
                onShowDetails: {},
                onAcknowledge: {},
                loadDetails: { _ in throw URLError(.notConnectedToInternet) }
            )
        }
        .environment(UserSettingsStore())
}
