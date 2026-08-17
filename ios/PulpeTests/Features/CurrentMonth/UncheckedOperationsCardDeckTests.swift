import Foundation
@testable import Pulpe
import Testing

/// Pure id/index arithmetic behind `UncheckedOperationsCard`'s deck. `DeckSlot` and
/// `DeckCycle` are id-level, so these run without constructing `CheckableItem`s.
struct UncheckedOperationsCardDeckTests {
    // MARK: - DeckSlot

    @Test func wrapId_roundTripsToTheRealIdItMirrors() {
        let leading = DeckSlot.wrapId(for: "tx-1", at: .leading)
        let trailing = DeckSlot.wrapId(for: "tx-1", at: .trailing)

        #expect(leading == "wrap-leading-tx-1")
        #expect(trailing == "wrap-trailing-tx-1")
        #expect(DeckSlot.realId(fromWrapId: leading) == "tx-1")
        #expect(DeckSlot.realId(fromWrapId: trailing) == "tx-1")
    }

    @Test func realId_isNilForAnIdThatIsNotAWrapCopy() {
        #expect(DeckSlot.realId(fromWrapId: "tx-1") == nil)
    }

    // MARK: - DeckCycle.successorId

    @Test func successorId_targetsTheNextCardAtTheSameIndex() {
        #expect(DeckCycle.successorId(after: "a", in: ["a", "b", "c"]) == "b")
    }

    @Test func successorId_wrapsForwardWhenTheConfirmedCardWasLast() {
        // Confirming the last card has nothing left at its own index, so the handover
        // targets the wrap copy of the new first card — the same direction a turn makes.
        let successor = DeckCycle.successorId(after: "c", in: ["a", "b", "c"])
        #expect(successor == DeckSlot.wrapId(for: "a", at: .trailing))
    }

    @Test func successorId_isNilWhenConfirmingTheOnlyCard() {
        #expect(DeckCycle.successorId(after: "a", in: ["a"]) == nil)
    }

    @Test func successorId_isNilWhenTheConfirmedIdIsNotInTheList() {
        #expect(DeckCycle.successorId(after: "z", in: ["a", "b"]) == nil)
    }

    // MARK: - DeckCycle.focusedId

    @Test func focusedId_resolvesTheLeadingMiddleAndTrailingCycles() {
        let cards = ["a", "b"]

        #expect(DeckCycle.focusedId(atFlatIndex: 0, cards: cards) == DeckSlot.wrapId(for: "a", at: .leading))
        #expect(DeckCycle.focusedId(atFlatIndex: 3, cards: cards) == "b")
        #expect(DeckCycle.focusedId(atFlatIndex: 5, cards: cards) == DeckSlot.wrapId(for: "b", at: .trailing))
    }

    // MARK: - DeckCycle.renderedSlotIds

    @Test func renderedSlotIds_hasNoWrapCopiesUnderTwoCards() {
        #expect(DeckCycle.renderedSlotIds(for: ["a"]) == ["a"])
        #expect(DeckCycle.renderedSlotIds(for: []) == [])
    }

    @Test func renderedSlotIds_framesTwoOrMoreCardsWithALeadingAndTrailingCycle() {
        let ids = DeckCycle.renderedSlotIds(for: ["a", "b"])
        #expect(ids == [
            DeckSlot.wrapId(for: "a", at: .leading), DeckSlot.wrapId(for: "b", at: .leading),
            "a", "b",
            DeckSlot.wrapId(for: "a", at: .trailing), DeckSlot.wrapId(for: "b", at: .trailing),
        ])
    }

    // MARK: - DeckCycle.reconciledScrolledId — the 2 → 1 collapse (review 🔴)

    @Test func reconciledScrolledId_fallsBackToTheFirstCardWhenTheCollapseOrphansTheFocus() {
        // Two cards ["a", "b"], "a" gets confirmed and drops out mid-transaction: `scrolledId`
        // is still "a" but the deck has settled on a single real card, "b" — with no wrap
        // copy of "a" left to rebase onto. Before the fix this stranded focus dead, killing
        // both buttons on the only remaining card.
        let reconciled = DeckCycle.reconciledScrolledId(current: "a", ids: ["b"])
        #expect(reconciled == "b")
    }

    @Test func reconciledScrolledId_leavesAStillRenderedIdUntouched() {
        #expect(DeckCycle.reconciledScrolledId(current: "b", ids: ["a", "b"]) == "b")
        // A wrap copy of a still-live card is also a rendered slot once two-or-more cards
        // are back in play.
        let wrap = DeckSlot.wrapId(for: "a", at: .leading)
        #expect(DeckCycle.reconciledScrolledId(current: wrap, ids: ["a", "b"]) == wrap)
    }

    @Test func reconciledScrolledId_passesThroughANilCurrent() {
        #expect(DeckCycle.reconciledScrolledId(current: nil, ids: ["a"]) == nil)
    }

    @Test func reconciledScrolledId_fallsBackToNilWhenTheDeckEmptiesEntirely() {
        #expect(DeckCycle.reconciledScrolledId(current: "a", ids: []) == nil)
    }
}
