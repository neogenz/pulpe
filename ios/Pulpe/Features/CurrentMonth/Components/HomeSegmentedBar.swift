import SwiftUI

/// Multi-segment bar: each segment a capsule of its own, on a solid capsule track.
/// Used by the drift card mini-bars.
struct HomeSegmentedBar: View {
    struct Segment: Equatable {
        let fraction: Double
        let color: Color
    }

    let segments: [Segment]
    let trackColor: Color
    let height: CGFloat
    /// Hairline marking the bar's full extent, for tracks that don't clear 3:1 on their own.
    var borderColor: Color?

    init(segments: [Segment], trackColor: Color, height: CGFloat, borderColor: Color? = nil) {
        self.segments = segments
        self.trackColor = trackColor
        self.height = height
        self.borderColor = borderColor
    }

    /// Two-segment convenience for the drift mini-bars: planned share, then overflow.
    init(
        fillFraction: Double,
        overflowFraction: Double,
        fillColor: Color,
        overflowColor: Color,
        trackColor: Color,
        height: CGFloat,
        borderColor: Color? = nil
    ) {
        self.init(
            segments: [
                Segment(fraction: fillFraction, color: fillColor),
                Segment(fraction: overflowFraction, color: overflowColor)
            ],
            trackColor: trackColor,
            height: height,
            borderColor: borderColor
        )
    }

    var body: some View {
        GeometryReader { geo in
            HStack(spacing: DesignTokens.Spacing.xxs) {
                // Widths are allotted in order and clamped to what's left, so rounding
                // drift or an over-100% total can never push a segment off the capsule.
                let widths = allottedWidths(total: geo.size.width)
                ForEach(Array(widths.enumerated()), id: \.offset) { index, width in
                    // Each segment is rounded on its own, set off by a sliver of track:
                    // butt-joined blocks under a single clip made the boundary between
                    // two meanings a hard edge, which is what read as cheap.
                    segments[index].color
                        .frame(width: width)
                        .clipShape(.capsule)
                }
                Spacer(minLength: 0)
            }
        }
        .background(trackColor)
        .clipShape(Capsule())
        .overlay {
            if let borderColor {
                Capsule().strokeBorder(borderColor, lineWidth: DesignTokens.BorderWidth.thin)
            }
        }
        .frame(height: height)
        .accessibilityHidden(true)
    }

    private func allottedWidths(total: CGFloat) -> [CGFloat] {
        // The gaps are spent before the segments are, so a full bar still ends where
        // the track ends instead of pushing its last segment past the capsule.
        let gaps = CGFloat(max(segments.count - 1, 0)) * DesignTokens.Spacing.xxs
        let usable = max(total - gaps, 0)
        var remaining = usable
        return segments.map { segment in
            let width = min(max(CGFloat(segment.fraction), 0) * usable, max(remaining, 0))
            remaining -= width
            return width
        }
    }
}
