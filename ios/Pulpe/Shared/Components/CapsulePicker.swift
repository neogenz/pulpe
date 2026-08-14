import SwiftUI

/// Reusable segmented capsule picker for CaseIterable enums — the app's single
/// 1-of-N control. A recessed track (`inputBackgroundSoft`, the form-field fill)
/// makes the options read as one control instead of free-floating pills; the
/// selected segment is a `segmentedThumb` capsule that slides between options.
/// `itemLabel` receives `(item, isSelected)`; an explicit `foregroundStyle` inside
/// the closure overrides the default ink (accent-tinted toggles use this).
struct CapsulePicker<T: CaseIterable & Hashable, ItemLabel: View>: View where T.AllCases: RandomAccessCollection {
    @Binding var selection: T
    let title: String?
    @ViewBuilder let itemLabel: (T, Bool) -> ItemLabel

    @Namespace private var thumbNamespace
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.xs) {
            if let title {
                Text(title)
                    .font(PulpeTypography.labelMedium)
                    .foregroundStyle(Color.onSurfaceVariant)
            }

            HStack(spacing: 0) {
                ForEach(T.allCases, id: \.self) { item in
                    segment(for: item)
                }
            }
            .padding(DesignTokens.Spacing.xxs)
            .background(Color.inputBackgroundSoft, in: Capsule())
            .sensoryFeedback(.selection, trigger: selection)
        }
        .accessibilityElement(children: .contain)
    }

    private func segment(for item: T) -> some View {
        let isSelected = selection == item
        return Button {
            withAnimation(reduceMotion ? nil : .snappy(duration: DesignTokens.Animation.fast)) {
                selection = item
            }
        } label: {
            itemLabel(item, isSelected)
                .font(isSelected ? PulpeTypography.labelLarge : PulpeTypography.buttonSecondary)
                .padding(.horizontal, DesignTokens.Spacing.md)
                .padding(.vertical, DesignTokens.Spacing.md)
                .frame(maxWidth: .infinity)
                .background {
                    if isSelected {
                        Capsule()
                            .fill(Color.segmentedThumb)
                            .shadow(DesignTokens.Shadow.subtle)
                            .matchedGeometryEffect(id: "thumb", in: thumbNamespace)
                    }
                }
                .foregroundStyle(isSelected ? Color.textPrimary : Color.onSurfaceVariant)
        }
        .frame(minHeight: DesignTokens.TapTarget.minimum)
        .contentShape(Capsule())
        .plainPressedButtonStyle()
        .accessibilityAddTraits(isSelected ? [.isButton, .isSelected] : .isButton)
    }
}
