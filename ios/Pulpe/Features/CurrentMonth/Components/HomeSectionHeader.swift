import SwiftUI

/// A section's name on the page, with the way out of it — drawn outside the card that
/// holds the section's content, so the boundary of the card is the boundary of the data.
///
/// It replaces the bare chevrons the home used to carry: each sat half a screen from
/// the title it belonged to and never said where it went. A named link says both, and
/// reads as a link because that is what it is.
struct HomeSectionHeader: View {
    let title: String
    /// Optional figure under the title — a window total, an overrun. Always an amount,
    /// so the header can treat every one of them the same way.
    var amountSubtitle: String?
    /// The way out, named and wired together: a header with a label and no action would
    /// draw nothing, and one with an action and no label would have nothing to draw. One
    /// value means the compiler refuses both halves of that rather than the header
    /// silently dropping the link.
    var link: (label: String, action: () -> Void)?

    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    var body: some View {
        Group {
            // Past `xxLarge` the title and the link stop fitting on one line and the link
            // is what gives. Stacked, both keep their words. This is the one place the
            // home branches on text size — the sections below inherit it.
            if dynamicTypeSize >= .xxLarge {
                VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
                    titleBlock
                    linkButton
                }
            } else {
                HStack(alignment: .firstTextBaseline, spacing: DesignTokens.Spacing.md) {
                    titleBlock
                    Spacer(minLength: DesignTokens.Spacing.sm)
                    linkButton
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var titleBlock: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.xxs) {
            Text(title)
                .font(PulpeTypography.sectionTitle)
                .foregroundStyle(Color.textPrimary)

            if let amountSubtitle {
                Text(amountSubtitle)
                    .font(PulpeTypography.labelMedium)
                    .foregroundStyle(Color.textSecondary)
                    .monospacedDigit()
                    .contentTransition(.numericText())
                    .sensitiveAmount()
            }
        }
        .accessibilityElement(children: .combine)
        .accessibilityAddTraits(.isHeader)
    }

    @ViewBuilder
    private var linkButton: some View {
        if let link {
            Button(action: link.action) {
                HStack(spacing: DesignTokens.Spacing.xxs) {
                    Text(link.label)
                    Image(systemName: "chevron.right")
                        .font(PulpeTypography.metricLabel)
                }
                .font(PulpeTypography.labelLarge)
                .foregroundStyle(Color.pulpePrimary)
                .lineLimit(1)
            }
            // A `minHeight` frame here grows the Button's own reported size, and this row
            // sits beside `titleBlock` in an `HStack` — the row takes its tallest child, so
            // the header grows with it (worst for a title-only header, with no
            // `amountSubtitle`, whose `titleBlock` is shortest). Padding out, shaping the
            // hit area at that larger size, then padding back in nets to zero for layout —
            // the row, and the `.firstTextBaseline` guide it shares with `titleBlock`, see
            // the label's original, un-padded size; only the contentShape keeps the wider
            // bounds. Symmetric and half the tap target on each edge, so it clears 44pt
            // regardless of the label's own line height at any text size.
            .padding(.vertical, DesignTokens.TapTarget.minimum / 2)
            .contentShape(Rectangle())
            .padding(.vertical, -DesignTokens.TapTarget.minimum / 2)
            .textLinkButtonStyle()
            // Out of its visual context "Tout voir" names nothing; paired with the
            // section it does, and that saves every call site a hint of its own.
            .accessibilityLabel("\(link.label), \(title)")
        }
    }
}

#Preview {
    VStack(alignment: .leading, spacing: DesignTokens.Spacing.xxl) {
        HomeSectionHeader(title: "Opérations à pointer", link: (label: "Tout voir", action: {}))

        HomeSectionHeader(
            title: "Activité",
            amountSubtitle: "+4 871 CHF",
            link: (label: "Tout voir", action: {})
        )

        HomeSectionHeader(title: "Sans lien", amountSubtitle: "142 CHF au-delà du plan")
    }
    .padding()
    .frame(maxWidth: .infinity, alignment: .leading)
    .background(Color.appBackground)
}
