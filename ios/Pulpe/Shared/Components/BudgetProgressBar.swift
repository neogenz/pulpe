import SwiftUI

/// Progress bar showing budget usage with expenses vs available layout
struct BudgetProgressBar: View {
    let metrics: BudgetFormulas.Metrics
    let showLabels: Bool

    init(metrics: BudgetFormulas.Metrics, showLabels: Bool = true) {
        self.metrics = metrics
        self.showLabels = showLabels
    }

    // MARK: - Computed Properties

    private var isOverBudget: Bool {
        metrics.remaining < 0
    }

    private var overBudgetAmount: Decimal {
        abs(metrics.remaining)
    }

    /// Visual progress capped at 100% for the bar
    private var visualProgress: Double {
        guard metrics.available > 0 else { return 1 }
        let ratio = Double(truncating: (metrics.totalExpenses / metrics.available) as NSDecimalNumber)
        return min(max(ratio, 0), 1)
    }

    /// Actual percentage for display (can exceed 100%)
    private var displayPercentage: Int {
        guard metrics.available > 0 else { return 100 }
        let ratio = Double(truncating: (metrics.totalExpenses / metrics.available) as NSDecimalNumber)
        return Int(ratio * 100)
    }

    private var progressColor: Color {
        isOverBudget ? .red : .pulpePrimary
    }

    // MARK: - Body

    var body: some View {
        VStack(spacing: 12) {
            if showLabels {
                headerSection
            }

            progressBar

            if showLabels {
                footerSection
            }
        }
    }

    // MARK: - Header Section

    private var headerSection: some View {
        HStack(alignment: .top) {
            // Left: Expenses (Primary)
            expensesColumn

            Spacer()

            // Right: Available (Secondary)
            availableColumn
        }
    }

    private var expensesColumn: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(spacing: 6) {
                Text("Dépenses CHF")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)

                if isOverBudget {
                    Image(systemName: "exclamationmark.triangle.fill")
                        .font(.subheadline)
                        .foregroundStyle(.red)
                }
            }

            Text(metrics.totalExpenses.formatted(.currency(code: "CHF")))
                .font(.title2)
                .fontWeight(.semibold)
                .foregroundStyle(isOverBudget ? .red : .primary)
        }
    }

    private var availableColumn: some View {
        VStack(alignment: .trailing, spacing: 4) {
            Text("Disponible CHF")
                .font(.subheadline)
                .foregroundStyle(.secondary)

            Text(metrics.remaining.formatted(.currency(code: "CHF")))
                .font(.title2)
                .fontWeight(.semibold)
                .foregroundStyle(.secondary)
        }
    }

    // MARK: - Progress Bar

    private var progressBar: some View {
        GeometryReader { geometry in
            ZStack(alignment: .leading) {
                RoundedRectangle(cornerRadius: 5)
                    .fill(Color.progressTrack)

                RoundedRectangle(cornerRadius: 5)
                    .fill(progressColor)
                    .frame(width: geometry.size.width * CGFloat(visualProgress))
            }
        }
        .frame(height: 10)
    }

    // MARK: - Footer Section

    private var footerSection: some View {
        HStack {
            if isOverBudget {
                Text("Dépassement de \(overBudgetAmount.formatted(.currency(code: "CHF")))")
                    .font(.caption)
                    .foregroundStyle(.red)
            } else {
                Text("\(displayPercentage)% du budget dépensé")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            Spacer()

            Text("Limite: \(metrics.available.formatted(.currency(code: "CHF")))")
                .font(.caption)
                .foregroundStyle(.secondary)
        }
    }
}

/// Compact circular progress indicator
struct CircularProgressView: View {
    let progress: Double
    let lineWidth: CGFloat

    init(progress: Double, lineWidth: CGFloat = 4) {
        self.progress = progress
        self.lineWidth = lineWidth
    }

    private var progressColor: Color {
        if progress > 1 { return .red }
        return .pulpePrimary
    }

    var body: some View {
        ZStack {
            Circle()
                .stroke(Color.progressTrack, lineWidth: lineWidth)

            Circle()
                .trim(from: 0, to: min(CGFloat(progress), 1))
                .stroke(progressColor, style: StrokeStyle(lineWidth: lineWidth, lineCap: .round))
                .rotationEffect(.degrees(-90))
        }
    }
}

#Preview("Budget Progress States") {
    ScrollView {
        VStack(spacing: 24) {
            // Normal state (~36%)
            BudgetProgressBar(metrics: .init(
                totalIncome: 5000,
                totalExpenses: 2000,
                totalSavings: 500,
                available: 5500,
                endingBalance: 3500,
                remaining: 3500,
                rollover: 500
            ))
            .cardStyle()

            // High usage (~90%)
            BudgetProgressBar(metrics: .init(
                totalIncome: 5000,
                totalExpenses: 4500,
                totalSavings: 300,
                available: 5000,
                endingBalance: 500,
                remaining: 500,
                rollover: 0
            ))
            .cardStyle()

            // Over budget (110%)
            BudgetProgressBar(metrics: .init(
                totalIncome: 5000,
                totalExpenses: 5500,
                totalSavings: 200,
                available: 5000,
                endingBalance: -500,
                remaining: -500,
                rollover: 0
            ))
            .cardStyle()

            // Circular indicators
            HStack(spacing: 16) {
                CircularProgressView(progress: 0.3)
                    .frame(width: 40, height: 40)
                CircularProgressView(progress: 0.85)
                    .frame(width: 40, height: 40)
                CircularProgressView(progress: 1.2)
                    .frame(width: 40, height: 40)
            }
        }
        .padding()
    }
}
