import SwiftUI

/// Unified toggle switch for selecting transaction kind (expense/income/saving)
/// Mimics native segmented picker structure with brand-tinted glass on selection.
/// Uses Liquid Glass on iOS 26+, falls back to capsule design on earlier versions.
struct KindToggle: View {
    @Binding var selection: TransactionKind
    @Namespace private var toggleAnimation

    var body: some View {
        if #available(iOS 26, *) {
            liquidGlassToggle
        } else {
            capsuleToggle
        }
    }

    // MARK: - Liquid Glass (iOS 26+)

    @available(iOS 26, *)
    private var liquidGlassToggle: some View {
        GlassEffectContainer(spacing: 0) {
            glassSegments
        }
        .sensoryFeedback(.selection, trigger: selection)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Type de transaction")
        .accessibilityValue(selection.label)
    }

    @available(iOS 26, *)
    private var glassSegments: some View {
        HStack(spacing: 0) {
            ForEach(TransactionKind.allCases, id: \.self) { kind in
                glassSegmentButton(for: kind)
            }
        }
        .padding(DesignTokens.Spacing.xs)
        .background(.thinMaterial, in: Capsule())
    }

    @available(iOS 26, *)
    @ViewBuilder
    private func glassSegmentButton(for kind: TransactionKind) -> some View {
        let isSelected = selection == kind

        let button = Button {
            withAnimation(DesignTokens.Animation.bouncySpring) {
                selection = kind
            }
        } label: {
            segmentLabel(for: kind)
        }
        .buttonStyle(.plain)

        if isSelected {
            button
                .glassEffect(
                    .regular.tint(Color.pulpePrimary).interactive(),
                    in: .capsule
                )
                .glassEffectID(kind.rawValue, in: toggleAnimation)
        } else {
            button
                .glassEffectID(kind.rawValue, in: toggleAnimation)
        }
    }

    // MARK: - Capsule Fallback (< iOS 26)

    private var capsuleToggle: some View {
        HStack(spacing: 0) {
            ForEach(TransactionKind.allCases, id: \.self) { kind in
                capsuleSegmentButton(for: kind)
            }
        }
        .padding(DesignTokens.Spacing.xs)
        .background(Color.surfaceSecondary, in: Capsule())
        .sensoryFeedback(.selection, trigger: selection)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Type de transaction")
        .accessibilityValue(selection.label)
    }

    private func capsuleSegmentButton(for kind: TransactionKind) -> some View {
        Button {
            withAnimation(DesignTokens.Animation.bouncySpring) {
                selection = kind
            }
        } label: {
            segmentLabel(for: kind)
                .background {
                    if selection == kind {
                        Capsule()
                            .fill(Color.pulpePrimary)
                            .matchedGeometryEffect(id: "kindToggle", in: toggleAnimation)
                    }
                }
        }
        .buttonStyle(.plain)
    }

    // MARK: - Shared

    private func segmentLabel(for kind: TransactionKind) -> some View {
        Label(kind.label, systemImage: kind.icon)
            .font(PulpeTypography.buttonSecondary)
            .fontWeight(selection == kind ? .semibold : .medium)
            .padding(.vertical, DesignTokens.Spacing.sm + 2)
            .padding(.horizontal, DesignTokens.Spacing.sm)
            .frame(maxWidth: .infinity)
            .foregroundStyle(selection == kind ? Color.textOnPrimary : Color.textPrimary)
    }
}
