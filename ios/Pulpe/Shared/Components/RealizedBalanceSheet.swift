import Charts
import SwiftUI

struct RealizedBalanceSheet: View {
    let metrics: BudgetFormulas.Metrics
    let realizedMetrics: BudgetFormulas.RealizedMetrics
    @Environment(DashboardStore.self) private var dashboardStore
    @Environment(UserSettingsStore.self) private var userSettingsStore

    private var isPositiveBalance: Bool {
        realizedMetrics.realizedBalance >= 0
    }

    private var statusColor: Color {
        isPositiveBalance ? .financialSavings : .financialOverBudget
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: DesignTokens.Spacing.xl) {
                    balanceSection
                    completionSection
                    progressSection
                    trendSection
                    tipSection
                }
                .padding(.horizontal)
                .padding(.top, DesignTokens.Spacing.sm)
                .padding(.bottom, DesignTokens.Spacing.xxxl)
            }
            .background(Color.sheetBackground)
            .navigationTitle("Suivi du budget")
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

    // MARK: - Balance Section

    private var balanceSection: some View {
        VStack(spacing: DesignTokens.Spacing.md) {
            Text("Solde à date")
                .font(PulpeTypography.subheadline)
                .foregroundStyle(Color.textSecondary)

            Text(realizedMetrics.realizedBalance.asArithmeticSignedCurrency(userSettingsStore.currency))
                .font(PulpeTypography.amountHero)
                .monospacedDigit()
                .foregroundStyle(isPositiveBalance ? .primary : Color.financialOverBudget)
                .contentTransition(.numericText())
                .sensitiveAmount()

            // Status badge
            HStack(spacing: DesignTokens.Spacing.tightGap) {
                Image(systemName: isPositiveBalance ? "checkmark.circle.fill" : "exclamationmark.triangle.fill")
                    .font(PulpeTypography.caption)
                Text(isPositiveBalance ? "Tout va bien" : "Solde négatif — on y remédie ?")
                    .font(PulpeTypography.inputHelper)
            }
            .foregroundStyle(statusColor)
            .padding(.horizontal, DesignTokens.Spacing.md)
            .padding(.vertical, DesignTokens.Spacing.tightGap)
            .background(statusColor.opacity(DesignTokens.Opacity.badgeBackground))
            .clipShape(Capsule())
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, DesignTokens.Spacing.xxl)
    }

    // MARK: - Completion Section

    private var completionSection: some View {
        VStack(spacing: DesignTokens.Spacing.md) {
            HStack {
                Text("Pointage")
                    .font(PulpeTypography.labelLarge)

                Spacer()

                Text("\(realizedMetrics.checkedItemsCount) / \(realizedMetrics.totalItemsCount)")
                    .font(PulpeTypography.labelLargeBold)
                    .monospacedDigit()
                    .foregroundStyle(statusColor)
            }

            // Segmented progress bar
            CompletionBar(
                checked: realizedMetrics.checkedItemsCount,
                total: realizedMetrics.totalItemsCount,
                color: statusColor
            )
        }
        .padding(DesignTokens.Spacing.lg)
        .pulpeCardBackground()
    }

    // MARK: - Progress Section

    private var progressSection: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.lg) {
            Text("Prévu vs Réalisé")
                .font(PulpeTypography.headline)

            VStack(spacing: 0) {
                CategoryRow(
                    kind: .income,
                    realized: realizedMetrics.realizedIncome,
                    planned: metrics.totalIncome
                )

                Divider()
                    .padding(.leading, DesignTokens.IconSize.listRow + DesignTokens.Spacing.md)

                CategoryRow(
                    kind: .expense,
                    realized: realizedMetrics.realizedExpenses,
                    planned: metrics.totalExpenses - metrics.totalSavings
                )

                Divider()
                    .padding(.leading, DesignTokens.IconSize.listRow + DesignTokens.Spacing.md)

                CategoryRow(
                    kind: .saving,
                    realized: realizedMetrics.checkedSavingsAmount,
                    planned: metrics.totalSavings
                )
            }
            .padding(DesignTokens.Spacing.lg)
            .pulpeCardBackground()
        }
    }

    // MARK: - Trend Section

    @ViewBuilder
    private var trendSection: some View {
        let forecasts = dashboardStore.balanceForecasts
        if forecasts.count >= 2 {
            VStack(alignment: .leading, spacing: DesignTokens.Spacing.lg) {
                Text("Tendance")
                    .font(PulpeTypography.headline)

                VStack(spacing: DesignTokens.Spacing.sm) {
                    // Month labels
                    HStack(spacing: DesignTokens.Spacing.sm) {
                        ForEach(forecasts) { point in
                            Text(point.shortMonthName)
                                .font(PulpeTypography.caption2)
                                .foregroundStyle(point.isCurrentMonth ? .primary : .secondary)
                                .fontWeight(point.isCurrentMonth ? .semibold : .regular)
                                .frame(maxWidth: .infinity)
                        }
                    }

                    BalanceTrendChart(forecasts: forecasts)
                        .clipped()
                }
                .padding(DesignTokens.Spacing.lg)
                .pulpeCardBackground()
                .sensitiveAmount()
            }
            .accessibilityElement(children: .combine)
            .accessibilityLabel("Graphique de tendance du solde")
        } else {
            Text("Crée des budgets futurs pour voir la tendance")
                .font(PulpeTypography.subheadline)
                .foregroundStyle(Color.textSecondary)
                .frame(maxWidth: .infinity, alignment: .leading)
                .pulpeCard()
        }
    }

    // MARK: - Tip Section

    private var tipSection: some View {
        HStack(alignment: .top, spacing: DesignTokens.Spacing.md) {
            Image(systemName: "lightbulb.fill")
                .font(PulpeTypography.metricLabel)
                .foregroundStyle(Color.warningPrimary)
                .frame(width: 28, height: 28)
                .background(Color.warningPrimary.opacity(DesignTokens.Opacity.badgeBackground))
                .clipShape(Circle())

            VStack(alignment: .leading, spacing: DesignTokens.Spacing.xs) {
                Text("Astuce")
                    .font(PulpeTypography.labelLarge)

                Text(
                    "Compare ce solde avec ton compte bancaire. S'il y a un écart, " +
                    "vérifie que toutes tes dépenses sont bien pointées."
                )
                    .font(PulpeTypography.caption)
                    .foregroundStyle(Color.textSecondary)
            }
        }
        .padding(DesignTokens.Spacing.lg)
        .frame(maxWidth: .infinity, alignment: .leading)
        .pulpeCardBackground()
    }
}

