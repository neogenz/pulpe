import Foundation
@testable import Pulpe
import Testing

/// Locks the PUL-12 iOS ↔ API contract: `SavingsGoal` decoding, the create DTO
/// shape, and — critically — the tri-state `savingsGoalId` PATCH encoding
/// (omit / explicit-null / value) that drives tagging & untagging.
struct SavingsGoalCodableTests {
    private func decoder() -> JSONDecoder {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return decoder
    }

    /// Encodes `value` and returns the JSON object as a dictionary so key
    /// presence and `null` can be asserted distinctly.
    private func encodedObject(_ value: some Encodable) throws -> [String: Any] {
        let data = try JSONEncoder().encode(value)
        let object = try JSONSerialization.jsonObject(with: data)
        return try #require(object as? [String: Any])
    }

    // MARK: - SavingsGoal decoding

    @Test("SavingsGoal decodes the API response (camelCase, ISO date, null FX)")
    func savingsGoal_decodes() throws {
        let json = Data("""
        {
            "id": "11111111-1111-1111-1111-111111111111",
            "userId": "22222222-2222-2222-2222-222222222222",
            "name": "Maison",
            "targetAmount": 50000,
            "targetDate": "2027-12-31",
            "status": "ACTIVE",
            "createdAt": "2026-06-23T10:00:00Z",
            "updatedAt": "2026-06-23T10:00:00Z",
            "originalTargetAmount": null,
            "originalCurrency": null,
            "targetCurrency": null,
            "exchangeRate": null
        }
        """.utf8)

        let goal = try decoder().decode(SavingsGoal.self, from: json)

        #expect(goal.id == "11111111-1111-1111-1111-111111111111")
        #expect(goal.name == "Maison")
        #expect(goal.targetAmount == 50000)
        #expect(goal.targetDate == "2027-12-31")
        #expect(goal.status == .active)
        #expect(goal.originalTargetAmount == nil)
        #expect(goal.targetDateValue == SavingsGoalDateFormatter.parse("2027-12-31"))
    }

    @Test("SavingsGoalStatus maps every raw value")
    func status_rawValues() {
        #expect(SavingsGoalStatus(rawValue: "ACTIVE") == .active)
        #expect(SavingsGoalStatus(rawValue: "COMPLETED") == .completed)
        #expect(SavingsGoalStatus(rawValue: "PAUSED") == .paused)
        #expect(SavingsGoalStatus.allCases.count == 3)
    }

    @Test("ISO date formatter round-trips YYYY-MM-DD")
    func dateFormatter_roundTrips() throws {
        let date = try #require(SavingsGoalDateFormatter.parse("2027-12-31"))
        #expect(SavingsGoalDateFormatter.string(from: date) == "2027-12-31")
    }

    // MARK: - Create DTO

    @Test("SavingsGoalCreate encodes name/targetAmount/targetDate/status")
    func savingsGoalCreate_encodes() throws {
        let dto = SavingsGoalCreate(
            name: "Voiture",
            targetAmount: 12000,
            targetDate: "2028-01-01",
            status: .active
        )
        let object = try encodedObject(dto)

        #expect(object["name"] as? String == "Voiture")
        #expect(object["targetDate"] as? String == "2028-01-01")
        #expect(object["status"] as? String == "ACTIVE")
        #expect((object["targetAmount"] as? NSNumber)?.intValue == 12000)
    }

    // MARK: - Tri-state savingsGoalId (BudgetLineUpdate)

    @Test("BudgetLineUpdate omits savingsGoalId when unset (no change)")
    func budgetLineUpdate_omitsLinkWhenUnset() throws {
        let dto = BudgetLineUpdate(id: "line-1", name: "Épargne")
        let object = try encodedObject(dto)
        #expect(object["savingsGoalId"] == nil, "unset link must be omitted, not null")
    }

    @Test("BudgetLineUpdate sends explicit null to untag")
    func budgetLineUpdate_sendsNullToUntag() throws {
        var dto = BudgetLineUpdate(id: "line-1")
        dto.savingsGoalId = .some(nil)
        let object = try encodedObject(dto)
        #expect(object.keys.contains("savingsGoalId"), "untag must include the key")
        #expect(object["savingsGoalId"] is NSNull, "untag must send explicit null")
    }

    @Test("BudgetLineUpdate sends the goal id when tagging")
    func budgetLineUpdate_sendsIdWhenTagging() throws {
        var dto = BudgetLineUpdate(id: "line-1")
        dto.savingsGoalId = .some("goal-7")
        let object = try encodedObject(dto)
        #expect(object["savingsGoalId"] as? String == "goal-7")
    }

    // MARK: - Tri-state savingsGoalId (TemplateLineUpdate) + Create

    @Test("TemplateLineUpdate tri-states the savings-goal link")
    func templateLineUpdate_triState() throws {
        let unset = try encodedObject(TemplateLineUpdate(name: "Épargne"))
        #expect(unset["savingsGoalId"] == nil)

        var untag = TemplateLineUpdate()
        untag.savingsGoalId = .some(nil)
        #expect(try encodedObject(untag)["savingsGoalId"] is NSNull)

        var tag = TemplateLineUpdate()
        tag.savingsGoalId = .some("goal-9")
        #expect(try encodedObject(tag)["savingsGoalId"] as? String == "goal-9")
    }

    @Test("TemplateLineCreate omits link when nil, sends id when set")
    func templateLineCreate_link() throws {
        let untagged = try encodedObject(
            TemplateLineCreate(name: "Épargne", amount: 100, kind: .saving, recurrence: .fixed)
        )
        #expect(untagged["savingsGoalId"] == nil)

        let tagged = try encodedObject(
            TemplateLineCreate(
                name: "Épargne",
                amount: 100,
                kind: .saving,
                recurrence: .fixed,
                savingsGoalId: "goal-3"
            )
        )
        #expect(tagged["savingsGoalId"] as? String == "goal-3")
    }
}
