@testable import Pulpe
import Testing

@Suite("TagChips Tests")
@MainActor
struct TagChipsTests {
    @Test("The compact presentation exposes one icon-and-count indicator")
    func compactIndicator() {
        let chips = TagChips(names: ["A", "B", "C"], presentation: .count)

        #expect(chips.presentation == .count)
        #expect(chips.countLabel == "3")
        #expect(chips.accessibilityLabel == "Tags : A, B, C")
    }

    @Test("The full rail keeps every tag name")
    func fullRail() {
        let chips = TagChips(names: ["A", "B"])

        #expect(chips.presentation == .names)
        #expect(chips.accessibilityLabel == "Tags : A, B")
    }

    @Test("Names resolve in server order and stale ids are ignored")
    func resolvedNames() {
        let names = TagChips.names(
            for: ["tag-2", "missing", "tag-1"],
            namesById: ["tag-1": "Courses", "tag-2": "Vacances"]
        )

        #expect(names == ["Vacances", "Courses"])
    }
}