// MARK: - Completion Bar (segmented)

private struct CompletionBar: View {
    let checked: Int
    let total: Int
    let color: Color

    private let segmentCount = 10
    private let segmentSpacing: CGFloat = 3
    private let segmentHeight: CGFloat = 8

    private var filledSegments: Int {
        guard total > 0 else { return 0 }
        return Int((Double(checked) / Double(total)) * Double(segmentCount))
    }

    var body: some View {
        HStack(spacing: segmentSpacing) {
            ForEach(0..<segmentCount, id: \.self) { index in
                Capsule()
                    .fill(index < filledSegments ? color : Color.progressTrack)
                    .frame(height: segmentHeight)
            }
        }
        .animation(DesignTokens.Animation.gentleSpring, value: filledSegments)
    }
}

// MARK: - Balance Trend Chart

private struct BalanceTrendChart: View {
    let forecasts: [MonthlyForecast]

    @Environment(UserSettingsStore.self) private var userSettingsStore

    private var yMin: Double { forecasts.map(\.availableBalance).min() ?? 0 }
    private var yMax: Double {
        let max = forecasts.map(\.availableBalance).max() ?? 1
        // Ensure non-zero range — Swift Charts crashes on empty domain
        return max <= yMin ? yMin + 1 : max
    }

    private var yPadding: Double {
        let range = yMax - yMin
        return max(range * 0.08, 1)
    }

