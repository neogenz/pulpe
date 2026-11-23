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

    // Same 42.00 for the purchase and its refund: only the `+` tells them apart.
    @Test func amountText_keepsThePlusOfAnIncomeOnly() {
        #expect(PointRow.amountText("42.00", isIncome: true) == "+42.00")
        #expect(PointRow.amountText("42.00", isIncome: false) == "42.00")
    }
}
