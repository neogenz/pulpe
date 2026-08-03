import Foundation
@testable import Pulpe
import Testing

/// Locks the PUL-329 read contracts. Amounts must land as `Decimal`: a `Double`
/// round-trip would turn a 0.55 franc withdrawal into 0.5500000000000001 and
/// make the "disponible → restant" preview disagree with the server.
struct SavingsGoalWithdrawalTests {
    private func decoder() -> JSONDecoder {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return decoder
    }

    @Test("a withdrawal option decodes its status and its exact available balance")
    func withdrawalOption_decodesStatusAndExactBalance() throws {
        let json = Data("""
        {
          "goalId": "11111111-1111-4111-8111-111111111111",
          "name": "Maison",
          "status": "COMPLETED",
          "availableAmount": 10000.55,
          "currency": "CHF"
        }
        """.utf8)

        let option = try decoder().decode(SavingsGoalWithdrawalOption.self, from: json)

        #expect(option.id == option.goalId)
        #expect(option.status == .completed)
        #expect(option.availableAmount == Decimal(string: "10000.55"))
        #expect(option.currency == .chf)
    }

    @Test("a withdrawal entry stays positive on the wire and identifies its transaction")
    func withdrawal_decodesPositiveAmountAndTransactionIdentity() throws {
        let json = Data("""
        {
          "transactionId": "22222222-2222-4222-8222-222222222222",
          "budgetId": "33333333-3333-4333-8333-333333333333",
          "name": "Apport cuisine",
          "transactionDate": "2026-07-20T10:00:00Z",
          "amount": 4500
        }
        """.utf8)

        let withdrawal = try decoder().decode(SavingsGoalWithdrawal.self, from: json)

        #expect(withdrawal.id == withdrawal.transactionId)
        #expect(withdrawal.amount == 4500)
        #expect(withdrawal.budgetId == "33333333-3333-4333-8333-333333333333")
    }
}
