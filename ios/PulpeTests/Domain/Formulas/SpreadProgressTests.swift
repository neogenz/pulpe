import Foundation
@testable import Pulpe
import Testing

/// PUL-17 — locks the client-side spread progress derivation against the web
/// `spread-occurrence.view-model.ts` spec: the two axes (display `isPast`/
/// `isCurrent` vs the VIEWED period, realization `isClosed` vs TODAY), and the
/// tracker (cumulé over realized-only, total, position, per-month, percent).
@Suite("SpreadProgress")
struct SpreadProgressTests {
    private func occ(
        month: Int,
        year: Int = 2026,
        amount: Decimal,
        consumed: Decimal = 0,
        transactionCount: Int = 0,
        checkedAt: Date? = nil
    ) -> SpreadOccurrence {
        SpreadOccurrence(
            budgetLineId: "bl-\(year)-\(month)",
            budgetId: "b-\(year)-\(month)",
            month: month,
            year: year,
            name: "Assurance",
            amount: amount,
            kind: .expense,
            checkedAt: checkedAt,
            originalAmount: nil,
            consumed: consumed,
            transactionCount: transactionCount
        )
    }

    private func period(_ month: Int, _ year: Int = 2026) -> BudgetPeriod {
        BudgetPeriod(month: month, year: year)
    }

    private func makeItems(_ occurrences: [SpreadOccurrence], ref: Int, live: Int) -> [SpreadOccurrenceItem] {
        SpreadProgress.buildItems(
            occurrences: occurrences,
            referencePeriod: period(ref),
            livePeriod: period(live)
        )
    }

    private func tracker(_ occurrences: [SpreadOccurrence], ref: Int, live: Int) -> SpreadTracker? {
        SpreadProgress.buildTracker(from: makeItems(occurrences, ref: ref, live: live))
    }

    // MARK: - buildItems

    @Test func buildItems_sortsByPeriodAscending() {
        let occurrences = [occ(month: 7, amount: 100), occ(month: 5, amount: 100), occ(month: 6, amount: 100)]
        let items = makeItems(occurrences, ref: 6, live: 6)
        #expect(items.map(\.occurrence.month) == [5, 6, 7])
    }

    @Test func buildItems_pastAndCurrent_areRelativeToReferencePeriod() {
        let occurrences = [occ(month: 5, amount: 100), occ(month: 6, amount: 100), occ(month: 7, amount: 100)]
        let items = makeItems(occurrences, ref: 6, live: 6)
        #expect(items[0].isPast)
        #expect(items[1].isCurrent)
        #expect(!items[2].isPast && !items[2].isCurrent)
    }

    @Test func buildItems_isClosed_isRelativeToLivePeriod_notReference() {
        // Viewing a FUTURE budget (reference = 8) while today is month 6.
        let occurrences = [occ(month: 5, amount: 100), occ(month: 7, amount: 100)]
        let items = makeItems(occurrences, ref: 8, live: 6)
        let allPast = items.allSatisfy(\.isPast)
        #expect(allPast)            // both precede the viewed month 8
        #expect(items[0].isClosed)  // 5 genuinely elapsed vs today (6)
        #expect(!items[1].isClosed) // 7 has not
    }

    // MARK: - buildTracker

    @Test func buildTracker_returnsNil_forEmpty() {
        #expect(SpreadProgress.buildTracker(from: []) == nil)
    }

    @Test func buildTracker_currentIndex_countsPastAndCurrent() {
        let result = tracker((5...7).map { occ(month: $0, amount: 100) }, ref: 6, live: 6)
        #expect(result?.count == 3)
        #expect(result?.currentIndex == 2)
    }

    @Test func buildTracker_currentIndexZero_whenViewedPrecedesAll() {
        let occurrences = [occ(month: 6, amount: 100), occ(month: 7, amount: 100)]
        #expect(tracker(occurrences, ref: 4, live: 4)?.currentIndex == 0)
    }

    @Test func buildTracker_total_isSumOfAllAmounts() {
        let occurrences = (1...4).map { occ(month: $0, amount: 100) }
        #expect(tracker(occurrences, ref: 2, live: 2)?.totalAmount == 400)
    }