    var body: some View {
        Chart {
            RuleMark(y: .value("Zero", 0))
                .foregroundStyle(.secondary.opacity(0.3))
                .lineStyle(StrokeStyle(lineWidth: DesignTokens.BorderWidth.thin, dash: [4]))

            ForEach(forecasts) { point in
                AreaMark(
                    x: .value("Mois", point.shortMonthName),
                    y: .value("Solde", point.availableBalance)
                )
                .interpolationMethod(.monotone)
                .foregroundStyle(areaGradient)

                LineMark(
                    x: .value("Mois", point.shortMonthName),
                    y: .value("Solde", point.availableBalance)
                )
                .interpolationMethod(.monotone)
                .lineStyle(StrokeStyle(lineWidth: DesignTokens.BorderWidth.thick, lineCap: .round))
                .foregroundStyle(Color.pulpePrimary)
                .accessibilityLabel("Mois \(point.shortMonthName)")
                .accessibilityValue(Decimal(point.availableBalance).asCompactCurrency(userSettingsStore.currency))
            }
        }
        .chartXAxis(.hidden)
        .chartYAxis {
            AxisMarks(position: .leading, values: .automatic(desiredCount: 3)) { value in
                AxisGridLine()
                    .foregroundStyle(.secondary.opacity(0.2))
                AxisValueLabel {
                    if let amount = value.as(Double.self) {
                        Text(Self.formatAxisLabel(amount))
                            .font(PulpeTypography.caption2)
                            .foregroundStyle(Color.textSecondary)
                    }
                }
            }
        }
        .chartLegend(.hidden)
        .chartYScale(domain: (yMin - yPadding) ... (yMax + yPadding))
        .frame(height: 150)
    }

    private static func formatAxisLabel(_ value: Double) -> String {
        let abs = abs(value), sign = value < 0 ? "-" : ""
        guard abs >= 1000 else { return "\(Int(value))" }
        let k = abs / 1000
        return k.truncatingRemainder(dividingBy: 1) == 0 ? "\(sign)\(Int(k))K" : String(format: "%@%.1fK", sign, k)
    }

    private var areaGradient: LinearGradient {
        LinearGradient(
            stops: [
                .init(color: Color.pulpePrimary.opacity(0.25), location: 0),
                .init(color: Color.pulpePrimary.opacity(0), location: 0.9),
            ],
            startPoint: .top,
            endPoint: .bottom
        )
    }
}

// MARK: - Category Row

private struct CategoryRow: View {
    let kind: TransactionKind
    let realized: Decimal
    let planned: Decimal

    @Environment(UserSettingsStore.self) private var userSettingsStore

    private var percentage: Double {
        guard planned > 0 else { return 0 }
        return min(Double(truncating: NSDecimalNumber(decimal: realized / planned)), 1.0)
    }

    private var percentageText: String {
        let pct = Int(percentage * 100)
        return "\(min(pct, 999))%"
    }

