import SwiftUI

struct RolloverInfoRow: View {
    let amount: Decimal
    let onTap: (() -> Void)?

    private var isPositive: Bool { amount >= 0 }

    @ViewBuilder
    var body: some View {
        if let onTap {
            Button(action: onTap) { content }
                .buttonStyle(.plain)
        } else {
            content
        }
    }

    private var tintColor: Color {
        isPositive ? .financialSavings : .financialOverBudget
    }

    private var content: some View {
        HStack(spacing: DesignTokens.Spacing.md) {
            Image(systemName: "arrow.uturn.backward.circle.fill")
                .font(.system(size: 20))
                .foregroundStyle(tintColor)

            Text("Report")
                .font(PulpeTypography.subheadline)
                .foregroundStyle(.secondary)

            Spacer()

            Text(amount.asCHF)
                .font(PulpeTypography.callout.weight(.semibold))
                .foregroundStyle(tintColor)
                .sensitiveAmount()

            if onTap != nil {
                Image(systemName: "chevron.right")
                    .font(PulpeTypography.caption2)
                    .foregroundStyle(.quaternary)
            }
        }
        .padding(.horizontal, DesignTokens.Spacing.lg)
        .padding(.vertical, DesignTokens.Spacing.md)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Report du mois précédent")
        .accessibilityValue("\(isPositive ? "Excédent" : "Déficit") de \(amount.asCHF)")
        .ifLet(onTap) { view, _ in
            view.accessibilityHint("Appuie deux fois pour voir le budget précédent")
        }
    }
}
