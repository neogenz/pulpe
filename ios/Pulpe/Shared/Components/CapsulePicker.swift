import SwiftUI

/// Reusable capsule pill selector for CaseIterable enums.
/// Selected state uses `pulpePrimary`; unselected uses `surfaceContainer`.
struct CapsulePicker<T: CaseIterable & Hashable, ItemLabel: View>: View where T.AllCases: RandomAccessCollection {
    @Binding var selection: T
    let title: String?
    @ViewBuilder let itemLabel: (T) -> ItemLabel

    var body: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
            if let title {
                Text(title)
                    .font(PulpeTypography.inputLabel)
                    .foregroundStyle(Color.pulpeTextTertiary)
            }

            HStack(spacing: DesignTokens.Spacing.sm) {
                ForEach(T.allCases, id: \.self) { item in
                    let isSelected = selection == item
                    Button {
                        withAnimation(.snappy(duration: DesignTokens.Animation.fast)) {
                            selection = item
                        }
                    } label: {
                        itemLabel(item)
                            .font(PulpeTypography.buttonSecondary)
                            .padding(.horizontal, DesignTokens.Spacing.md)
                            .padding(.vertical, DesignTokens.Spacing.sm)
                            .frame(maxWidth: .infinity)
                            .frame(minHeight: DesignTokens.TapTarget.minimum)
                            .background(isSelected ? Color.pulpePrimary : Color.surfaceContainer)
                            .foregroundStyle(isSelected ? Color.textOnPrimary : Color.textPrimary)
                            .clipShape(Capsule())
                            .contentShape(Capsule())
                    }
                    .buttonStyle(.plain)
                    .accessibilityAddTraits(isSelected ? .isSelected : [])
                }
            }
            .sensoryFeedback(.selection, trigger: selection)
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel(title ?? "")
    }
}
