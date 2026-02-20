import SwiftUI

/// Unified toggle switch for selecting transaction kind (expense/income/saving)
struct KindToggle: View {
    @Binding var selection: TransactionKind
    @Namespace private var toggleAnimation

    var body: some View {
        HStack(spacing: DesignTokens.Spacing.xs) {
            ForEach(TransactionKind.allCases, id: \.self) { kind in
                Button {
                    withAnimation(DesignTokens.Animation.bouncySpring) {
                        selection = kind
                    }
                } label: {
                    Label(kind.label, systemImage: kind.icon)
                        .font(PulpeTypography.buttonSecondary)
                        .fontWeight(selection == kind ? .semibold : .medium)
                        .padding(.vertical, DesignTokens.Spacing.sm + 2)
                        .frame(maxWidth: .infinity)
                        .background {
                            if selection == kind {
                                Capsule()
                                    .fill(Color.pulpePrimary)
                                    .matchedGeometryEffect(id: "kindToggle", in: toggleAnimation)
                            }
                        }
                        .foregroundStyle(selection == kind ? Color.textOnPrimary : Color.textPrimary)
                }
                .buttonStyle(.plain)
            }
        }
        .padding(DesignTokens.Spacing.xs)
        .background(Color.surfaceSecondary, in: Capsule())
        .sensoryFeedback(.selection, trigger: selection)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Type de transaction")
        .accessibilityValue(selection.label)
    }
}