    var body: some View {
        HStack(spacing: DesignTokens.Spacing.md) {
            // Icon circle (Revolut-style — matches BudgetLineRow, TemplateLineRow)
            Circle()
                .fill(kind.color.opacity(DesignTokens.Opacity.badgeBackground))
                .frame(width: DesignTokens.IconSize.listRow, height: DesignTokens.IconSize.listRow)
                .overlay {
                    Image(systemName: kind.icon)
                        .font(PulpeTypography.listRowTitle)
                        .foregroundStyle(kind.color)
                }

            VStack(alignment: .leading, spacing: DesignTokens.Spacing.xs) {
                // Label + amounts
                HStack(alignment: .firstTextBaseline) {
                    Text(kind.label)
                        .font(PulpeTypography.listRowTitle)

                    Spacer()

                    let realizedFormatted = realized.asCompactCurrency(userSettingsStore.currency)
                    let plannedFormatted = planned.asCompactCurrency(userSettingsStore.currency)
                    Text("\(realizedFormatted) / \(plannedFormatted)")
                        .font(PulpeTypography.caption)
                        .foregroundStyle(Color.textSecondary)
                        .sensitiveAmount()
                }

                // Progress bar + percentage
                HStack(spacing: DesignTokens.Spacing.sm) {
                    ZStack {
                        Capsule()
                            .fill(Color.progressTrack)

                        ProgressBarShape(progress: CGFloat(percentage))
                            .fill(kind.color)
                            .animation(DesignTokens.Animation.gentleSpring, value: percentage)
                    }
                    .frame(height: DesignTokens.ProgressBar.thickHeight)

                    Text(percentageText)
                        .font(PulpeTypography.progressUnit)
                        .foregroundStyle(Color.textTertiary)
                        .monospacedDigit()
                        .frame(minWidth: 28, alignment: .trailing)
                }
            }
        }
        .padding(.vertical, DesignTokens.Spacing.md)
    }
}

// MARK: - Preview Helpers

@MainActor private let previewDashboardStore: DashboardStore = {
    let calendar = Calendar.current
    let currentMonth = calendar.component(.month, from: Date())
    let currentYear = calendar.component(.year, from: Date())

    let remainingValues: [Decimal] = [1274, 2583, 2583, 4419, 2583, 2583, -777, 532, 532, 3398]
    let budgets = (0..<min(10, 13 - currentMonth)).map { offset -> BudgetSparse in
        let month = currentMonth + offset
        return BudgetSparse(
            id: "preview-\(month)",
            month: month,
            year: currentYear,
            remaining: remainingValues[offset]
        )
    }
    return DashboardStore(initialBudgets: budgets)
}()

// MARK: - Previews

#Preview("Positive Balance") {
    Color.clear
        .sheet(isPresented: .constant(true)) {
            RealizedBalanceSheet(
                metrics: .init(
                    totalIncome: 7956,
                    totalExpenses: 4861.30,
                    totalSavings: 500,
                    available: 7956,
                    endingBalance: 3094.70,
                    remaining: 3094.70,
                    rollover: 0
                ),
                realizedMetrics: .init(
                    realizedIncome: 7956,
                    realizedExpenses: 2500,
                    realizedBalance: 5456,
                    checkedItemsCount: 12,
                    totalItemsCount: 25,
                    checkedSavingsAmount: 250
                )
            )
            .environment(previewDashboardStore)
            .environment(UserSettingsStore())
        }
}

#Preview("Negative Balance") {
    Color.clear
        .sheet(isPresented: .constant(true)) {
            RealizedBalanceSheet(
                metrics: .init(
                    totalIncome: 5000,
                    totalExpenses: 5500,
                    totalSavings: 200,
                    available: 5000,
                    endingBalance: -500,
                    remaining: -500,
                    rollover: 0
                ),
                realizedMetrics: .init(
                    realizedIncome: 5000,
                    realizedExpenses: 5200,
                    realizedBalance: -200,
                    checkedItemsCount: 18,
                    totalItemsCount: 20,
                    checkedSavingsAmount: 200
                )
            )
            .environment(previewDashboardStore)
            .environment(UserSettingsStore())
        }
}

#Preview("All Checked") {
    Color.clear
        .sheet(isPresented: .constant(true)) {
            RealizedBalanceSheet(
                metrics: .init(
                    totalIncome: 6000,
                    totalExpenses: 4000,
                    totalSavings: 800,
                    available: 6000,
                    endingBalance: 2000,
                    remaining: 2000,
                    rollover: 0
                ),
                realizedMetrics: .init(
                    realizedIncome: 6000,
                    realizedExpenses: 4000,
                    realizedBalance: 2000,
                    checkedItemsCount: 15,
                    totalItemsCount: 15,
                    checkedSavingsAmount: 800
                )
            )
            .environment(previewDashboardStore)
            .environment(UserSettingsStore())
        }
}
