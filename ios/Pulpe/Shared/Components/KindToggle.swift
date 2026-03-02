import SwiftUI

struct KindToggle: View {
    @Binding var selection: TransactionKind

    var body: some View {
        HStack(spacing: DesignTokens.Spacing.sm) {
            ForEach(TransactionKind.allCases, id: \.self) { kind in
                let isSelected = selection == kind
                Button {
                    withAnimation(.snappy(duration: DesignTokens.Animation.fast)) {
                        selection = kind
                    }
                } label: {
                    Text(kind.label)
                        .font(isSelected ? PulpeTypography.labelLarge : PulpeTypography.labelMedium)
                        .foregroundStyle(isSelected ? kind.color : Color.onSurfaceVariant)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, DesignTokens.Spacing.sm)
                        .background(
                            isSelected
                                ? kind.color.opacity(DesignTokens.Opacity.badgeBackground)
                                : Color.clear
                        )
                        .clipShape(Capsule())
                        .overlay(
                            Capsule().strokeBorder(
                                isSelected
                                    ? kind.color.opacity(DesignTokens.Opacity.secondary)
                                    : Color.clear,
                                lineWidth: 1
                            )
                        )
                }
                .buttonStyle(.plain)
                .accessibilityLabel(kind.label)
                .accessibilityAddTraits(isSelected ? .isSelected : [])
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Type de transaction")
        .accessibilityValue(selection.label)
        .sensoryFeedback(.selection, trigger: selection)
    }
}
