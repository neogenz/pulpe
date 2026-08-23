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
            let candidates = (0 ... Self.maxPush).flatMap { push in
                [preferred, opposite].map { side in
                    rect(anchor: anchor, size: size, side: side, push: CGFloat(push))
                }
            }
            let obstacles = [dot] + placed.values
            let free = candidates.first { candidate in
                !obstacles.contains { $0.intersects(candidate) }
            }
            // A plot too short for any free slot still has to show the pill: the least covered
            // spot beats the last one tried.
            placed[label] = free ?? candidates.min { overlap($0, with: obstacles) < overlap($1, with: obstacles) }
        }
        return placed
    }

    /// How far a pill may be pushed off its anchor before the search gives up.
    private static let maxPush = 3

    /// The area a candidate steals from what it must avoid, to rank the impossible cases.
    private func overlap(_ candidate: CGRect, with obstacles: [CGRect]) -> CGFloat {
        obstacles.reduce(0) { total, obstacle in
            let shared = obstacle.intersection(candidate)
            return total + (shared.isNull ? 0 : shared.width * shared.height)
        }
    }

    private func rect(anchor: CGPoint, size: CGSize, side: AnnotationPosition, push: CGFloat) -> CGRect {
        let bounds = plot.insetBy(dx: inset, dy: 0)
        // A pill longer than the inset plot is drawn capped to it, so it is placed capped too.
        let width = min(size.width, bounds.width)
        let offset = spacing + push * (size.height + spacing)
        // Today's word is anchored on the dot itself: it clears from the dot's edge.
        let onDot = dot.contains(anchor)
        let y = side == .bottom
            ? (onDot ? dot.maxY : anchor.y) + offset
            : (onDot ? dot.minY : anchor.y) - offset - size.height
        return CGRect(
            x: min(max(anchor.x - width, bounds.minX), bounds.maxX - width),
            y: min(max(y, bounds.minY), bounds.maxY - size.height),
            width: width,
            height: size.height
        )
    }
}
