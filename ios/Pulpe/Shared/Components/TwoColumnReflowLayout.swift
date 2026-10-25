import SwiftUI

/// Column a card claims in `TwoColumnReflowLayout`. Untagged children span both columns.
enum ReflowColumn {
    case leading, trailing
}

private struct ReflowColumnKey: LayoutValueKey {
    static let defaultValue: ReflowColumn? = nil
}

extension View {
    /// Pins the card to one column of a `TwoColumnReflowLayout`; ignored by stacks.
    func reflowColumn(_ column: ReflowColumn) -> some View {
        layoutValue(key: ReflowColumnKey.self, value: column)
    }
}

// ponytail: even split; put the gutter over the fold with `reservedRegions` once the iOS 27.1 SDK builds.
/// Masonry reflow for a card screen on a wide display (the open iPhone Duo): tagged cards
/// stack in their own column, untagged ones span the full width below whatever sits above
/// them. Children keep their single-column order, so reading and VoiceOver order match the
/// compact `VStackLayout` it is swapped with through `AnyLayout`, and card `@State`
/// survives the swap.
///
/// When only one column has cards, or the columns would fall under `minColumnWidth`, the
/// cards span the full width and stack like a VStack.
struct TwoColumnReflowLayout: Layout {
    var spacing: CGFloat
    var minColumnWidth: CGFloat = DesignTokens.Layout.minReflowColumnWidth

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let width = proposal.width ?? 0
        let frames = place(subviews, width: width)
        let height = frames.map(\.maxY).max() ?? 0
        return CGSize(width: width, height: height)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        for (subview, frame) in zip(subviews, place(subviews, width: bounds.width)) {
            subview.place(
                at: CGPoint(x: bounds.minX + frame.minX, y: bounds.minY + frame.minY),
                proposal: ProposedViewSize(frame.size)
            )
        }
    }

    private func place(_ subviews: Subviews, width: CGFloat) -> [CGRect] {
        let columns = subviews.map { $0[ReflowColumnKey.self] }
        let columnWidth = max(0, (width - spacing) / 2)
        let splits = columns.contains(.leading) && columns.contains(.trailing)
            && columnWidth >= minColumnWidth
        var leadingY: CGFloat = 0
        var trailingY: CGFloat = 0
        var frames: [CGRect] = []

        for (subview, column) in zip(subviews, columns) {
            let x: CGFloat
            let itemWidth: CGFloat
            let y: CGFloat
            switch splits ? column : nil {
            case .leading:
                (x, itemWidth, y) = (0, columnWidth, leadingY)
            case .trailing:
                (x, itemWidth, y) = (columnWidth + spacing, columnWidth, trailingY)
            case nil:
                (x, itemWidth, y) = (0, width, max(leadingY, trailingY))
            }
            let height = subview.sizeThatFits(ProposedViewSize(width: itemWidth, height: nil)).height
            frames.append(CGRect(x: x, y: y, width: itemWidth, height: height))

            // An empty child (a section with nothing to show) takes no gap, like in a VStack.
            let nextY = height > 0 ? y + height + spacing : y
            switch splits ? column : nil {
            case .leading: leadingY = nextY
            case .trailing: trailingY = nextY
            case nil: (leadingY, trailingY) = (nextY, nextY)
            }
        }
        return frames
    }
}

/// Card stack that reflows into `TwoColumnReflowLayout` on a regular-width display and stays
/// a `VStackLayout` otherwise. One `AnyLayout`, so cards keep their `@State` while the
/// device opens and closes; accessibility text sizes keep the single column.
struct ReflowingCardStack<Content: View>: View {
    var spacing: CGFloat
    @ViewBuilder var content: Content

    @Environment(\.horizontalSizeClass) private var horizontalSizeClass
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    var body: some View {
        let layout = horizontalSizeClass == .regular && !dynamicTypeSize.isAccessibilitySize
            ? AnyLayout(TwoColumnReflowLayout(spacing: spacing))
            : AnyLayout(VStackLayout(spacing: spacing))
        layout { content }
    }
}
