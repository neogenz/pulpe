import SwiftUI

/// Reusable segmented picker for CaseIterable enums — the app's single 1-of-N control
/// (V2 `seg`): a `sunk` capsule track with 3pt padding, 36pt segments, the selected one a
/// white capsule with a small shadow and `ink` text, the others `ink2`.
/// `itemLabel` returns a plain `Text` (emoji allowed). Values that are not an enum (years)
/// pass their `options`. At accessibility text sizes the segments stack, one per line, so a
/// label is read whole instead of being cut to fit a third of the screen.
struct SegmentedPicker<T: Hashable>: View {
    @Binding var selection: T
    let title: String?
    /// The segments shown, in order. All cases unless a rule hides some (an income cannot be spread).
    var options: [T]
    /// Segments shown but not selectable (an every-month prévision on a closed month).
    var disabledOptions: Set<T> = []
    let itemLabel: (T) -> Text

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    @Namespace private var thumb

    private var isStacked: Bool { dynamicTypeSize.isAccessibilitySize }

    /// A capsule on one line; stacked, its ends would be half-circles as tall as the track.
    private var trackShape: AnyShape {
        isStacked ? AnyShape(.rect(cornerRadius: DesignTokens.CornerRadius.card)) : AnyShape(.capsule)
    }

    private var thumbShape: AnyShape {
        isStacked
            ? AnyShape(.rect(cornerRadius: DesignTokens.CornerRadius.card - DesignTokens.Control.segmentedPadding))
            : AnyShape(.capsule)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.xs) {
            if let title {
                Text(title)
                    .font(PulpeTypography.metricLabel)
                    .foregroundStyle(Color.onSurfaceVariant)
                    .padding(.leading, DesignTokens.Spacing.xs)
                    // The group below carries the same title as its own accessibility
                    // label; without this, VoiceOver announces it twice.
                    .accessibilityHidden(true)
            }

            let layout = isStacked
                ? AnyLayout(VStackLayout(spacing: DesignTokens.Spacing.none))
                : AnyLayout(HStackLayout(spacing: DesignTokens.Spacing.none))
            layout {
                ForEach(options, id: \.self) { item in
                    segment(item)
                }
            }
            .padding(DesignTokens.Control.segmentedPadding)
            .background(Color.sunk, in: trackShape)
            .sensoryFeedback(.selection, trigger: selection)
            .accessibilityElement(children: .contain)
            .accessibilityLabel(title ?? "")
        }
    }

    private func segment(_ item: T) -> some View {
        let isSelected = item == selection
        return Button {
            withAnimation(reduceMotion ? nil : DesignTokens.Animation.selectionSpring) {
                selection = item
            }
        } label: {
            itemLabel(item)
                .font(PulpeTypography.chipLabel)
                .foregroundStyle(isSelected ? Color.textPrimary : Color.textSecondary)
                .lineLimit(isStacked ? nil : 1)
                .minimumScaleFactor(DesignTokens.TextScale.compact)
                .multilineTextAlignment(.center)
                .frame(maxWidth: .infinity)
                .frame(minHeight: DesignTokens.FrameHeight.chip)
                .padding(.horizontal, isStacked ? DesignTokens.Spacing.md : DesignTokens.Spacing.none)
                .accessibilityShowsLargeContentViewer()
                .background {
                    if isSelected {
                        Color.surface
                            .clipShape(thumbShape)
                            .shadow(DesignTokens.Shadow.segmentThumb)
                            .matchedGeometryEffect(id: "thumb", in: thumb)
                    }
                }
                // 36pt visual, 44pt hit area, layout unchanged.
                .padding(.vertical, (DesignTokens.TapTarget.minimum - DesignTokens.FrameHeight.chip) / 2)
                .contentShape(Rectangle())
                .padding(.vertical, -(DesignTokens.TapTarget.minimum - DesignTokens.FrameHeight.chip) / 2)
        }
        .buttonStyle(.plain)
        .disabled(disabledOptions.contains(item))
        .opacity(disabledOptions.contains(item) ? DesignTokens.Opacity.disabled : 1)
        .accessibilityAddTraits(isSelected ? .isSelected : [])
    }
}

extension SegmentedPicker where T: CaseIterable, T.AllCases: RandomAccessCollection {
    init(
        selection: Binding<T>,
        title: String?,
        disabledOptions: Set<T> = [],
        itemLabel: @escaping (T) -> Text
    ) {
        self.init(
            selection: selection,
            title: title,
            options: Array(T.allCases),
            disabledOptions: disabledOptions,
            itemLabel: itemLabel
        )
    }
}

#Preview {
    @Previewable @State var kind: TransactionKind = .expense
    SegmentedPicker(selection: $kind, title: "Nature") { Text($0.label) }
        .padding()
        .background(Color.appBackground)
}
