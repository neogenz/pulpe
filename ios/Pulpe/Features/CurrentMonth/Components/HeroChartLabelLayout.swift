import Charts
import CoreGraphics

// ponytail: greedy, fixed priority; add a scoring pass when a 4th label shows up.

/// Places the home plot's pills around today's dot in point space. Swift Charts resolves an
/// annotation's overflow against the plot only, never against another mark, so late in the
/// month the three pills and the dot all claim the same corner; this is the one pass that
/// sees them all at once.
struct HeroChartLabelLayout {
    /// Priority order: the first placed never moves for the ones after it.
    enum Label: CaseIterable {
        case today, trend, plan
    }

    let plot: CGRect
    let dot: CGRect
    let spacing: CGFloat
    /// The hero's text inset: the plot is edge to edge, the pills are not.
    let inset: CGFloat

    /// One rect per present anchor. A pill grows leftward from its anchor (trailing
    /// alignment), tries its preferred side, the other, then each pushed one pill further,
    /// and takes the first that clears the dot, the pills already placed, and the inset plot.
    func resolve(
        anchors: [Label: CGPoint],
        sizes: [Label: CGSize],
        preferredSide: [Label: AnnotationPosition]
    ) -> [Label: CGRect] {
        var placed: [Label: CGRect] = [:]
        for label in Label.allCases {
            guard let anchor = anchors[label], let size = sizes[label] else { continue }
            let preferred = preferredSide[label] ?? .top
            let opposite: AnnotationPosition = preferred == .bottom ? .top : .bottom
            let candidates = [(preferred, 0), (opposite, 0), (preferred, 1), (opposite, 1)].map { side, push in
                rect(anchor: anchor, size: size, side: side, push: CGFloat(push))
            }
            let obstacles = [dot] + placed.values
            placed[label] = candidates.first { candidate in
                !obstacles.contains { $0.intersects(candidate) }
            } ?? candidates[candidates.count - 1]
        }
        return placed
    }

    private func rect(anchor: CGPoint, size: CGSize, side: AnnotationPosition, push: CGFloat) -> CGRect {
        let bounds = plot.insetBy(dx: inset, dy: 0)
        let offset = spacing + push * (size.height + spacing)
        let y = side == .bottom ? anchor.y + offset : anchor.y - offset - size.height
        return CGRect(
            x: min(max(anchor.x - size.width, bounds.minX), bounds.maxX - size.width),
            y: min(max(y, bounds.minY), bounds.maxY - size.height),
            width: size.width,
            height: size.height
        )
    }
}
