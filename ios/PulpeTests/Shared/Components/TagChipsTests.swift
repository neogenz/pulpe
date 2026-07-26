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
    }
}
