import Charts
import SwiftUI

/// « Ta trajectoire » (PUL-12+, pilier A) — cumulative savings chart.
///
/// Four cumulative series anchored → target (`docs/SAVINGS_PLAN.md` §2 pilier A):
/// **Pointé** (reality, stops at current month), **Prévu cumulé** (engagement, full
/// span), **Projection** (extrapolation at the confirmed pace, or the edited plan
/// in simulation), and a flat **Cible** rule. Savings green + neutrals only — never
/// amber/red (RG-002). Cloned from `RealizedBalanceSheet.BalanceTrendChart`.
struct GoalProjectionChart: View {
    let series: GoalProjectionSeries
    let currency: SupportedCurrency
    var height: CGFloat = 200

    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    private var yMin: Double { 0 }

    private var yMax: Double {
        let seriesMax = (series.planned + series.confirmed + series.projection)
            .map(\.value)
            .max() ?? 0
        let candidate = max(seriesMax, series.target)
        // Swift Charts crashes on a zero-height domain — guarantee a positive range.
        return candidate <= 0 ? 1 : candidate
    }

    private var yPadding: Double {
        max((yMax - yMin) * 0.08, 1)
    }

    var body: some View {
        Chart {
            RuleMark(y: .value("Cible", series.target))
                .foregroundStyle(Color.textTertiary.opacity(DesignTokens.Opacity.heavy))
                .lineStyle(StrokeStyle(lineWidth: DesignTokens.BorderWidth.thin, dash: [4]))
                .annotation(position: .top, alignment: .leading) {
                    Text("Cible")
                        .font(PulpeTypography.caption2)
                        .foregroundStyle(Color.textTertiary)
                }

            ForEach(series.planned) { point in
                LineMark(
                    x: .value("Mois", point.index),
                    y: .value("Prévu", point.value),
                    series: .value("Série", "planned")
                )
                .interpolationMethod(.monotone)
                .lineStyle(StrokeStyle(lineWidth: DesignTokens.BorderWidth.medium))
                .foregroundStyle(Color.financialSavings.opacity(DesignTokens.Opacity.strong))
            }

            ForEach(series.confirmed) { point in
                AreaMark(
                    x: .value("Mois", point.index),
                    y: .value("Pointé", point.value)
                )
                .interpolationMethod(.monotone)
                .foregroundStyle(areaGradient)

                LineMark(
                    x: .value("Mois", point.index),
                    y: .value("Pointé", point.value),
                    series: .value("Série", "confirmed")
                )
                .interpolationMethod(.monotone)
                .lineStyle(StrokeStyle(lineWidth: DesignTokens.BorderWidth.thick, lineCap: .round))
                .foregroundStyle(Color.financialSavings)
            }

            ForEach(series.projection) { point in
                LineMark(
                    x: .value("Mois", point.index),
                    y: .value("Projection", point.value),
                    series: .value("Série", "projection")
                )
                .interpolationMethod(.monotone)
                .lineStyle(StrokeStyle(lineWidth: DesignTokens.BorderWidth.medium, lineCap: .round, dash: [5, 4]))
                .foregroundStyle(Color.pulpePrimary)
            }
        }
        .chartXAxis {
            AxisMarks(values: series.ticks.map(\.index)) { value in
                if let index = value.as(Int.self), let tick = series.ticks.first(where: { $0.index == index }) {
                    AxisValueLabel {
                        Text(tick.label)
                            .font(PulpeTypography.caption2)
                            .foregroundStyle(Color.textTertiary)
                    }
                }
            }
        }
        .chartYAxis {
            AxisMarks(position: .leading, values: .automatic(desiredCount: 3)) { value in
                AxisGridLine().foregroundStyle(Color.textTertiary.opacity(DesignTokens.Opacity.secondary))
                AxisValueLabel {
                    if let amount = value.as(Double.self) {
                        Text(Self.axisLabel(amount, currency: currency))
                            .font(PulpeTypography.caption2)
                            .foregroundStyle(Color.textSecondary)
                    }
                }
            }
        }
        .chartLegend(.hidden)
        .chartYScale(domain: yMin ... (yMax + yPadding))
        .frame(height: height)
        .animation(reduceMotion ? nil : DesignTokens.Animation.gentleSpring, value: series)
        .sensitiveAmount()
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Trajectoire d'épargne")
    }

    private var areaGradient: LinearGradient {
        LinearGradient(
            stops: [
                .init(color: Color.financialSavings.opacity(DesignTokens.Opacity.secondary), location: 0),
                .init(color: Color.financialSavings.opacity(0), location: 0.9),
            ],
            startPoint: .top,
            endPoint: .bottom
        )
    }

    /// Compact axis label — `1K` / `1.5K` past a thousand, plain int otherwise.
    private static func axisLabel(_ value: Double, currency: SupportedCurrency) -> String {
        let magnitude = abs(value)
        guard magnitude >= 1000 else { return "\(Int(value))" }
        let thousands = magnitude / 1000
        if thousands.truncatingRemainder(dividingBy: 1) == 0 { return "\(Int(thousands))K" }
        let text = thousands.formatted(.number.precision(.fractionLength(1)).locale(Formatters.locale(for: currency)))
        return "\(text)K"
    }
}

// MARK: - Read-mode section

/// « Ta trajectoire » (pilier A) — the read-mode chart section on the goal detail:
/// title, chart, and the two new metrics (écart cumulé + date d'atteinte estimée).
/// Both metrics are neutral information (RG-002): a positive gap is a pointing lag,
/// never an alert.
struct GoalTrajectorySection: View {
    let progress: SavingsGoalProgress
    let currency: SupportedCurrency

