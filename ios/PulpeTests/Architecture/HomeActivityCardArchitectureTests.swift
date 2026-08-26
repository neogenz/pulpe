import Foundation
import Testing

/// Structural invariants for the home screen's "Activité" card.
///
/// PR #685 rebuilt this card on a `List` with `listRowInsets` and a transparent
/// `listRowBackground`, and deleted the shared swipe component in the process.
/// Nothing failed: the app compiled, the tests stayed green, and the screen
/// shipped with its rows bleeding to both edges of the display and the hero's
/// green showing through the gaps where the card used to be.
///
/// The home is a `ScrollView`, so a row here carries its own surface. These
/// tests walk the source on disk and fail loud the next time that surface is
/// traded for list chrome — the one thing a screenshotless CI cannot see.
@Suite("Home activity card structure")
struct HomeActivityCardArchitectureTests {
    // MARK: - Sources

    /// This file lives in `<repo>/ios/PulpeTests/Architecture/`, so `ios/` is
    /// three levels up. Resolved from `#filePath` to work on dev machines and
    /// CI alike, as long as the repository layout is intact at test time.
    private static func iosDirectory() -> URL {
        URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .deletingLastPathComponent()
    }

    private static var activityCard: URL {
        iosDirectory()
            .appendingPathComponent("Pulpe/Features/CurrentMonth/Components/ActivityCard.swift")
    }

    private static var swipeComponent: URL {
        iosDirectory()
            .appendingPathComponent("Pulpe/Shared/Components/TrailingSwipeActions.swift")
    }

    private static func read(_ url: URL) throws -> String {
        try String(contentsOf: url, encoding: .utf8)
    }

    // MARK: - The card owns its surface

    @Test("A day group sits on the shared row card")
    func dayGroupCarriesItsOwnSurface() throws {
        let source = try Self.read(Self.activityCard)
        // Opaque, rounded, inset — the boundary that tells a row apart from the
        // page it scrolls over.
        #expect(source.contains("pulpeRowCard()"))
    }

    @Test("The card never borrows List chrome")
    func noListRowModifiers() throws {
        let source = try Self.read(Self.activityCard)
        // Each of these silently widens a row to the full display and drops its
        // background, because the enclosing ScrollView has no list to inset it.
        for modifier in ["listRowInsets", "listRowBackground", "listRowSeparator", "listStyle"] {
            #expect(!source.contains(modifier), "\(modifier) has no meaning outside a List")
        }
    }

    // MARK: - The swipe stays the shared one

    @Test("Rows swipe through the shared component")
    func swipeGoesThroughTrailingSwipeActions() throws {
        let source = try Self.read(Self.activityCard)
        #expect(source.contains("trailingSwipeActions("))
        // `.swipeActions` only resolves inside a List. Reaching for it here is
        // the exact move that took the card away.
        #expect(!source.contains(".swipeActions("))
    }

    @Test("The shared swipe component is still on disk")
    func swipeComponentExists() throws {
        let path = Self.swipeComponent.path
        try #require(
            FileManager.default.fileExists(atPath: path),
            "TrailingSwipeActions.swift missing at \(path)"
        )
        let source = try Self.read(Self.swipeComponent)
        // The pan bridge is what lets a horizontal pull decline to the scroll
        // view; a plain DragGesture cannot, and the home scroll dies with it.
        #expect(source.contains("HorizontalPanGesture"))
    }

    // MARK: - Deleting asks first

    @Test("Deletion opens a question instead of acting")
    func deleteAsksBeforeItActs() throws {
        let source = try Self.read(Self.activityCard)
        // The destructive button arms the alert; only the alert's own button
        // calls onDelete. Wiring it straight to the button deletes on tap.
        #expect(source.contains("pendingDeletion = transaction"))
        #expect(source.contains(".alert("))
    }
}
