import Foundation
import Testing

/// Structural invariants for the home screen's "Activité" card.
///
/// PR #685 rebuilt this card on a `List` for `.swipeActions` and shipped rows bleeding to
/// both edges of the display over a transparent cell: the app compiled, the tests stayed
/// green, and a screenshotless CI saw nothing. A hand-rolled swipe followed and never
/// rendered like the system's. The card is a card of tappable rows now, and these tests
/// walk the source on disk to fail loud the next time either comes back.
@Suite("Home activity card structure")
struct HomeActivityCardArchitectureTests {
    /// This file lives in `<repo>/ios/PulpeTests/Architecture/`, so `ios/` is three
    /// levels up. Resolved from `#filePath` to work on dev machines and CI alike.
    private static var activityCard: URL {
        URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .appendingPathComponent("Pulpe/Features/CurrentMonth/Components/ActivityCard.swift")
    }

    private static func source() throws -> String {
        try String(contentsOf: activityCard, encoding: .utf8)
    }

    @Test("A day group sits on the shared row card")
    func dayGroupCarriesItsOwnSurface() throws {
        let source = try Self.source()
        // Opaque, rounded, inset — the boundary that tells a row apart from the page.
        #expect(source.contains("pulpeRowCard()"))
        // Each of these silently widens a row to the full display and drops its
        // background, because the enclosing ScrollView has no list to inset it.
        for modifier in ["listRowInsets", "listRowBackground", "listRowSeparator", "listStyle"] {
            #expect(!source.contains(modifier), "\(modifier) has no meaning outside a List")
        }
    }

    @Test("A row opens its page on a tap and says so with a chevron")
    func rowIsATapTarget() throws {
        let source = try Self.source()
        // Whitespace-tolerant: a reformatted closure must not let this pass on nothing.
        #expect(source.range(of: #"Button \{\s*onEdit\(transaction\)\s*\}"#, options: .regularExpression) != nil)
        #expect(source.contains("RowChevron()"))
        #expect(source.contains("accessibilityHint(\"Touche pour modifier\")"))
    }

    @Test("Nothing swipes and nothing deletes on the home")
    func noSwipeAndNoDeletion() throws {
        let source = try Self.source()
        // `.swipeActions` only resolves inside a List, and a pan of our own never painted
        // like the system's; each took the card away once.
        for gesture in [".swipeActions(", "trailingSwipeActions(", "HorizontalPanGesture", "DragGesture"] {
            #expect(!source.contains(gesture), "\(gesture) brings the swipe back")
        }
        // Deleting lives on the operation's page, behind its own undo toast.
        #expect(!source.contains("onDelete"))
        #expect(!source.contains(".alert("))
    }
}
