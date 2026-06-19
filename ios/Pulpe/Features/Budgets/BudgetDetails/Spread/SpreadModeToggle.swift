import SwiftUI

/// Whether a new budget line is created once or spread over several months (PUL-17).
enum BudgetLineCreationMode: CaseIterable, Hashable {
    case once
    case spread

    var label: String {
        switch self {
        case .once: "Une seule fois"
        case .spread: "Lisser"
        }
    }
}

/// Binary segmented control toggling between the single-line and "Lisser" flows.
///
/// Net-new control mirroring `KindToggle`'s styling (capsule pills, accent fill,
/// thin border) on the LIVE DS — no raw Capsule chip, no v2-palette. The accent
/// follows the selected `kind` so the control reads as part of the same form.
struct SpreadModeToggle: View {
    @Binding var selection: BudgetLineCreationMode
    let accentColor: Color

    var body: some View {
        HStack(spacing: DesignTokens.Spacing.sm) {
            ForEach(BudgetLineCreationMode.allCases, id: \.self) { mode in
                let isSelected = selection == mode
                Button {
                    withAnimation(.snappy(duration: DesignTokens.Animation.fast)) {
                        selection = mode
                    }
                } label: {
                    Text(mode.label)
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
                .accessibilityLabel(mode.label)
                .accessibilityAddTraits(isSelected ? .isSelected : [])
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Mode de création")
        .accessibilityValue(selection.label)
        .sensoryFeedback(.selection, trigger: selection)
    }
}

#Preview {
    @Previewable @State var mode: BudgetLineCreationMode = .once
    SpreadModeToggle(selection: $mode, accentColor: .financialExpense)
        .padding()
}
