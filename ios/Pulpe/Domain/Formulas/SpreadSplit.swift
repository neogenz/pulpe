import Foundation

/// Total-preserving spread split (PUL-17 v1.1) — the iOS mirror of the shared TS
/// source of truth (`shared/src/calculators/spread-split.ts`).
///
/// Splits a `total` into N parts whose sum equals `total` to the cent. The math
/// runs in integer cents (Decimal, never Double) so no rounding drift leaks: the
/// remainder cents land on the FIRST parts (index 0 = M0 = current month first),
/// never the last — the sum is exact AND M0 is never artificially lightened.
///
/// iOS divides only for the LIVE preview; the server is the authoritative writer.
/// Keeping this 1:1 with the TS guarantees the preview equals what gets persisted.
enum SpreadSplit {
    private static let centsPerUnit = 100

    /// Splits `total` into `partCount` amounts whose sum equals `total` to the cent.
    /// Returns `[]` for a non-positive total or `partCount < 1` (the preview just
    /// shows nothing rather than crashing on transient invalid input).
    static func splitTotalPreserving(total: Decimal, partCount: Int) -> [Decimal] {
        guard total > 0, partCount >= 1 else { return [] }

        let totalCents = NSDecimalNumber(
            decimal: (total * Decimal(centsPerUnit)).rounded(0, .plain)
        ).intValue
        let baseCents = totalCents / partCount
        let remainderCents = totalCents - baseCents * partCount

        return (0..<partCount).map { index in
            let cents = baseCents + (index < remainderCents ? 1 : 0)
            return Decimal(cents) / Decimal(centsPerUnit)
        }
    }
}
