@testable import Pulpe
import Testing

@Suite("ToPointPresentation")
struct ToPointPresentationTests {
    @Test func pointedNow_requiresPointedHereAndStillChecked() {
        #expect(ToPointPresentation.isPointedNow(pointedHere: ["a"], id: "a", isChecked: true))
        // Un-pointed or undone: the row is no longer checked.
        #expect(!ToPointPresentation.isPointedNow(pointedHere: ["a"], id: "a", isChecked: false))
        #expect(!ToPointPresentation.isPointedNow(pointedHere: [], id: "a", isChecked: true))
    }
}
