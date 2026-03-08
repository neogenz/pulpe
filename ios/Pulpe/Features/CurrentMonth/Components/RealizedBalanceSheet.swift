import Charts
import SwiftUI

struct RealizedBalanceSheet: View {
    let metrics: BudgetFormulas.Metrics
    let realizedMetrics: BudgetFormulas.RealizedMetrics
    @Environment(DashboardStore.self) private var dashboardStore

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
        .task { await dashboardStore.loadIfNeeded() }
    }

    // MARK: - Balance Section

    private var balanceSection: some View {
        VStack(spacing: DesignTokens.Spacing.md) {
            Text("Solde à date")
                .font(PulpeTypography.subheadline)
                .foregroundStyle(.secondary)

            Text(realizedMetrics.realizedBalance.asCHF)
                .font(PulpeTypography.amountHero)
                .monospacedDigit()
                .foregroundStyle(isPositiveBalance ? .primary : Color.financialOverBudget)
                .contentTransition(.numericText())
                .sensitiveAmount()

            // Status badge
            HStack(spacing: 6) {
                Image(systemName: isPositiveBalance ? "checkmark.circle.fill" : "exclamationmark.triangle.fill")
                    .font(PulpeTypography.caption)
                Text(isPositiveBalance ? "Tout va bien" : "Solde négatif — on y remédie ?")
                    .font(PulpeTypography.inputHelper)
            }
            .foregroundStyle(statusColor)
            .padding(.horizontal, DesignTokens.Spacing.md)
            .padding(.vertical, 6)
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
                    label: "Revenus",
                    icon: "arrow.down.circle.fill",
                    iconColor: .financialIncome,
                    realized: realizedMetrics.realizedIncome,
                    planned: metrics.totalIncome
                )

                Divider()
                    .padding(.leading, DesignTokens.IconSize.badge + DesignTokens.Spacing.md)

                CategoryRow(
                    label: "Dépenses",
                    icon: "arrow.up.circle.fill",
                    iconColor: .financialExpense,
                    realized: realizedMetrics.realizedExpenses,
                    planned: metrics.totalExpenses - metrics.totalSavings
                )

                Divider()
                    .padding(.leading, DesignTokens.IconSize.badge + DesignTokens.Spacing.md)

                CategoryRow(
                    label: "Épargne",
                    icon: TransactionKind.savingsIcon,
                    iconColor: .financialSavings,
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
                .foregroundStyle(.secondary)
                .frame(maxWidth: .infinity, alignment: .leading)
                .pulpeCard()
        }
    }

    // MARK: - Tip Section

    private var tipSection: some View {
        HStack(alignment: .top, spacing: DesignTokens.Spacing.md) {
            Image(systemName: "lightbulb.fill")
                .font(.system(size: 14))
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
                    .foregroundStyle(.secondary)
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
                .lineStyle(StrokeStyle(lineWidth: 1, dash: [4]))

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
                .lineStyle(StrokeStyle(lineWidth: 2, lineCap: .round))
                .foregroundStyle(Color.pulpePrimary)
                .accessibilityLabel("Mois \(point.shortMonthName)")
                .accessibilityValue(Formatters.chfCompact.string(from: point.availableBalance as NSNumber) ?? "")
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
                            .foregroundStyle(.secondary)
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
    let label: String
    let icon: String
    let iconColor: Color
    let realized: Decimal
    let planned: Decimal

    @State private var barWidth: CGFloat = 0

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
            // Icon badge
            Image(systemName: icon)
                .font(.system(size: 16))
                .foregroundStyle(.white)
                .frame(width: DesignTokens.IconSize.badge, height: DesignTokens.IconSize.badge)
                .background(iconColor)
                .clipShape(.rect(cornerRadius: DesignTokens.CornerRadius.sm + 2))

            VStack(alignment: .leading, spacing: DesignTokens.Spacing.xs) {
                // Label + amounts
                HStack(alignment: .firstTextBaseline) {
                    Text(label)
                        .font(PulpeTypography.buttonSecondary)

                    Spacer()

                    Text("\(realized.asCompactCHF) / \(planned.asCompactCHF)")
                        .font(PulpeTypography.caption)
                        .foregroundStyle(.secondary)
                        .sensitiveAmount()
                }

                // Progress bar + percentage
                HStack(spacing: DesignTokens.Spacing.sm) {
                    ZStack(alignment: .leading) {
                        Capsule()
                            .fill(Color.progressTrack)

                        Capsule()
                            .fill(iconColor)
                            .frame(width: barWidth * CGFloat(percentage))
                            .animation(.spring(duration: DesignTokens.Animation.slow), value: percentage)
                    }
                    .frame(height: DesignTokens.ProgressBar.thickHeight)
                    .onGeometryChange(for: CGFloat.self) { $0.size.width } action: { barWidth = $0 }

                    Text(percentageText)
                        .font(PulpeTypography.progressUnit)
                        .foregroundStyle(Color.pulpeTextTertiary)
                        .monospacedDigit()
                        .frame(minWidth: 28, alignment: .trailing)
                }
            }
        }
        .padding(.vertical, DesignTokens.Spacing.md)
    }
}

// MARK: - Preview Helpers

private let previewDashboardStore: DashboardStore = {
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
        }
}
