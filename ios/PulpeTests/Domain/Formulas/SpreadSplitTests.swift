import Foundation
@testable import Pulpe
import Testing

/// PUL-17 v1.1 — the iOS mirror of `shared/src/calculators/spread-split.spec.ts`.
///
/// `SpreadSplit.splitTotalPreserving` is the LIVE-preview half of the dual-mode
/// spread: the server is authoritative, but the preview must equal what gets
/// persisted. These tests lock the invariants 1:1 with the TS source of truth —
/// Σ parts === total to the cent, remainder cents on the FIRST parts (M0 first),
/// non-increasing parts — so the two implementations can never drift.
@Suite("SpreadSplit.splitTotalPreserving")
struct SpreadSplitTests {
    /// Decimal literal from a string — never nil for these test inputs.
    private func dec(_ value: String) -> Decimal {
        Decimal(string: value) ?? 0
    }

    /// Sum of the parts back in integer cents — the exact-conservation oracle.
    private func sumCents(_ parts: [Decimal]) -> Int {
        parts.reduce(0) { $0 + NSDecimalNumber(decimal: ($1 * 100).rounded(0, .plain)).intValue }
    }

    private func isNonIncreasing(_ parts: [Decimal]) -> Bool {
        zip(parts, parts.dropFirst()).allSatisfy { $0 >= $1 }
    }

    // MARK: - Even split

    @Test
    func splitsEvenly_whenDivisible() {
        #expect(SpreadSplit.splitTotalPreserving(total: 800, partCount: 8)
            == [100, 100, 100, 100, 100, 100, 100, 100])
    }

    // MARK: - Remainder lands on the first parts

    @Test
    func putsRemainderCentsOnTheFirstParts() {
        let parts = SpreadSplit.splitTotalPreserving(total: 800, partCount: 3)
        #expect(parts == [dec("266.67"), dec("266.67"), dec("266.66")])
    }

    @Test
    func preservesTotalToTheCent_for1000Over6() {
        let parts = SpreadSplit.splitTotalPreserving(total: 1000, partCount: 6)
        #expect(parts == [
            dec("166.67"), dec("166.67"), dec("166.67"),
            dec("166.67"), dec("166.66"), dec("166.66"),
        ])
    }

    @Test
    func preservesTotalToTheCent_for100Over7() throws {
        let parts = SpreadSplit.splitTotalPreserving(total: 100, partCount: 7)
        #expect(parts.count == 7)
        #expect(sumCents(parts) == 10_000)
        let first = try #require(parts.first)
        let last = try #require(parts.last)
        #expect(first >= last)
    }

    // MARK: - Single part

    @Test
    func handlesASinglePart() {
        #expect(SpreadSplit.splitTotalPreserving(total: dec("42.5"), partCount: 1) == [dec("42.5")])
    }

    // MARK: - Guards (return [] instead of throwing — preview tolerance)

    @Test
    func returnsEmpty_forNonPositiveTotal() {
        #expect(SpreadSplit.splitTotalPreserving(total: 0, partCount: 3).isEmpty)
        #expect(SpreadSplit.splitTotalPreserving(total: -10, partCount: 3).isEmpty)
    }

    @Test
    func returnsEmpty_forInvalidPartCount() {
        #expect(SpreadSplit.splitTotalPreserving(total: 100, partCount: 0).isEmpty)
        #expect(SpreadSplit.splitTotalPreserving(total: 100, partCount: -1).isEmpty)
    }

    // MARK: - Invariant sweep (mirrors the TS it.each)

    @Test("Σ === total to the cent and remainder lands on the first parts", arguments: [
        (Decimal(string: "100.01") ?? 0, 3),
        (Decimal(string: "1234.56") ?? 0, 7),
        (Decimal(string: "999.99") ?? 0, 36),
        (Decimal(10_000), 36),
        (Decimal(string: "50.05") ?? 0, 13),
    ])
    func splitsArbitraryTotals_preservingSumAndOrdering(total: Decimal, partCount: Int) {
        let parts = SpreadSplit.splitTotalPreserving(total: total, partCount: partCount)
        let expectedCents = NSDecimalNumber(decimal: (total * 100).rounded(0, .plain)).intValue

        #expect(parts.count == partCount)
        #expect(sumCents(parts) == expectedCents)
        #expect(isNonIncreasing(parts))
    }
}
