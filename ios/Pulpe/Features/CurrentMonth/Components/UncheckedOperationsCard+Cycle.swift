import Foundation

/// Pure id and index arithmetic behind `UncheckedOperationsCard`'s deck, split out of the
/// view so the cycle math — the successor after a confirm, the focus slot under a given
/// scroll index, whether a resting id still names a rendered slot — is testable without a
/// live `ScrollView`. The view still owns *when* these run and the `@State` they feed.
enum DeckCycle {
    /// Where the deck should land once `confirmedId` leaves the list: the item at the same
    /// index once removed, or the wrap copy of the first item when the confirmed card was
    /// last — the same wrap-forward the deck's own "Plus tard" turn makes.
    static func successorId(after confirmedId: String, in ids: [String]) -> String? {
        let rest = ids.filter { $0 != confirmedId }
        guard let idx = ids.firstIndex(of: confirmedId), !rest.isEmpty else { return nil }
        return idx < rest.count ? rest[idx] : DeckSlot.wrapId(for: rest[0], at: .trailing)
    }

    /// The slot id under the viewport's centre, given a flat index into three concatenated
    /// cycles of `cards.count` real ids (see `UncheckedOperationsCard.deckSlots`). Callers
    /// only invoke this once `cards` is known non-empty.
    static func focusedId(atFlatIndex index: Int, cards: [String]) -> String {
        let item = cards[index % cards.count]
        return switch index / cards.count {
        case 0: DeckSlot.wrapId(for: item, at: .leading)
        case 1: item
        default: DeckSlot.wrapId(for: item, at: .trailing)
        }
    }

    /// The ids of every rendered slot for a set of cards — the same before/real/after shape
    /// as `UncheckedOperationsCard.deckSlots`, at id granularity: no wrap copies under two
    /// cards, a full leading+real+trailing cycle from two up.
    static func renderedSlotIds(for ids: [String]) -> [String] {
        guard ids.count > 1 else { return ids }
        return ids.map { DeckSlot.wrapId(for: $0, at: .leading) }
            + ids
            + ids.map { DeckSlot.wrapId(for: $0, at: .trailing) }
    }

    /// What `scrolledId` should become once `displayItems` settles on `ids`: unchanged if it
    /// still names a rendered slot, otherwise the deck's first card. Covers the 2 → 1
    /// collapse, where confirming the second-to-last card leaves `scrolledId` on the id that
    /// just left the list, with no wrap copy of it left to rebase onto.
    static func reconciledScrolledId(current: String?, ids: [String]) -> String? {
        guard let current, !renderedSlotIds(for: ids).contains(current) else { return current }
        return ids.first
    }
}
