import Foundation
@testable import Pulpe
import Testing

/// Step 2 when my accounts hold more than Pulpe (spec.md §4.3-4.5): the salary that may be early, the
/// « Je dois » row to add, and the other reasons. The entry is faked at its seam.
@MainActor
struct ReconcilePositiveGapTests {
    // MARK: - Salary early

    @Test("pay day 25: the 23rd is 2 days from the next period, the 19th is 6; no pay day or pay day 1 never")
    func salaryEarly_withinFiveDaysOfAPayDayOtherThanOne() async throws {
        let early = try await comparison(on: day(2026, 11, 23), payDay: 25)
        #expect(early.screen == .salaryEarly)
        #expect(early.nextPayDay == 25)

        #expect(try await comparison(on: day(2026, 11, 19), payDay: 25).screen == .moreOnAccounts)
        #expect(try await comparison(on: day(2026, 11, 23), payDay: nil).screen == .moreOnAccounts)
        #expect(try await comparison(on: day(2026, 11, 28), payDay: 1).screen == .moreOnAccounts)
    }

    @Test("pay day 31 in February 2026: March starts on the 28th, so the 23rd is 5 days away and both say « le 28 »")
    func salaryEarly_payDay31_countsToTheRealStartOfMarch() async throws {
        let twentyThird = try await comparison(on: day(2026, 2, 23), payDay: 31)
        #expect(twentyThird.screen == .salaryEarly)
        #expect(twentyThird.nextPayDay == 28)

        let twentySixth = try await comparison(on: day(2026, 2, 26), payDay: 31)
        #expect(twentySixth.screen == .salaryEarly)
        #expect(twentySixth.nextPayDay == 28)

        // Six days before the 28th: no longer « bientôt ».
        #expect(try await comparison(on: day(2026, 2, 22), payDay: 31).screen == .moreOnAccounts)
    }

    @Test("on pay day itself the next pay day is a month away: pay day 31, the 28 February is not early")
    func salaryEarly_onPayDayItself_looksAtTheMonthAfter() async throws {
        let payDay = try await comparison(on: day(2026, 2, 28), payDay: 31)
        #expect(payDay.screen == .moreOnAccounts)
        #expect(payDay.nextPayDay == 31)
    }

    // MARK: - « Je dois »

    @Test("« Ajouter ce que je dois » goes back to step 1 once, with a « Je dois » row to name and the amounts kept")
    func addOwedRow_backToStepOneOnce() async {
        let flow = await makeComparingFlow(server: StateServer())
        #expect(!flow.hasOwedRow)

        flow.addOwedRowFromComparison()
        flow.addOwedRowFromComparison()

        #expect(flow.step == .accounts)
        #expect(flow.accounts.map(\.amountText) == ["7050", ""])
        #expect(flow.accounts.map(\.isOwed) == [false, true])
        // The card question of step 2 asks only while no « Je dois » row exists.
        #expect(flow.hasOwedRow)
        #expect(flow.takeRowToFocus() == flow.accounts.last?.id)
        #expect(flow.takeRowToFocus() == nil)
    }

    // MARK: - Other reasons

    @Test("other reasons keep their order, drop what cannot be the cause, and stop at three")
    func reasons_orderConditionsAndCap() {
        typealias Sheet = ReconcileReasonsSheet
        #expect(Sheet.reasons(hasOwedRow: false, hasPartlySpent: true) == [.card, .partlySpent, .income])
        #expect(Sheet.reasons(hasOwedRow: false, hasPartlySpent: false) == [.card, .income, .savings])
        #expect(Sheet.reasons(hasOwedRow: true, hasPartlySpent: true) == [.partlySpent, .income, .savings])
        #expect(Sheet.reasons(hasOwedRow: true, hasPartlySpent: false) == [.income, .savings])
    }

    @Test("« Noter un revenu » from the reasons writes nothing once a synced item turned the same gap into suggestions")
    func reasonIncome_screenMoved_writesNothing() async throws {
        let server = StateServer()
        let flow = await makeComparingFlow(server: server, today: try day(2026, 11, 23))
        let opened = try #require(
            flow.comparison(realizedBalance: 1050, lines: [], transactions: [], payDayOfMonth: 25)
        )
        #expect(opened.screen == .salaryEarly)

        // A 6 000.00 income, unchecked, synced while the sheet was open: same gap, suggestions again.
        let prime = TestDataFactory.createTransaction(id: "prime", name: "Prime", amount: 6000, kind: .income)
        let moved = flow.comparison(realizedBalance: 1050, lines: [], transactions: [prime], payDayOfMonth: 25)
        #expect(moved?.gap == opened.gap)
        #expect(moved?.screen == .suggestions)
        let outcome = await flow.submitReasonIncome(
            gap: opened.gap, screen: .salaryEarly, current: moved, realizedBalance: 1050, of: "budget-current"
        )
        #expect(outcome == .ignored)
        #expect(server.creates == 0)

        let same = await flow.submitReasonIncome(
            gap: opened.gap, screen: .salaryEarly, current: opened, realizedBalance: 1050, of: "budget-current"
        )
        #expect(same == .failed)
        #expect(server.creates == 1)
    }

    // MARK: - Helpers

    /// 7 050.00 typed against a realized 1 050.00: accounts 6 000.00 above Pulpe, no suggestion.
    private func comparison(
        on today: Date, payDay: Int?, server: StateServer = StateServer()
    ) async throws -> ReconcileAccountsFlow.Comparison {
        let flow = await makeComparingFlow(server: server, today: today)
        return try #require(
            flow.comparison(realizedBalance: 1050, lines: [], transactions: [], payDayOfMonth: payDay)
        )
    }

    private func makeComparingFlow(server: StateServer, today: Date = .now) async -> ReconcileAccountsFlow {
        let flow = ReconcileAccountsFlow(
            budgetId: "budget-current",
            entryName: "Écart avec mes comptes",
            createTransaction: { _ in try await server.create() },
            onAdjustmentCreated: { _ in },
            onCompleted: { _ in },
            now: { today }
        )
        flow.accounts[0].amountText = "7050"
        flow.compare()
        return flow
    }

    private func day(_ year: Int, _ month: Int, _ day: Int) throws -> Date {
        try #require(Calendar.current.date(from: DateComponents(year: year, month: month, day: day, hour: 12)))
    }
}

/// The create endpoint, faked: an entry asked for, then refused.
@MainActor
private final class StateServer {
    /// Counts the entries asked for, then refuses them: what matters is whether one was asked.
    private(set) var creates = 0

    func create() throws -> Transaction {
        creates += 1
        throw URLError(.notConnectedToInternet)
    }
}
