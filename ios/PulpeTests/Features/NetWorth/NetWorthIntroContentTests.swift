@testable import Pulpe
import Testing

struct NetWorthIntroContentTests {
    @Test func sampleTotalsTellOneStory() {
        #expect(NetWorthIntroSample.gross == 32200)
        #expect(NetWorthIntroSample.netBefore == 26200)
        #expect(NetWorthIntroSample.netAfter == 26700)
    }

    @Test(arguments: zip(
        [
            (step: NetWorthIntroStep.overview, isEmpty: false),
            (step: .netWorth, isEmpty: true),
            (step: .update, isEmpty: false),
            (step: .update, isEmpty: true)
        ],
        [NetWorthIntroAction.next, .next, .done, .add]
    ))
    func primaryActionFollowsStepAndEmptiness(
        _ input: (step: NetWorthIntroStep, isEmpty: Bool),
        expected: NetWorthIntroAction
    ) {
        #expect(NetWorthIntroAction.primaryAction(step: input.step, isEmpty: input.isEmpty) == expected)
    }

    @Test func onlyTheFirstOutcomeOfAnOpeningCounts() {
        var completion = NetWorthIntroCompletion()
        #expect(completion.finish(.completed(.done)) == .completed(.done))
        // The sheet then disappears and reports a skip: it must not send a second event.
        #expect(completion.finish(.skipped(.update)) == nil)
    }

    @Test func outcomesMapToTheSharedContract() {
        let completed = NetWorthIntroOutcome.completed(.add)
        #expect(completed.event == .netWorthIntroCompleted)
        #expect(completed.properties(source: .auto)["action"] as? String == "add_asset")
        #expect(NetWorthIntroOutcome.completed(.done).properties(source: .help)["action"] as? String == "close")

        let skipped = NetWorthIntroOutcome.skipped(.netWorth)
        #expect(skipped.event == .netWorthIntroSkipped)
        #expect(skipped.properties(source: .help)["step"] as? Int == 1)
        #expect(skipped.properties(source: .help)["source"] as? String == "help")
    }
}
