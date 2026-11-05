import Foundation
@testable import Pulpe
import Testing

@MainActor
@Suite("Pointing a prévision: the confirmation message")
struct CheckAllConfirmationTests {
    @Test("One movement left to point is named, the pointed ones are not counted")
    func namesTheOnlyPendingMovement() {
        let message = CheckAllConfirmation.message(
            lineName: "Courses",
            movements: [
                TestDataFactory.createTransaction(id: "a", name: "Migros", amount: 84.30),
                TestDataFactory.createTransaction(id: "b", name: "Coop", amount: 112.40, isChecked: true),
            ],
            currency: .chf,
            amountsHidden: false
        )

        #expect(message.contains("Courses"))
        #expect(message.contains("Migros"))
        #expect(message.contains("84"))
        #expect(!message.contains("Coop"))
    }

    @Test("Several movements left are counted, not listed")
    func countsSeveralPendingMovements() {
        let message = CheckAllConfirmation.message(
            lineName: "Courses",
            movements: [
                TestDataFactory.createTransaction(id: "a", name: "Migros"),
                TestDataFactory.createTransaction(id: "b", name: "Coop"),
            ],
            currency: .chf,
            amountsHidden: false
        )

        #expect(message.contains("2"))
        #expect(!message.contains("Migros"))
    }

    @Test("A hidden amount stays hidden in the message")
    func hidesTheAmount() {
        let message = CheckAllConfirmation.message(
            lineName: "Courses",
            movements: [TestDataFactory.createTransaction(name: "Migros", amount: 84.30)],
            currency: .chf,
            amountsHidden: true
        )

        #expect(!message.contains("84"))
    }
}