    private var series: GoalProjectionSeries { .read(from: progress) }

    var body: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.lg) {
            Text("Ta trajectoire")
                .font(PulpeTypography.headline)
                .foregroundStyle(Color.textPrimary)

            GoalProjectionChart(series: series, currency: currency)

            HStack(alignment: .top, spacing: DesignTokens.Spacing.lg) {
                metric(
                    label: "Écart cumulé",
                    value: progress.cumulativeGap.asArithmeticSignedCompactCurrency(currency),
                    isSensitive: true
                )

                Spacer(minLength: DesignTokens.Spacing.md)

                if let completion = progress.estimatedCompletion {
                    metric(
                        label: "Atteinte estimée",
                        value: periodLabel(completion),
                        isSensitive: false
                    )
                }
            }
        }
        .padding(DesignTokens.Spacing.lg)
        .pulpeCardBackground()
    }

    @ViewBuilder
    private func metric(label: String, value: String, isSensitive: Bool) -> some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.xxs) {
            Text(label)
                .font(PulpeTypography.metricLabel)
                .foregroundStyle(Color.textSecondary)
            Text(value)
                .font(PulpeTypography.metricLabelBold)
                .foregroundStyle(Color.textPrimary)
                .monospacedDigit()
                .modifier(SensitiveIf(isSensitive))
        }
    }

    private func periodLabel(_ period: BudgetPeriod) -> String {
        "\(Formatters.monthName(for: period.month)) \(period.year)"
    }
}

/// Applies `.sensitiveAmount()` only for amount metrics (the ETA period is not).
private struct SensitiveIf: ViewModifier {
    let isSensitive: Bool
    init(_ isSensitive: Bool) { self.isSensitive = isSensitive }

    func body(content: Content) -> some View {
        if isSensitive { content.sensitiveAmount() } else { content }
    }
}

// MARK: - Series model + builders

/// Pre-computed, index-based series for `GoalProjectionChart`. Building lives off
/// the view body so the chart stays a pure renderer (reused read + simulation).
struct GoalProjectionSeries: Equatable {
    struct Point: Identifiable, Equatable {
        let index: Int
        let value: Double
        var id: Int { index }
    }

    struct Tick: Identifiable, Equatable {
        let index: Int
        let label: String
        var id: Int { index }
    }

    let planned: [Point]
    let confirmed: [Point]
    let projection: [Point]
    let target: Double
    let ticks: [Tick]

    var isEmpty: Bool { planned.isEmpty && confirmed.isEmpty && projection.isEmpty }

    /// Read mode: Prévu (full), Pointé (up to current), Projection at the confirmed
    /// pace from the current month onward.
    static func read(from progress: SavingsGoalProgress) -> GoalProjectionSeries {
        let months = progress.months
        guard !months.isEmpty else { return .empty }

        let currentIndex = months.firstIndex { $0.state == .current } ?? months.count - 1
        let target = double(progress.targetAmount)
        let pace = double(progress.confirmedPace)
        let startConfirmed = double(months[currentIndex].confirmedCumulative)

        let planned = months.enumerated().map { Point(index: $0.offset, value: double($0.element.plannedCumulative)) }
        let confirmed = months.prefix(currentIndex + 1).enumerated()
            .map { Point(index: $0.offset, value: double($0.element.confirmedCumulative)) }
        let projection = months.indices[currentIndex...].map { index in
            Point(index: index, value: startConfirmed + pace * Double(index - currentIndex))
        }

        return GoalProjectionSeries(
            planned: planned,
            confirmed: confirmed,
            projection: projection,
            target: target,
            ticks: ticks(for: months, currentIndex: currentIndex)
        )
    }

    /// Simulation mode: Pointé unchanged, Projection follows the edited plan
    /// (`simulatedCumulative`); the Prévu reference is dropped so the deforming
    /// trajectory reads clearly (`docs/SAVINGS_PLAN.md` §2 pilier A, en simulation).
    static func simulation(
        from result: SavingsPlanCalculator.SimulationResult,
        targetAmount: Decimal
    ) -> GoalProjectionSeries {
        let months = result.months
        guard !months.isEmpty else { return .empty }

        let currentIndex = months.firstIndex { $0.month.state == .current } ?? months.count - 1
        let confirmed = months.prefix(currentIndex + 1).enumerated()
            .map { Point(index: $0.offset, value: double($0.element.month.confirmedCumulative)) }
        let projection = months.enumerated()
            .map { Point(index: $0.offset, value: double($0.element.simulatedCumulative)) }

        return GoalProjectionSeries(
            planned: [],
            confirmed: confirmed,
            projection: projection,
            target: double(targetAmount),
            ticks: ticks(for: months.map(\.month), currentIndex: currentIndex)
        )
    }

    static let empty = GoalProjectionSeries(planned: [], confirmed: [], projection: [], target: 0, ticks: [])

    // MARK: - Helpers

    private static func ticks(for months: [SavingsGoalPlanMonth], currentIndex: Int) -> [Tick] {
        let indices = Set([0, currentIndex, months.count - 1]).sorted()
        return indices.compactMap { index in
            guard months.indices.contains(index) else { return nil }
            let month = months[index]
            return Tick(index: index, label: tickLabel(month: month.month, year: month.year))
        }
    }

    private static func tickLabel(month: Int, year: Int) -> String {
        var components = DateComponents()
        components.year = year
        components.month = month
        components.day = 1
        guard let date = Calendar.current.date(from: components) else { return "" }
        return Formatters.shortMonthYear.string(from: date)
    }

    private static func double(_ value: Decimal) -> Double {
        NSDecimalNumber(decimal: value).doubleValue
    }
}
