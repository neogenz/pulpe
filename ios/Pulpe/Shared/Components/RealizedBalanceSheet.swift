import SwiftUI

struct RealizedBalanceSheet: View {
    let metrics: BudgetFormulas.Metrics
    let realizedMetrics: BudgetFormulas.RealizedMetrics
    /// The month this sheet reads; the current period when nil.
    var period: BudgetPeriod?
    /// "Rapprocher mes comptes", right under the balance it checks against the bank.
    var onReconcile: (() -> Void)?
    @Environment(DashboardStore.self) private var dashboardStore
    @Environment(UserSettingsStore.self) private var userSettingsStore

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: DesignTokens.Spacing.xxl) {
                    VStack(spacing: DesignTokens.Spacing.md) {
                        CheckedBalanceCard(
                            metrics: metrics,
                            realizedMetrics: realizedMetrics,
                            currency: userSettingsStore.currency
                        )
                        if let onReconcile {
                            Button(action: onReconcile) {
                                Label("Rapprocher mes comptes", systemImage: "building.columns")
                            }
                            .secondaryButtonStyle()
                            .accessibilityIdentifier("reconcileAccountsButton")
                        }
                    }
                    plannedSection
                    if let forecastStart {
                        ForecastSection(
                            forecasts: dashboardStore.balanceForecasts(from: forecastStart),
                            currency: userSettingsStore.currency
                        )
                    }
                }
                .padding(.horizontal)
                .padding(.top, DesignTokens.Spacing.sm)
                .padding(.bottom, DesignTokens.Spacing.xxxl)
            }
            .background(Color.sheetBackground)
            .localizedNavigationTitle("Suivi du budget")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    SheetCloseButton()
                }
            }
        }
        .standardSheetPresentation(detents: [.medium, .large])
        .task {
            dashboardStore.setPayDay(userSettingsStore.payDayOfMonth)
            await dashboardStore.loadIfNeeded()
        }
    }

    /// "Les prochains mois" start at the month read here. A past month has none ahead.
    private var forecastStart: BudgetPeriod? {
        let current = BudgetPeriodCalculator.periodForDate(Date(), payDayOfMonth: userSettingsStore.payDayOfMonth)
        guard let period else { return current }
        return BudgetPeriodCalculator.comparePeriods(period, current) < 0 ? nil : period
    }

    // MARK: - Planned vs Real

    private var plannedSection: some View {
        let currency = userSettingsStore.currency
        return VStack(alignment: .leading, spacing: DesignTokens.Spacing.md) {
            SectionHeader(title: AppLocale.string("Prévu et réel"))

            KindTile(kind: .expense, title: "Dépenses") {
                let spent = realizedMetrics.realizedSpending
                let planned = metrics.totalExpenses - metrics.totalSavings
                HStack(alignment: .firstTextBaseline, spacing: DesignTokens.Spacing.sm) {
                    tileAmount(spent, kind: .expense, font: PulpeTypography.amountDisplayLarge)
                    Spacer(minLength: DesignTokens.Spacing.sm)
                    Text("sur \(planned.asAdaptiveCurrency(currency)) prévus")
                        .font(PulpeTypography.caption)
                        .foregroundStyle(Color.textSecondary)
                        .sensitiveAmount()
                }
                PlanBar(
                    actual: spent,
                    planned: planned,
                    tint: .financialExpense,
                    track: Color.financialExpense.opacity(DesignTokens.Opacity.secondary),
                    height: DesignTokens.ProgressBar.flowBarHeight,
                    showsOverrun: true
                )
                Group {
                    if spent > planned {
                        Text("+\((spent - planned).asAdaptiveCurrency(currency)) au-delà du prévu")
                            .fontWeight(.semibold)
                            .foregroundStyle(Color.financialOverBudget)
                    } else {
                        Text("Encore \((planned - spent).asAdaptiveCurrency(currency)) de marge")
                            .foregroundStyle(Color.textSecondary)
                    }
                }
                .font(PulpeTypography.caption)
                .sensitiveAmount()
            }

            HeroMetricTileRow {
                KindTile(kind: .income, title: "Revenus") {
                    let pending = metrics.totalIncome - realizedMetrics.realizedIncome
                    tileAmount(realizedMetrics.realizedIncome, kind: .income, font: PulpeTypography.amountCard)
                    Label {
                        if pending > 0 {
                            Text("\(pending.asAdaptiveCurrency(currency)) encore attendus")
                        } else {
                            Text("Tout est arrivé")
                        }
                    } icon: {
                        Image(systemName: pending > 0 ? "clock" : "checkmark")
                    }
                    .font(PulpeTypography.caption)
                    .foregroundStyle(Color.textSecondary)
                    .sensitiveAmount()
                }

                KindTile(kind: .saving, title: "Épargne") {
                    tileAmount(realizedMetrics.checkedSavingsAmount, kind: .saving, font: PulpeTypography.amountCard)
                    PlanBar(
                        actual: realizedMetrics.checkedSavingsAmount,
                        planned: metrics.totalSavings,
                        tint: .financialSavings,
                        track: .surfaceContainerLowest,
                        height: DesignTokens.ProgressBar.height,
                        showsOverrun: false
                    )
                    Text("sur \(metrics.totalSavings.asAdaptiveCurrency(currency)) prévus")
                        .font(PulpeTypography.caption)
                        .foregroundStyle(Color.textSecondary)
                        .sensitiveAmount()
                }
            }
            .fixedSize(horizontal: false, vertical: true)
        }
    }

    private func tileAmount(_ amount: Decimal, kind: TransactionKind, font: Font) -> some View {
        Text(amount.asAdaptiveCurrency(userSettingsStore.currency))
            .font(font)
            .foregroundStyle(kind.color)
            .monospacedDigit()
            .lineLimit(1)
            .minimumScaleFactor(DesignTokens.TextScale.floor)
            .contentTransition(.numericText())
            .sensitiveAmount()
    }
}

