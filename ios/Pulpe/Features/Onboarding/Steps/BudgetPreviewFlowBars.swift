import SwiftUI

/// Two horizontal bars (Entrées vs Sorties) shown above the breakdown rows
/// in `BudgetPreviewStep`. The Sorties bar is itself stacked: charges (amber)
/// + savings (green). Both bars share the same scale, so length difference
/// communicates deficit/comfort without warning chrome.
///
/// Values are NOT rendered next to the bars — exact amounts live in the
/// breakdown rows directly below, so duplicating them here would be visual
/// noise (the bars tell the story, the rows carry the data).
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
                }
                GridRow {
                    label("Sorties")
                    track(segments: [
                        (charges, .financialExpense),
                        (savings, .financialSavings)
                    ])
                    .frame(height: DesignTokens.ProgressBar.flowBarHeight)
                }
            }
            .padding(.bottom, DesignTokens.Spacing.xs)
            .animation(DesignTokens.Animation.smoothEaseInOut, value: income)
            .animation(DesignTokens.Animation.smoothEaseInOut, value: charges)
            .animation(DesignTokens.Animation.smoothEaseInOut, value: savings)
            // The parent breakdown card owns a `.accessibilityLabel(breakdownAccessibilityLabel)`
            // which already states both totals in plain language; the bars here
            // are redundant for VoiceOver users, so we hide them from the tree.
            .accessibilityHidden(true)
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
                                .frame(width: segmentWidth(segment.amount, totalWidth: proxy.size.width))
                        }
                    }
                }
                .clipShape(Capsule())
            }
        }
    }

    /// Guarantee a minimum pill width when a segment is present but tiny, so
    /// extreme ratios (e.g. income = 12k vs outflows = 890k) never reduce a
    /// meaningful value to an invisible 1-2px sliver. The visual's whole job
    /// is to communicate imbalance — it must stay legible at any scale.
    private func segmentWidth(_ amount: Decimal, totalWidth: CGFloat) -> CGFloat {
        guard maxTotal > 0, amount > 0 else { return 0 }
        let base = CGFloat(truncating: (amount / maxTotal) as NSDecimalNumber)
        let scaled = base * displayProgress * totalWidth
        let minVisible: CGFloat = displayProgress > 0 ? 8 : 0
        return max(scaled, minVisible)
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

#Preview("Extreme imbalance") {
    BudgetPreviewFlowBars(income: 12_325, charges: 891_658, savings: 0)
        .padding()
}
