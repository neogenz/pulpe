import SwiftUI

/// Whether the amount typed in the hero field is a per-month figure or the TOTAL
/// to fan out over the selected months (PUL-17 dual-mode). Total is the default —
/// most users think "I want to spread 1'200 over the year", not "100/month".
enum SpreadAmountMode: CaseIterable, Hashable {
    case total
    case perMonth

    var label: String {
        switch self {
        case .total: "Total"
        case .perMonth: "Par mois"
        }
    }
}

/// Binary segmented control toggling between TOTAL and PER-MONTH amount entry.
///
/// Net-new control calqued on `SpreadModeToggle` (capsule pills, accent fill, thin
/// border, `.sensoryFeedback(.selection)`) so the two toggles read as one family.
/// The accent follows the selected `kind` so the control reads as part of the form.
struct SpreadAmountModeToggle: View {
    @Binding var mode: SpreadAmountMode
    let accentColor: Color

    var body: some View {
        HStack(spacing: DesignTokens.Spacing.sm) {
            ForEach(SpreadAmountMode.allCases, id: \.self) { candidate in
                let isSelected = mode == candidate
                Button {
                    withAnimation(.snappy(duration: DesignTokens.Animation.fast)) {
                        mode = candidate
                    }
                } label: {
                    Text(candidate.label)
                        .font(isSelected ? PulpeTypography.labelLarge : PulpeTypography.labelMedium)
                        .foregroundStyle(isSelected ? accentColor : Color.onSurfaceVariant)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, DesignTokens.Spacing.sm)
                        .background(
                            isSelected
                                ? accentColor.opacity(DesignTokens.Opacity.badgeBackground)
                                : Color.clear
                        )
                        .clipShape(Capsule())
                        .overlay(
                            Capsule().strokeBorder(
                                isSelected
                                    ? accentColor.opacity(DesignTokens.Opacity.secondary)
                                    : Color.clear,
                                lineWidth: DesignTokens.BorderWidth.thin
                            )
                        )
                }
                .frame(minHeight: DesignTokens.TapTarget.minimum)
                .contentShape(Capsule())
                .plainPressedButtonStyle()
                .accessibilityLabel(candidate.label)
                .accessibilityAddTraits(isSelected ? .isSelected : [])
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Mode de montant")
        .accessibilityValue(mode.label)
        .sensoryFeedback(.selection, trigger: mode)
    }
}

#Preview {
    @Previewable @State var mode: SpreadAmountMode = .total
    SpreadAmountModeToggle(mode: $mode, accentColor: .financialExpense)
        .padding()
}
