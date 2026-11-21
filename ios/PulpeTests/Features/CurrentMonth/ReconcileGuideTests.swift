@testable import Pulpe
import Testing

@MainActor
struct ReconcileGuideTests {
    // MARK: Gate

    @Test func presentsOnlyWhenUnseen() {
        #expect(ReconcileGuideGate.shouldPresent(hasSeen: false))
        #expect(!ReconcileGuideGate.shouldPresent(hasSeen: true))
    }

    // MARK: Content

    @Test func sampleTellsOneStory() {
        #expect(ReconcileGuideSample.gap == 60)
        #expect(ReconcileGuideSample.pulpeAfterCheck == ReconcileGuideSample.bank)
    }

    @Test func threeScenesThenTheForm() {
        #expect(ReconcileGuideStep.allCases.count == 3)
        #expect(ReconcileGuideStep.compare.next == .type)
        #expect(ReconcileGuideStep.check.next == nil)
    }

    @Test func sampleAmountsFollowTheCurrencyLocale() {
        #expect(ReconcileGuideSample.bank.asAmount(for: .chf) == "890.00")
        #expect(ReconcileGuideSample.bank.asAmount(for: .eur) == "890,00")
    }

    // MARK: Events

    private typealias Sent = [(event: AnalyticsEvent, source: String?)]

    /// Runs one opening, ending with `outcomes` in order (the last ones model the view's
    /// disappearance reporting after a button), and returns what was emitted.
    private func emissions(source: ReconcileGuideSource, outcomes: [ReconcileGuideOutcome]) -> Sent {
        var sent: Sent = []
        var session = ReconcileGuideSession(source: source) { event, properties in
            sent.append((event, properties["source"] as? String))
        }
        session.open()
        for outcome in outcomes { _ = session.finish(outcome) }
        return sent
    }

    @Test func firstOpeningEmitsViewedThenCompletedOnce() {
        // « Comparer maintenant », then the view disappears and reports a skip
        let sent = emissions(source: .auto, outcomes: [.completed, .skipped])
        #expect(sent.map(\.event) == [.accountReconciliationGuideViewed, .accountReconciliationGuideCompleted])
        let allAuto = sent.allSatisfy { $0.source == "auto" }
        #expect(allAuto)
    }

    @Test func replayEmitsViewedThenSkippedOnce() {
        let sent = emissions(source: .help, outcomes: [.skipped, .skipped])
        #expect(sent.map(\.event) == [.accountReconciliationGuideViewed, .accountReconciliationGuideSkipped])
        let allHelp = sent.allSatisfy { $0.source == "help" }
        #expect(allHelp)
    }

    @Test func outcomesMapToTheSharedEvents() {
        #expect(ReconcileGuideOutcome.completed.event == .accountReconciliationGuideCompleted)
        #expect(ReconcileGuideOutcome.skipped.event == .accountReconciliationGuideSkipped)
    }

    @Test func eventsCarryTheSourceAndNothingElse() {
        var properties: [[String: Any]] = []
        var session = ReconcileGuideSession(source: .help) { _, props in properties.append(props) }
        session.open()
        _ = session.finish(.skipped)
        #expect(properties.count == 2)
        let onlySource = properties.allSatisfy { $0.count == 1 && $0["source"] as? String == "help" }
        #expect(onlySource)
    }

    // MARK: Reduce Motion

    @Test func reduceMotionDrawsSceneThreeAtItsEndState() {
        let timeline = ReconcileGuideTimeline(isPlaying: false, reduceMotion: true)
        let state = ReconcileGuideCheckState(isSettled: timeline.isSettled)
        #expect(state.pulpeFigure == ReconcileGuideSample.bank)
        #expect(state.isExpenseChecked)
        #expect(state.showsMatched)
    }

    /// Scenes 1 and 2 reveal every element (both amounts and the gap chip; the typed digits and
    /// the highlighted balance) through `timeline.isSettled`, so reduced motion must start settled.
    @Test func reduceMotionDrawsScenesOneAndTwoSettledFromTheFirstFrame() {
        let reduced = ReconcileGuideTimeline(isPlaying: false, reduceMotion: true)
        let animated = ReconcileGuideTimeline(isPlaying: false, reduceMotion: false)
        #expect(reduced.isSettled)
        #expect(!animated.isSettled)
        #expect(ReconcileGuideTimeline(isPlaying: true, reduceMotion: false).isSettled)
    }

    @Test func sceneThreeStartsOnTheUncheckedFigure() {
        let timeline = ReconcileGuideTimeline(isPlaying: false, reduceMotion: false)
        let state = ReconcileGuideCheckState(isSettled: timeline.isSettled)
        #expect(state.pulpeFigure == ReconcileGuideSample.pulpe)
        #expect(!state.isExpenseChecked)
        #expect(!state.showsMatched)
    }
}
