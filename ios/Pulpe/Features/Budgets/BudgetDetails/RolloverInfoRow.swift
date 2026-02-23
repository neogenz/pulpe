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

    private var content: some View {
        HStack(spacing: DesignTokens.Spacing.md) {
            Image(systemName: "arrow.uturn.backward.circle.fill")
                .font(PulpeTypography.title2)
                .foregroundStyle(isPositive ? Color.financialSavings : Color.financialOverBudget)

            VStack(alignment: .leading, spacing: 2) {
                Text("Report du mois précédent")
                    .font(PulpeTypography.buttonSecondary)
                    .foregroundStyle(.primary)
                Text(isPositive ? "Excédent reporté" : "Déficit reporté")
                    .font(PulpeTypography.caption)
                    .foregroundStyle(.secondary)
            }

            Spacer()

            Text(amount.asCHF)
                .font(PulpeTypography.headline)
                .foregroundStyle(isPositive ? Color.financialSavings : Color.financialOverBudget)
                .sensitiveAmount()
        }
        .padding()
        .background(
            RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.md)
                .fill(
                    (isPositive ? Color.financialSavings : Color.financialOverBudget)
                        .opacity(DesignTokens.Opacity.highlightBackground)
                )
        )
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Report du mois précédent")
        .accessibilityValue("\(isPositive ? "Excédent" : "Déficit") de \(amount.asCHF)")
        .ifLet(onTap) { view, _ in
            view.accessibilityHint("Appuie deux fois pour voir le budget précédent")
        }
    }
}
