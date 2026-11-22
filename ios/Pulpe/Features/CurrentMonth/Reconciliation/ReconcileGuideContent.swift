import Foundation

/// The three scenes of the « Comparer avec mes comptes » guide, in order.
enum ReconcileGuideStep: Int, CaseIterable {
    case compare, type, check

    var next: ReconcileGuideStep? { Self(rawValue: rawValue + 1) }
}

/// Where the guide was opened from, sent with every guide event.
enum ReconcileGuideSource: String, Identifiable {
    case auto, help

    var id: String { rawValue }
}

/// How one opening of the guide ended.
enum ReconcileGuideOutcome: Equatable {
    /// « Comparer maintenant », the last scene's button.
    case completed
    /// Any other exit: « Passer », a swipe down, the sheet going away.
    case skipped

    var event: AnalyticsEvent {
        switch self {
        case .completed: .accountReconciliationGuideCompleted
        case .skipped: .accountReconciliationGuideSkipped
        }
    }

    /// Contract in `ANALYTICS_EVENTS` (shared/src/feature-flags.ts): `source` only.
    func properties(source: ReconcileGuideSource) -> [String: Any] {
        ["source": source.rawValue]
    }
}

/// One opening of the guide: emits `viewed` when it opens and exactly one end event, whichever
/// of the final button and the view's disappearance reports first. `send` is the seam a test
/// replaces to read the emissions.
@MainActor
struct ReconcileGuideSession {
    typealias Send = @MainActor (AnalyticsEvent, [String: Any]) -> Void

    let source: ReconcileGuideSource
    private let send: Send
    private var hasFinished = false

    init(
        source: ReconcileGuideSource,
        send: @escaping Send = { AnalyticsService.shared.capture($0, properties: $1) }
    ) {
        self.source = source
        self.send = send
    }

    func open() {
        send(.accountReconciliationGuideViewed, ["source": source.rawValue])
    }

    /// Returns the outcome only for the first call of the opening.
    mutating func finish(_ outcome: ReconcileGuideOutcome) -> ReconcileGuideOutcome? {
        guard !hasFinished else { return nil }
        hasFinished = true
        send(outcome.event, outcome.properties(source: source))
        return outcome
    }
}

/// The example figures every platform tells the same story with. The gap and the figure after
/// the check are computed, so the scenes can never show numbers that contradict each other.
enum ReconcileGuideSample {
    static let bank: Decimal = 890
    static let pulpe: Decimal = 950
    static let expense: Decimal = 60

    static var gap: Decimal { pulpe - bank }
    static var pulpeAfterCheck: Decimal { pulpe - expense }
}

/// What the third scene draws, from whether its animation has reached its end. Reduce Motion
/// is always at the end.
struct ReconcileGuideCheckState: Equatable {
    let pulpeFigure: Decimal
    let isExpenseChecked: Bool
    let showsMatched: Bool

    init(isSettled: Bool) {
        pulpeFigure = isSettled ? ReconcileGuideSample.pulpeAfterCheck : ReconcileGuideSample.pulpe
        isExpenseChecked = isSettled
        showsMatched = isSettled
    }
}
