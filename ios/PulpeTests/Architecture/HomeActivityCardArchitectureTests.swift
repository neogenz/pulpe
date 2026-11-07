import Foundation
import Testing

/// Structural invariants for the home's « Derniers mouvements » section and its rows.
///
/// PR #685 rebuilt the card on a `List` for `.swipeActions` and shipped rows bleeding to
/// both edges of the display over a transparent cell. The section is a card of tappable
/// rows; these tests walk the source on disk to fail loud when either comes back.
@Suite("Home recent movements structure")
struct HomeActivityCardArchitectureTests {
    /// This file lives in `<repo>/ios/PulpeTests/Architecture/`, so `ios/` is two levels up.
    private static func source(_ path: String) throws -> String {
        let url = URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .appendingPathComponent(path)
        return try String(contentsOf: url, encoding: .utf8)
    }

    private static let rowFiles = [
        "Pulpe/Shared/Components/MovementRow.swift",
        "Pulpe/Features/CurrentMonth/Components/RecentMovementsSection.swift",
    ]

    @Test("A day group sits on the shared surface card")
    func dayGroupCarriesItsOwnSurface() throws {
        #expect(try Self.source(Self.rowFiles[0]).contains("pulpeSurfaceCard()"))
        for file in Self.rowFiles {
            let source = try Self.source(file)
            // Each of these silently widens a row to the full display outside a List.
            for modifier in ["listRowInsets", "listRowBackground", "listRowSeparator", "listStyle"] {
                #expect(!source.contains(modifier), "\(modifier) has no meaning outside a List")
            }
        }
    }

    @Test("A row opens its sheet on a tap and says so")
    func rowIsATapTarget() throws {
        let source = try Self.source(Self.rowFiles[0])
        #expect(source.range(of: #"Button\(action: onOpen\)"#, options: .regularExpression) != nil)
        #expect(source.contains("RowChevron()"))
        #expect(source.contains("accessibilityHint(\"Touche pour modifier\")"))
    }

    @Test("Nothing swipes and nothing deletes on the home")
    func noSwipeAndNoDeletion() throws {
        for file in Self.rowFiles {
            let source = try Self.source(file)
            for gesture in [".swipeActions(", "trailingSwipeActions(", "HorizontalPanGesture", "DragGesture"] {
                #expect(!source.contains(gesture), "\(gesture) brings the swipe back")
            }
            #expect(!source.contains("onDelete"))
            #expect(!source.contains(".alert("))
        }
    }
}
