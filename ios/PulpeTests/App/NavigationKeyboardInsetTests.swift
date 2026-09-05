import Foundation
import Testing

/// Every navigation screen either refuses a foreign keyboard inset or owns the field
/// that raises one. Nothing in between, and nothing left undecided.
///
/// Two screens pushed on the same `NavigationStack` share its bottom safe-area inset.
/// When the keyboard closes during a pop, the deflated inset reaches the screen that is
/// leaving and never the one coming back — the parent keeps a dead band one keyboard
/// tall. That band has been filed five times under five names, because the remedy was
/// re-decided per screen instead of once for the inventory. This suite is that
/// inventory: adding a destination without ruling on it fails here, by name.
///
/// The reading is textual, not a Swift parse. A renamed file must therefore break this
/// suite rather than empty it, which is what `sourcesAreReadable` is for: a detector
/// that scans nothing otherwise reports a clean bill of health.
@Suite("Navigation keyboard inset inventory")
struct NavigationKeyboardInsetTests {
    /// A navigation screen and what it does about the stack's keyboard inset.
    private enum Rule {
        /// Owns no inline field, so it must carry `ignoresForeignKeyboardInset()`.
        case resets
        /// Raises the keyboard itself and needs the inset it raises.
        case ownsAField
    }

    /// The whole inventory, stated once. A screen missing here fails the suite.
    private static let expected: [String: Rule] = [
        "CurrentMonthView": .resets,
        "SavingsGoalsListView": .resets,
        "SavingsGoalDetailView": .resets,
        "BudgetListView": .resets,
        "BudgetDetailsView": .resets,
        "TemplateListView": .resets,
        "TemplateDetailsView": .resets,
        "BudgetLineDetailPage": .resets,
        "EditTransactionHost": .ownsAField,
        "EditTransactionPage": .ownsAField,
        "AddAllocatedTransactionPage": .ownsAField,
    ]

    /// The two files where a navigation screen is composed onto a stack. The modifier
    /// belongs at these call sites and nowhere else: from here it wraps a screen's whole
    /// chain, overlays included, so it cannot be defeated by modifier order the way an
    /// in-body spelling was in PUL-284.
    private static let compositionFiles = [
        "Pulpe/App/MainTabView.swift",
        "Pulpe/Features/Budgets/BudgetDetails/BudgetDetailsView+Routing.swift",
    ]

    private static func iosRoot() -> URL {
        // This file lives in <repo>/ios/PulpeTests/App/.
        URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .deletingLastPathComponent()
    }

    private static func read(_ relativePath: String) -> String {
        let url = iosRoot().appendingPathComponent(relativePath)
        return (try? String(contentsOf: url, encoding: .utf8)) ?? ""
    }

    /// The screens each composition file constructs, in source order, each paired with
    /// the text that follows its construction up to the next screen.
    private static func inventory() -> [(screen: String, trailing: String)] {
        let sources = compositionFiles.map(read).joined(separator: "\n")
        var found: [(String, String)] = []
        for screen in expected.keys.sorted() {
            var searchRange = sources.startIndex..<sources.endIndex
            while let hit = sources.range(of: "\(screen)(", range: searchRange) {
                // Everything up to the next screen construction is this one's chain.
                let tailStart = hit.upperBound
                var tailEnd = sources.endIndex
                for other in expected.keys where other != screen {
                    if let next = sources.range(of: "\(other)(", range: tailStart..<sources.endIndex),
                       next.lowerBound < tailEnd {
                        tailEnd = next.lowerBound
                    }
                }
                found.append((screen, String(sources[tailStart..<tailEnd])))
                searchRange = hit.upperBound..<sources.endIndex
            }
        }
        return found
    }

    /// Runs before every other assertion: a scan that read nothing would otherwise
    /// satisfy each rule below vacuously and report the invariant as held.
    @Test("Composition sources are readable and name every expected screen")
    func sourcesAreReadable() {
        for path in Self.compositionFiles {
            #expect(!Self.read(path).isEmpty, "Unreadable composition source: \(path)")
        }
        let screens = Set(Self.inventory().map(\.screen))
        #expect(
            screens.count >= Self.expected.count,
            "Scanned \(screens.count) screens, expected at least \(Self.expected.count)"
        )
        for screen in Self.expected.keys {
            #expect(screens.contains(screen), "\(screen) is no longer composed in the scanned files")
        }
    }

    @Test("Every screen without an inline field refuses a foreign keyboard inset")
    func resettingScreensCarryTheModifier() {
        for entry in Self.inventory() where Self.expected[entry.screen] == .resets {
            let why = "\(entry.screen) is composed without ignoresForeignKeyboardInset() — "
                + "it owns no field, so it must refuse the stack's inset"
            #expect(entry.trailing.contains(".ignoresForeignKeyboardInset()"), "\(why)")
        }
    }

    @Test("A screen that owns its field keeps the inset it raises")
    func fieldOwningScreensStayBare() {
        for entry in Self.inventory() where Self.expected[entry.screen] == .ownsAField {
            let why = "\(entry.screen) owns an inline field — refusing the keyboard inset "
                + "would put its own keyboard over its content"
            #expect(!entry.trailing.contains(".ignoresForeignKeyboardInset()"), "\(why)")
        }
    }

    /// One spelling, one definition. The three that came before it — a raw modifier in a
    /// view body, a `avoidsKeyboard` flag on the sticky CTA, and nothing at all — are why
    /// the same bug shipped five times.
    @Test("The remedy has exactly one definition")
    func remedyHasOneSpelling() {
        let root = Self.iosRoot().appendingPathComponent("Pulpe")
        guard let files = FileManager.default.enumerator(at: root, includingPropertiesForKeys: nil) else {
            Issue.record("Could not walk \(root.path)")
            return
        }
        var sites: [String] = []
        for case let url as URL in files where url.pathExtension == "swift" {
            guard let source = try? String(contentsOf: url, encoding: .utf8) else { continue }
            #expect(!source.contains("avoidsKeyboard"), "\(url.lastPathComponent) revives the avoidsKeyboard spelling")
            if source.contains("ignoresSafeArea(.keyboard") { sites.append(url.lastPathComponent) }
        }
        #expect(sites == ["View+Extensions.swift"], "Raw keyboard-inset resets outside the shared modifier: \(sites)")
    }
}