    @Test func buildTracker_cumulated_sumsRealizedOverClosedOrChecked() {
        // Today = month 6.
        let occurrences = [
            occ(month: 4, amount: 100, consumed: 120, transactionCount: 1), // closed + realized → 120
            occ(month: 5, amount: 100),                                      // closed, no tx → prévu 100
            occ(month: 6, amount: 100),                                      // current → excluded
            occ(month: 7, amount: 100, checkedAt: Date()),                   // future but pointé → prévu 100
            occ(month: 8, amount: 100),                                      // future → excluded
        ]
        let result = tracker(occurrences, ref: 6, live: 6)
        #expect(result?.cumulatedAmount == 320)
        #expect(result?.totalAmount == 500)
    }

    @Test func buildTracker_realizedUsesConsumed_onlyWhenTransactionsExist() {
        // Closed month with 0 transactions → prévu (100), not consumed (0).
        let occurrences = [occ(month: 4, amount: 100, consumed: 0, transactionCount: 0)]
        #expect(tracker(occurrences, ref: 6, live: 6)?.cumulatedAmount == 100)
    }

    @Test func buildTracker_progressPercent_isCumulatedOverTotalClamped() {
        let occurrences = (4...7).map { occ(month: $0, amount: 100) } // 4,5 closed vs live 6
        #expect(tracker(occurrences, ref: 6, live: 6)?.progressPercent == 50)
    }

    @Test func buildTracker_perMonth_isCurrentAmount_elseLast() {
        let withCurrent = [occ(month: 5, amount: 100), occ(month: 6, amount: 222), occ(month: 7, amount: 100)]
        #expect(tracker(withCurrent, ref: 6, live: 6)?.perMonthAmount == 222)

        let noCurrent = [occ(month: 5, amount: 100), occ(month: 6, amount: 100), occ(month: 7, amount: 333)]
        #expect(tracker(noCurrent, ref: 2, live: 2)?.perMonthAmount == 333)
    }

    // MARK: - PUL-290 reste à provisionner (parity with the web view-model spec)

    @Test func buildTracker_perRemainingMonth_growsToCoverAnUnderProvisionedMonth() {
        // 300 / 3, mois 2 réalisé 50 → reste 150, le mois restant doit prévoir 150.
        let occurrences = [
            occ(month: 5, amount: 100),
            occ(month: 6, amount: 100, consumed: 50, transactionCount: 2),
            occ(month: 7, amount: 100),
        ]
        // live = July → May & June closed (réalisé 100 + 50 = 150), July open.
        let result = tracker(occurrences, ref: 6, live: 7)
        #expect(result?.remainingToProvision == 150)
        #expect(result?.perRemainingMonth == 150)
    }

    @Test func buildTracker_objectifAtteint_remainingZero_perRemainingNil() {
        let occurrences = [occ(month: 5, amount: 100), occ(month: 6, amount: 100)]
        // live = December → both closed, réalisé = prévu = 200 = total.
        let result = tracker(occurrences, ref: 6, live: 12)
        #expect(result?.remainingToProvision == 0)
        #expect(result?.perRemainingMonth == nil)
    }

    @Test func buildTracker_finalGap_allClosedButUnderProvisioned_perRemainingNil() {
        let occurrences = [
            occ(month: 5, amount: 100, consumed: 60, transactionCount: 1),
            occ(month: 6, amount: 100),
        ]
        // live = December → both closed; réalisé = 60 (consumed) + 100 (prévu) = 160.
        let result = tracker(occurrences, ref: 6, live: 12)
        #expect(result?.remainingToProvision == 40)
        #expect(result?.perRemainingMonth == nil)
    }

    @Test func buildTracker_pointeeOpenMonth_isExcludedFromDivisor() {
        let occurrences = [
            occ(month: 6, amount: 100, checkedAt: Date()), // current + pointé → réalisé, NOT a divisor slot
            occ(month: 7, amount: 100),                    // open → the only divisor slot
        ]
        // live = June → June current (not closed) but pointée; only July is open → 100 / 1.
        let result = tracker(occurrences, ref: 6, live: 6)
        #expect(result?.cumulatedAmount == 100)
        #expect(result?.remainingToProvision == 100)
        #expect(result?.perRemainingMonth == 100)
    }
}