// MARK: - Checked Balance Card

/// The pointed balance on the forest, and how much of the month is pointed: one dot per item.
private struct CheckedBalanceCard: View {
    let metrics: BudgetFormulas.Metrics
    let realizedMetrics: BudgetFormulas.RealizedMetrics
    let currency: SupportedCurrency

    private var checked: Int { realizedMetrics.checkedItemsCount }
    private var total: Int { realizedMetrics.totalItemsCount }

    var body: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.md) {
            HeroFigure(
                eyebrow: AppLocale.string("Solde pointé"),
                amount: realizedMetrics.realizedBalance,
                currency: currency,
                alignment: .leading
            )

            sentence
                .font(PulpeTypography.subheadline)
                .foregroundStyle(Color.heroInkSecondary)
                .fixedSize(horizontal: false, vertical: true)

            if total > 0 {
                checkProgress
                    .padding(.top, DesignTokens.Spacing.xs)
                    .accessibilityHidden(true)
                HStack {
                    Text(AppLocale.attributed("**\(checked)** pointées"))
                    Spacer(minLength: DesignTokens.Spacing.sm)
                    Text("**\(total - checked)** à pointer")
                }
                .font(PulpeTypography.labelMedium)
                .foregroundStyle(Color.heroInkSecondary)
                .monospacedDigit()
            }

            if let bridge {
                bridge
                    .font(PulpeTypography.footnote)
                    .foregroundStyle(Color.heroInkSecondary)
                    .monospacedDigit()
                    .fixedSize(horizontal: false, vertical: true)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.top, DesignTokens.Spacing.md)
                    .overlay(alignment: .top) {
                        Rectangle()
                            .fill(Color.heroInkSecondary.opacity(DesignTokens.Opacity.heroInkMuted))
                            .frame(height: DesignTokens.BorderWidth.thin)
                    }
                    .sensitiveAmount()
            }
        }
        .padding(DesignTokens.Spacing.xl)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            LinearGradient(colors: [.heroSurfaceTop, .heroSurface], startPoint: .top, endPoint: .bottom),
            in: RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.xl)
        )
        .accessibilityElement(children: .combine)
    }

    /// The state lives in the sentence, never in the surface (The Two-Zone Rule).
    private var sentence: Text {
        let promise = Text("Une fois tout pointé, ta banque devrait afficher la même chose.")
        guard realizedMetrics.realizedBalance < 0 else { return promise }
        return Text("Sous zéro pour l'instant.").bold().foregroundStyle(Color.heroAccentCaution)
            + Text(verbatim: " ") + promise
    }

    /// From the pointed balance to the "Disponible à dépenser" budget details shows: plus what
    /// is still to come in, minus what is still to go out. The outflow is the rest of the gap,
    /// so the line always adds up to that figure. It is never negative: the rollover cancels
    /// out, leaving totalExpenses − realizedExpenses (plus any income beyond plan), and a
    /// pointed envelope never exceeds its envelope.
    private var bridge: Text? {
        let incoming = max(metrics.totalIncome - realizedMetrics.realizedIncome, 0)
        let outgoing = realizedMetrics.realizedBalance + incoming - metrics.remaining
        guard incoming > 0 || outgoing > 0 else { return nil }
        var line = Text("\(figure(realizedMetrics.realizedBalance)) pointé")
        if incoming > 0 {
            line = line + Text(verbatim: " + ") + Text("\(figure(incoming)) à recevoir")
        }
        if outgoing > 0 {
            line = line + Text(verbatim: " − ") + Text("\(figure(outgoing)) à venir")
        }
        let result = metrics.remaining < 0
            ? Text("\(figure(-metrics.remaining)) de déficit")
            : Text("\(figure(metrics.remaining)) disponible à dépenser")
        return line + Text(verbatim: " = ") + result
    }

    /// Centimes always: rounded terms would stop adding up.
    private func figure(_ amount: Decimal) -> Text {
        Text(amount.asAmount(for: currency)).bold().foregroundStyle(Color.heroInk)
    }

    @ViewBuilder
    private var checkProgress: some View {
        if total > DesignTokens.Chart.checkDotLimit {
            HeroProgressRow(
                progress: Double(checked) / Double(total),
                valueText: (Double(checked) / Double(total)).formatted(.percent.precision(.fractionLength(0)))
            )
        } else {
            LazyVGrid(
                columns: Array(
                    repeating: GridItem(.flexible(), spacing: DesignTokens.Spacing.xs),
                    count: DesignTokens.Chart.checkDotColumns
                ),
                alignment: .leading,
                spacing: DesignTokens.Spacing.xs
            ) {
                ForEach(0..<total, id: \.self) { index in
                    Circle()
                        .fill(index < checked ? Color.heroAccentPositive : .clear)
                        .overlay {
                            if index >= checked {
                                Circle().strokeBorder(
                                    Color.heroInkSecondary.opacity(DesignTokens.Opacity.heroInkMuted),
                                    lineWidth: DesignTokens.BorderWidth.medium
                                )
                            }
                        }
                        .aspectRatio(1, contentMode: .fit)
                }
            }
            .animation(DesignTokens.Animation.gentleSpring, value: checked)
        }
    }
}

