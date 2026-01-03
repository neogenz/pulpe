import SwiftUI

/// Progress bar showing budget usage
struct BudgetProgressBar: View {
    let metrics: BudgetFormulas.Metrics
    let showLabels: Bool

    init(metrics: BudgetFormulas.Metrics, showLabels: Bool = true) {
        self.metrics = metrics
        self.showLabels = showLabels
    }

    private var progress: Double {
        guard metrics.available > 0 else { return 0 }
        let spent = metrics.totalExpenses
        return min(Double(truncating: (spent / metrics.available) as NSDecimalNumber), 1.5)
    }

    private var remainingPercentage: Double {
        max(0, 1 - progress)
    }

    private var progressColor: Color {
        if progress > 1 { return .red }
        if progress > 0.8 { return .orange }
        return .green
    }

    var body: some View {
        VStack(spacing: 12) {
            // Main label
            if showLabels {
                HStack {
                    Text("Disponible à dépenser")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)

                    Spacer()

                    Text(metrics.remaining.formatted(.currency(code: "CHF")))
                        .font(.title2)
                        .fontWeight(.bold)
                        .foregroundStyle(metrics.remaining < 0 ? .red : .primary)
                }
            }

            // Progress bar
            GeometryReader { geometry in
                ZStack(alignment: .leading) {
                    // Background
                    RoundedRectangle(cornerRadius: 8)
                        .fill(Color.secondary.opacity(0.2))

                    // Filled portion
                    RoundedRectangle(cornerRadius: 8)
                        .fill(progressColor)
                        .frame(width: geometry.size.width * CGFloat(min(progress, 1)))
                }
            }
            .frame(height: 12)

            // Bottom labels
            if showLabels {
                HStack {
                    Label {
                        Text("Dépensé")
                    } icon: {
                        Circle()
                            .fill(progressColor)
                            .frame(width: 8, height: 8)
                    }
                    .font(.caption)
                    .foregroundStyle(.secondary)

                    Spacer()

                    Text("\(Int(progress * 100))%")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
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
        if progress > 0.8 { return .orange }
        return .green
    }

    var body: some View {
        ZStack {
            Circle()
                .stroke(Color.secondary.opacity(0.2), lineWidth: lineWidth)

            Circle()
                .trim(from: 0, to: min(CGFloat(progress), 1))
                .stroke(progressColor, style: StrokeStyle(lineWidth: lineWidth, lineCap: .round))
                .rotationEffect(.degrees(-90))
        }
    }
}

#Preview {
    VStack(spacing: 32) {
        BudgetProgressBar(metrics: .init(
            totalIncome: 5000,
            totalExpenses: 2000,
            available: 5500,
            endingBalance: 3500,
            remaining: 3500,
            rollover: 500
        ))

        BudgetProgressBar(metrics: .init(
            totalIncome: 5000,
            totalExpenses: 4500,
            available: 5000,
            endingBalance: 500,
            remaining: 500,
            rollover: 0
        ))

        BudgetProgressBar(metrics: .init(
            totalIncome: 5000,
            totalExpenses: 5500,
            available: 5000,
            endingBalance: -500,
            remaining: -500,
            rollover: 0
        ))

        HStack {
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
