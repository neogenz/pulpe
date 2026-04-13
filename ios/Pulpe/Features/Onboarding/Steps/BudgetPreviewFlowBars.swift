import SwiftUI

/// Two horizontal bars (Entrées vs Sorties) shown above the breakdown rows
/// in `BudgetPreviewStep`. The Sorties bar is itself stacked: charges (orange)
/// + savings (green). Both bars share the same scale, so length difference
/// communicates deficit/comfort without warning chrome.
struct BudgetPreviewFlowBars: View {
    let income: Decimal
    let charges: Decimal
    let savings: Decimal
    var isRevealed: Bool = true
    var currency: SupportedCurrency = .chf

    @State private var displayProgress: CGFloat = 0
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    private var outflows: Decimal { charges + savings }
    private var maxTotal: Decimal { max(income, outflows) }

    var body: some View {
        if maxTotal > 0 {
            Grid(
                alignment: .leading,
                horizontalSpacing: DesignTokens.Spacing.md,
                verticalSpacing: DesignTokens.Spacing.md
            ) {
                GridRow {
                    label("Entrées")
                    track(segments: [(income, .financialIncome)])
                        .frame(height: DesignTokens.ProgressBar.flowBarHeight)
                    amount(income, prefix: "+")
                }
                GridRow {
                    label("Sorties")
                    track(segments: [
                        (charges, .financialExpense),
                        (savings, .financialSavings)
                    ])
                    .frame(height: DesignTokens.ProgressBar.flowBarHeight)
                    amount(outflows, prefix: "-")
                }
            }
            .padding(.bottom, DesignTokens.Spacing.xs)
            .animation(DesignTokens.Animation.smoothEaseInOut, value: income)
            .animation(DesignTokens.Animation.smoothEaseInOut, value: charges)
            .animation(DesignTokens.Animation.smoothEaseInOut, value: savings)
            .onAppear {
                if isRevealed { revealBars() }
            }
            .onChange(of: isRevealed) { _, newValue in
                if newValue { revealBars() }
            }
        }
    }

    private func revealBars() {
        guard displayProgress < 1 else { return }
        if reduceMotion {
            displayProgress = 1
        } else {
            withAnimation(.smooth(duration: 0.7)) {
                displayProgress = 1
            }
        }
    }

    private func label(_ text: String) -> some View {
        Text(text)
            .font(PulpeTypography.labelLargeBold)
            .foregroundStyle(Color.textPrimary)
    }

    private func amount(_ value: Decimal, prefix: String) -> some View {
        Text("\(prefix)\(value.asCompactCurrency(currency))")
            .font(PulpeTypography.onboardingSubtitle)
            .monospacedDigit()
            .contentTransition(.numericText())
            .foregroundStyle(Color.textPrimary)
            .gridColumnAlignment(.trailing)
    }

    private func track(segments: [(amount: Decimal, color: Color)]) -> some View {
        GeometryReader { proxy in
            ZStack(alignment: .leading) {
                Capsule()
                    .fill(Color.progressTrack)

                HStack(spacing: 0) {
                    ForEach(Array(segments.enumerated()), id: \.offset) { _, segment in
                        if segment.amount > 0 {
                            Rectangle()
                                .fill(segment.color)
                                .frame(width: ratio(segment.amount) * proxy.size.width)
                        }
                    }
                }
                .clipShape(Capsule())
            }
        }
    }

    private func ratio(_ amount: Decimal) -> CGFloat {
        guard maxTotal > 0 else { return 0 }
        let base = CGFloat(truncating: (amount / maxTotal) as NSDecimalNumber)
        return base * displayProgress
    }
}

#Preview("Comfort") {
    BudgetPreviewFlowBars(income: 2500, charges: 1350, savings: 587)
        .padding()
}

#Preview("Deficit") {
    BudgetPreviewFlowBars(income: 500, charges: 1500, savings: 437)
        .padding()
}

#Preview("Savings only") {
    BudgetPreviewFlowBars(income: 2000, charges: 0, savings: 800)
        .padding()
}