// MARK: - Kind Tile

private struct KindTile<Content: View>: View {
    let kind: TransactionKind
    let title: LocalizedStringKey
    @ViewBuilder let content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
            HStack(spacing: DesignTokens.Spacing.compactGap) {
                Image(systemName: kind.icon)
                    .font(PulpeTypography.metricLabelBold)
                    .foregroundStyle(kind.color)
                    .frame(width: DesignTokens.IconSize.compact, height: DesignTokens.IconSize.compact)
                    .background(Color.surfaceContainerLowest, in: Circle())
                    .accessibilityHidden(true)
                Text(title)
                    .font(PulpeTypography.labelLarge)
            }
            content
        }
        .padding(DesignTokens.Spacing.lg)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .background(
            kind.color.opacity(DesignTokens.Opacity.badgeBackground),
            in: RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.md)
        )
        .accessibilityElement(children: .combine)
    }
}

// MARK: - Plan Bar

/// Real against plan. Past the plan, `showsOverrun` turns the bar into the whole real amount:
/// the plan's share in the tint, the excess in `financialOverBudget`. Without it the bar stops full.
private struct PlanBar: View {
    let actual: Decimal
    let planned: Decimal
    let tint: Color
    let track: Color
    let height: CGFloat
    let showsOverrun: Bool

