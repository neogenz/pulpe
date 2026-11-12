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
        /// Home hero trajectory (V2 board: 96pt plot).
        static let dashboardHeight: CGFloat = 96
        /// A savings goal spans ~24 months and is read for its shape, not for a
        /// value at a date — it needs more room than the dashboard's 96pt strip,
        /// and the same room in the detail and in the simulator.
        static let goalHeight: CGFloat = 160
        static let domainPaddingRatio = 0.12
        /// How long the finger rests before the scrub rule takes it: shorter and the page
        /// scroll loses its vertical drags, longer and the plot feels asleep.
        static let scrubHoldDuration: Double = 0.15
        static let minimumDomainPadding = 1.0

        /// The plotted range never shrinks below this share of what the period planned to
        /// spend. Without it a month held to a couple of hundred francs of its plan fills
        /// the frame edge to edge and reads as an accident.
        static let landingScaleFloorRatio = 0.05

        /// Below this share of the plotted range, the trend and the plan end on one point:
        /// VoiceOver does not speak the trend apart.
        static let gapLabelMinimumRatio = 0.08

        /// Days of plan-as-prior the trend pace is shrunk against when the user has no
        /// drift history yet: a week, so the first few days of a month bend the projection
        /// without throwing it. With a history, `DriftHistory.priorStrength` takes over.
        static let trendPriorDays = 7

        /// The forecast bars of the budget-tracking sheet: both sides of zero share this
        /// height, and a month near zero keeps a stub so its column never reads as missing.
        static let forecastPlotHeight: CGFloat = 132
        static let forecastBarWidth: CGFloat = 26
        static let forecastBarMinHeight: CGFloat = 10
        /// The dot under the selected month's name.
        static let forecastSelectionDot: CGFloat = 6

        /// One dot per budget item on the pointed-balance card. Past `checkDotLimit` (two
        /// rows) the dots stop being countable and the card falls back to a progress bar.
        static let checkDotColumns = 25
        static let checkDotLimit = 50

        /// Breakdown diagram: below `sankeyMinWidth` the card scrolls sideways instead of
        /// squeezing the columns. `sankeyLabelWidth` is kept free beside the first and last
        /// columns for their labels.
        static let sankeyMinWidth: CGFloat = 310
        static let sankeyHeight: CGFloat = 260
        static let sankeyNodeWidth: CGFloat = 10
        static let sankeyNodeGap: CGFloat = 14
        static let sankeyMinNodeHeight: CGFloat = 20
        /// Height added above the per-node floors and gaps when the diagram grows, so the nodes of a
        /// crowded column stay proportional to their value instead of all sitting on the floor.
        static let sankeyProportionalRoom: CGFloat = 130
        static let sankeyLabelWidth: CGFloat = 96
        static let sankeyLabelHeadroom: CGFloat = 40
        /// Pill carrying the label of a middle-column node; the layout keeps a gap of this height free above each.
        static let sankeyPillHeight: CGFloat = 28
        static let sankeyBandOpacity = 0.3
    }
}
