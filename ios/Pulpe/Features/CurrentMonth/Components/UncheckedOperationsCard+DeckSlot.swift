import Foundation

/// One pane of `UncheckedOperationsCard`'s deck. A real slot is an operation under its
/// own id; a wrap slot is a copy of an operation pinned past the opposite end, so a
/// swipe beyond either edge keeps turning — into the deck starting over.
struct DeckSlot: Identifiable {
    enum WrapEdge: String {
        case leading, trailing
    }

    let id: String
    let item: CurrentMonthStore.CheckableItem
    let isReal: Bool

    init(real item: CurrentMonthStore.CheckableItem) {
        id = item.id
        self.item = item
        isReal = true
    }

    init(wrapCopyOf item: CurrentMonthStore.CheckableItem, past edge: WrapEdge) {
        id = Self.wrapId(for: item.id, at: edge)
        self.item = item
        isReal = false
    }

    static func wrapId(for itemId: String, at edge: WrapEdge) -> String {
        "wrap-\(edge.rawValue)-\(itemId)"
    }

    /// The real card a wrap slot stands in for — nil when the id is a real slot's.
    static func realId(fromWrapId id: String) -> String? {
        for edge in [WrapEdge.leading, .trailing] {
            let prefix = "wrap-\(edge.rawValue)-"
            if id.hasPrefix(prefix) { return String(id.dropFirst(prefix.count)) }
        }
        return nil
    }
}