    private var isOverrun: Bool { showsOverrun && actual > planned }

    private var fill: CGFloat {
        let share = isOverrun ? planned / actual : planned > 0 ? actual / planned : 0
        return CGFloat(min(max(NSDecimalNumber(decimal: share).doubleValue, 0), 1))
    }

    var body: some View {
        ZStack {
            Rectangle()
                .fill(isOverrun ? Color.financialOverBudget : track)
                .clipShape(.rect(cornerRadius: height / 2))
            ProgressBarShape(progress: fill)
                .fill(tint)
        }
        .frame(height: height)
        // The two ambers sit too close in dark mode to tell plan from excess: the tick does.
        .overlay(alignment: .leading) {
            if isOverrun {
                GeometryReader { geometry in
                    Rectangle()
                        .fill(Color.textPrimary)
                        .frame(width: DesignTokens.BorderWidth.thick)
                        .offset(x: geometry.size.width * fill - DesignTokens.BorderWidth.thick / 2)
                }
            }
        }
        .animation(DesignTokens.Animation.gentleSpring, value: fill)
        .accessibilityHidden(true)
    }
}

// MARK: - Previews

@MainActor private func previewSheet(
    _ metrics: BudgetFormulas.Metrics,
    _ realized: BudgetFormulas.RealizedMetrics,
    forecasts: [Decimal]
) -> some View {
    let calendar = Calendar.current
    let budgets = forecasts.enumerated().compactMap { offset, remaining -> BudgetSparse? in
        guard let date = calendar.date(byAdding: .month, value: offset, to: Date()) else { return nil }
        let month = calendar.component(.month, from: date)
        let year = calendar.component(.year, from: date)
        return BudgetSparse(id: "preview-\(year)-\(month)", month: month, year: year, remaining: remaining)
    }
    return Color.clear
        .sheet(isPresented: .constant(true)) {
            RealizedBalanceSheet(metrics: metrics, realizedMetrics: realized)
                .environment(DashboardStore(initialBudgets: budgets))
                .environment(UserSettingsStore())
        }
}

#Preview("Positive Balance") {
    previewSheet(
        .init(totalIncome: 7956, totalExpenses: 4861.30, totalSavings: 500, available: 7956,
              endingBalance: 3094.70, remaining: 3094.70, rollover: 0),
        .init(realizedIncome: 7956, realizedExpenses: 2500, realizedBalance: 5456,
              checkedItemsCount: 12, totalItemsCount: 25, checkedSavingsAmount: 250),
        forecasts: [1180, 640, 1420, 1960, 2310, 2720]
    )
}

#Preview("Negative Balance") {
    previewSheet(
        .init(totalIncome: 5000, totalExpenses: 5500, totalSavings: 200, available: 5000,
              endingBalance: -500, remaining: -500, rollover: 0),
        .init(realizedIncome: 5000, realizedExpenses: 5600, realizedBalance: -600,
              checkedItemsCount: 18, totalItemsCount: 20, checkedSavingsAmount: 200),
        forecasts: [-200, -650, 120, 480, 900, 1300]
    )
}

#Preview("All Checked") {
    previewSheet(
        .init(totalIncome: 6000, totalExpenses: 4000, totalSavings: 800, available: 6000,
              endingBalance: 2000, remaining: 2000, rollover: 0),
        .init(realizedIncome: 6000, realizedExpenses: 4000, realizedBalance: 2000,
              checkedItemsCount: 15, totalItemsCount: 15, checkedSavingsAmount: 800),
        forecasts: [2000]
    )
}
