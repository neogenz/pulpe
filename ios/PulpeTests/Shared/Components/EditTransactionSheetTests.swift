import Foundation
@testable import Pulpe
import Testing

@Suite
@MainActor
struct EditTransactionSheetTests {
    // MARK: - Dependencies

    @Test
    func dependencies_updateTransaction_passesCorrectIdAndData() async throws {
        var receivedId: String?
        var receivedData: TransactionUpdate?
        let expectedTransaction = TestDataFactory.createTransaction(
            id: "tx-1",
            name: "Updated",
            amount: 200,
            kind: .income
        )

        let deps = EditTransactionDependencies(
            updateTransaction: { id, data in
                receivedId = id
                receivedData = data
                return expectedTransaction
            }
        )

        let result = try await deps.updateTransaction("tx-1", TransactionUpdate(
            name: "Updated",
            amount: 200,
            kind: .income,
            transactionDate: TestDataFactory.fixedDate
        ))

        #expect(receivedId == "tx-1")
        #expect(receivedData?.name == "Updated")
        #expect(receivedData?.amount == 200)
        #expect(receivedData?.kind == .income)
        #expect(receivedData?.transactionDate == TestDataFactory.fixedDate)
        #expect(result.id == "tx-1")
        #expect(result.name == "Updated")
    }

    // MARK: - Form Validation Logic

    @Test
    func canSubmit_validInputs_returnsTrue() {
        let result = EditTransactionSheet.isFormValid(
            name: "Groceries",
            amount: 50,
            isLoading: false
        )

        #expect(result == true)
    }

    @Test
    func canSubmit_emptyName_returnsFalse() {
        let result = EditTransactionSheet.isFormValid(
            name: "",
            amount: 50,
            isLoading: false
        )

        #expect(result == false)
    }

    @Test
    func canSubmit_whitespaceOnlyName_returnsFalse() {
        let result = EditTransactionSheet.isFormValid(
            name: "   ",
            amount: 50,
            isLoading: false
        )

        #expect(result == false)
    }

    @Test
    func canSubmit_zeroAmount_returnsFalse() {
        let result = EditTransactionSheet.isFormValid(
            name: "Groceries",
            amount: 0,
            isLoading: false
        )

        #expect(result == false)
    }

    @Test
    func canSubmit_nilAmount_returnsFalse() {
        let result = EditTransactionSheet.isFormValid(
            name: "Groceries",
            amount: nil,
            isLoading: false
        )

        #expect(result == false)
    }

    @Test
    func canSubmit_negativeAmount_returnsFalse() {
        let result = EditTransactionSheet.isFormValid(
            name: "Groceries",
            amount: -10,
            isLoading: false
        )

        #expect(result == false)
    }

    @Test
    func canSubmit_isLoading_returnsFalse() {
        let result = EditTransactionSheet.isFormValid(
            name: "Groceries",
            amount: 50,
            isLoading: true
        )

        #expect(result == false)
    }

    @Test
    func canSubmit_nameWithLeadingTrailingSpaces_returnsTrue() {
        let result = EditTransactionSheet.isFormValid(
            name: "  Groceries  ",
            amount: 50,
            isLoading: false
        )

        #expect(result == true)
    }
}
