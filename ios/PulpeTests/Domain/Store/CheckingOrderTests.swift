@testable import Pulpe
import Testing

struct CheckingOrderTests {
    @Test func dueBeforeUnknownBeforeLater() {
        let order = ["later": 25, "due": 5, "today": 10]
        let result = ["unknown", "later", "today", "due"].sorted {
            CheckingOrder.rank(expectedDay: order[$0], today: 10)
                < CheckingOrder.rank(expectedDay: order[$1], today: 10)
        }
        #expect(result == ["due", "today", "unknown", "later"])
    }

    @Test func laterBecomesDueAsThePeriodAdvances() {
        #expect(CheckingOrder.rank(expectedDay: 25, today: 10) > CheckingOrder.rank(expectedDay: nil, today: 10))
        #expect(CheckingOrder.rank(expectedDay: 25, today: 25) < CheckingOrder.rank(expectedDay: nil, today: 25))
    }
}
