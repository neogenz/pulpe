import SwiftUI

/// Reusable capsule pill selector for CaseIterable enums.
/// Selected state uses `pulpePrimary`; unselected uses `surfaceContainer`.
/// `itemLabel` receives `(item, isSelected)` so secondary lines can use `textOnPrimaryMuted` when selected.
struct CapsulePicker<T: CaseIterable & Hashable, ItemLabel: View>: View where T.AllCases: RandomAccessCollection {
    @Binding var selection: T
    let title: String?
    @ViewBuilder let itemLabel: (T, Bool) -> ItemLabel

    var body: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.xs) {
            if let title {
                Text(title)
                    .font(PulpeTypography.labelMedium)
                    .foregroundStyle(Color.onSurfaceVariant)
            }

            HStack(spacing: DesignTokens.Spacing.sm) {
                ForEach(T.allCases, id: \.self) { item in
                    let isSelected = selection == item
                    Button {
                        withAnimation(.snappy(duration: DesignTokens.Animation.fast)) {
                            selection = item
                        }
                    } label: {
                        itemLabel(item, isSelected)
                            .font(PulpeTypography.buttonSecondary)
                            .padding(.horizontal, DesignTokens.Spacing.md)
                            .padding(.vertical, DesignTokens.Spacing.sm)
                            .frame(maxWidth: .infinity)
                            .background(isSelected ? Color.pulpePrimary : Color.surfaceContainer)
                            .foregroundStyle(isSelected ? Color.textOnPrimary : Color.textPrimary)
                            .clipShape(Capsule())
                    }
                    .frame(minHeight: DesignTokens.TapTarget.minimum)
                    .contentShape(Capsule())
                    .plainPressedButtonStyle()
                    .accessibilityAddTraits(isSelected ? [.isButton, .isSelected] : .isButton)
                }
            }
            .sensoryFeedback(.selection, trigger: selection)
        }
        .accessibilityElement(children: .contain)
    }
}
