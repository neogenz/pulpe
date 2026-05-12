import SwiftUI

/// Inline uppercase kind tag — text-only label preceding a transaction line
/// (e.g. `REVENU`, `ÉPARGNE`, `DÉPENSE`). The word carries the meaning;
/// the color reinforces it without being load-bearing.
///
/// Spec: Pulpe v2 `KindTag` — 10pt Manrope ExtraBold, tracking 0.7, uppercase.
/// DA.md §3.7 overrides the v2 mock palette:
/// - `.income` → `Color.financialIncome`
/// - `.saving` → `Color.financialSavings`
/// - `.expense` → `Color.textSecondary` (neutral, not red — DA "le rouge n'est pas punitif")
struct KindTagInline: View {
    let kind: TransactionKind

    private var color: Color {
        switch kind {
        case .income: .financialIncome
        case .saving: .financialSavings
        case .expense: .textSecondary
        }
    }

    var body: some View {
        Text(kind.label.uppercased())
            .font(PulpeTypography.kindTagInline)
            .tracking(DesignTokens.Tracking.uppercase)
            .foregroundStyle(color)
            .accessibilityLabel(kind.label)
    }
}

#Preview {
    VStack(alignment: .leading, spacing: DesignTokens.Spacing.md) {
        KindTagInline(kind: .income)
        KindTagInline(kind: .saving)
        KindTagInline(kind: .expense)
    }
    .padding()
}
