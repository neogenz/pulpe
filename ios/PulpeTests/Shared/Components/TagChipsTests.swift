@testable import Pulpe
import Testing

@Suite("TagChips Tests")
@MainActor
struct TagChipsTests {
    @Test("The rail limits visible chips and exposes the overflow count")
    func visibleSummary() {
        let chips = TagChips(names: ["A", "B", "C"], maxVisible: 2)

        #expect(Array(chips.visibleNames) == ["A", "B"])
        #expect(chips.hiddenCount == 1)
    }

    @Test("The full rail has no overflow")
    func fullRail() {
        let chips = TagChips(names: ["A", "B"])

        #expect(Array(chips.visibleNames) == ["A", "B"])
        #expect(chips.hiddenCount == 0)
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
