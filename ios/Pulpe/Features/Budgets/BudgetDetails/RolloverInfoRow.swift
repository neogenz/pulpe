import SwiftUI

struct RolloverInfoRow: View {
    let amount: Decimal
    let onTap: (() -> Void)?

    private var isPositive: Bool { amount >= 0 }

    private var accentColor: Color {
        isPositive ? .financialSavings : .financialOverBudget
    }

    private var label: String {
        isPositive ? "Excédent reporté" : "Déficit reporté"
    }

    @ViewBuilder
    var body: some View {
        if let onTap {
            Button(action: onTap) { card }
                .buttonStyle(.plain)
        } else {
            card
        }
    }

    private var card: some View {
        HStack(spacing: 0) {
            // Left accent bar
            RoundedRectangle(cornerRadius: 2)
                .fill(accentColor)
                .frame(width: 4)
                .padding(.vertical, DesignTokens.Spacing.md)

            HStack(spacing: DesignTokens.Spacing.md) {
                // Icon
                Image(systemName: "arrow.triangle.2.circlepath")
                    .font(.system(size: 18, weight: .medium))
                    .foregroundStyle(accentColor)
                    .frame(width: 32, height: 32)
                    .background(accentColor.opacity(DesignTokens.Opacity.highlightBackground))
                    .clipShape(Circle())

                // Text content
                VStack(alignment: .leading, spacing: 2) {
                    Text("Report du mois précédent")
                        .font(PulpeTypography.labelMedium)
                        .foregroundStyle(.secondary)

                    Text(amount.asCHF)
                        .font(PulpeTypography.callout.weight(.semibold))
                        .foregroundStyle(accentColor)
                        .monospacedDigit()
                        .sensitiveAmount()
                }

                Spacer(minLength: 0)

                // Trailing badge + chevron
                HStack(spacing: DesignTokens.Spacing.xs) {
                    Text(label)
                        .font(PulpeTypography.caption)
                        .foregroundStyle(accentColor.opacity(0.8))
                        .padding(.horizontal, DesignTokens.Spacing.sm)
                        .padding(.vertical, 3)
                        .background(accentColor.opacity(DesignTokens.Opacity.faint))
                        .clipShape(Capsule())

                    if onTap != nil {
                        Image(systemName: "chevron.right")
                            .font(PulpeTypography.caption2)
                            .foregroundStyle(.quaternary)
                    }
                }
            }
            .padding(.leading, DesignTokens.Spacing.md)
            .padding(.trailing, DesignTokens.Spacing.lg)
            .padding(.vertical, DesignTokens.Spacing.md)
        }
        .background(
            RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.sm)
                .fill(Color.surfaceContainerHigh)
                .overlay(
                    RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.sm)
                        .strokeBorder(accentColor.opacity(0.1), lineWidth: 1)
                )
        )
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Report du mois précédent")
        .accessibilityValue("\(label) de \(amount.asCHF)")
        .ifLet(onTap) { view, _ in
            view.accessibilityHint("Appuie deux fois pour voir le budget précédent")
        }
    }
}

// MARK: - Preview

#Preview("Rollover — Excédent") {
    VStack(spacing: 16) {
        RolloverInfoRow(amount: 1274.02, onTap: {})
        RolloverInfoRow(amount: -350, onTap: {})
        RolloverInfoRow(amount: 89.50, onTap: nil)
    }
    .padding()
    .pulpeBackground()
}
