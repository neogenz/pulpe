import CoreGraphics

// MARK: - Charts

/// The home plot draws its own axes out of its labels, so several of these are ratios of the
/// plotted range rather than lengths: the drawing has to hold together on a month that moved
/// by 200 francs and on one that moved by 2 000.
extension DesignTokens {
    enum Chart {
        static let dash: [CGFloat] = [5, 4]
        static let markerDash: [CGFloat] = [3, 3]
        static let pointSymbolArea: CGFloat = 100
        static let dashboardHeight: CGFloat = 150
        /// A savings goal spans ~24 months and is read for its shape, not for a
        /// value at a date — it needs more room than the dashboard's 150pt strip,
        /// and the same room in the detail and in the simulator.
        static let goalHeight: CGFloat = 160
        static let domainPaddingRatio = 0.12
        static let minimumDomainPadding = 1.0

        /// The plotted range never shrinks below this share of what the period planned to
        /// spend. Without it a month held to a couple of hundred francs of its plan fills
        /// the frame edge to edge and reads as an accident.
        static let landingScaleFloorRatio = 0.05

        /// Below this share of the plotted range, the gap has no room for a label of its
        /// own: it would sit within a line height of the plan's. The metric above the plot
        /// still carries the figure, so the drawing simply stays quiet.
        static let gapLabelMinimumRatio = 0.08

        /// The anchor label is part of the drawing, so the range reserves a one-line band
        /// for it on the far side of the rule instead of letting it fall out of the frame.
        static let anchorLabelBandRatio = 0.18
    }
}
