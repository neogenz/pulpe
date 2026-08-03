import Foundation
@testable import Pulpe
import Testing

private let deletionImpactJSON = Data("""
{
  "goalId": "11111111-1111-4111-8111-111111111111",
  "summary": {
    "templateLineCount": 1,
    "templateLineTotal": 200,
    "budgetCount": 1,
    "budgetLineCount": 1,
    "budgetLineTotal": 200,
    "transactionCount": 1,
    "transactionTotal": 180,
    "withdrawalCount": 1,
    "withdrawalTotal": 320.55
  },
  "templateLines": [{
    "lineId": "22222222-2222-4222-8222-222222222222",
    "templateId": "33333333-3333-4333-8333-333333333333",
    "templateName": "Mois Type",
    "name": "Épargne vacances",
    "amount": 200,
    "recurrence": "fixed",
    "updatedAt": "2026-07-27T10:00:00.123456+00:00"
  }],
  "budgets": [{
    "budgetId": "44444444-4444-4444-8444-444444444444",
    "month": 8,
    "year": 2026,
    "lines": [{
      "lineId": "55555555-5555-4555-8555-555555555555",
      "name": "Épargne vacances",
      "amount": 200,
      "recurrence": "fixed",
      "checkedAt": null,
      "updatedAt": "2026-07-27T10:00:00.123456+00:00",
      "transactions": [{
        "id": "66666666-6666-4666-8666-666666666666",
        "budgetId": "44444444-4444-4444-8444-444444444444",
        "budgetLineId": "55555555-5555-4555-8555-555555555555",
        "name": "Virement épargne",
        "amount": 180,
        "kind": "saving",
        "transactionDate": "2026-07-27T10:00:00Z",
        "category": null,
        "checkedAt": "2026-07-27T10:00:00Z",
        "createdAt": "2026-07-27T10:00:00Z",
        "updatedAt": "2026-07-27T10:00:00Z"
      }]
    }]
  }],
  "withdrawals": [{
    "transactionId": "77777777-7777-4777-8777-777777777777",
    "budgetId": "44444444-4444-4444-8444-444444444444",
    "name": "Apport cuisine",
    "transactionDate": "2026-07-20T10:00:00Z",
    "amount": 320.55
  }],
  "revision": {
    "templateLines": [{
      "id": "22222222-2222-4222-8222-222222222222",
      "updatedAt": "2026-07-27T10:00:00.123456+00:00"
    }],
    "budgetLines": [{
      "id": "55555555-5555-4555-8555-555555555555",
      "updatedAt": "2026-07-27T10:00:00.123456+00:00"
    }],
    "transactions": [{
      "id": "66666666-6666-4666-8666-666666666666",
      "updatedAt": "2026-07-27T10:00:00.123456+00:00"
    }]
  }
}
""".utf8)

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

    @Test("SavingsGoal decodes initialAmount when present, nil when absent (legacy)")
    func savingsGoal_decodesInitialAmount() throws {
        func decode(_ initialAmountField: String) throws -> SavingsGoal {
            try decoder().decode(SavingsGoal.self, from: Data("""
            {
                "id": "1", "userId": "2", "name": "Maison", "targetAmount": 50000,
                "targetDate": "2027-12-31", "status": "ACTIVE",
                "createdAt": "2026-06-23T10:00:00Z", "updatedAt": "2026-06-23T10:00:00Z"
                \(initialAmountField)
            }
            """.utf8))
        }

        #expect(try decode(", \"initialAmount\": 5000").initialAmount == 5000)
        #expect(try decode("").initialAmount == nil)
    }

    @Test("SavingsGoal decodes valued, null and absent optional interval fields")
    func savingsGoal_decodesMixedOptionalIntervals() throws {
        let json = Data("""
        [
          {
            "id": "valued", "userId": "2", "name": "Maison",
            "startDate": "2026-06-01", "targetAmount": 50000, "targetDate": "2027-12-31",
            "status": "ACTIVE", "createdAt": "2026-06-23T10:00:00Z",
            "updatedAt": "2026-06-23T10:00:00Z"
          },
          {
            "id": "null", "userId": "2", "name": "Pot libre",
            "startDate": null, "targetAmount": null, "targetDate": null,
            "status": "ACTIVE", "createdAt": "2026-06-23T10:00:00Z",
            "updatedAt": "2026-06-23T10:00:00Z"
          },
          {
            "id": "absent", "userId": "2", "name": "Historique",
            "status": "ACTIVE", "createdAt": "2026-06-23T10:00:00Z",
            "updatedAt": "2026-06-23T10:00:00Z"
          }
        ]
        """.utf8)

        let goals = try decoder().decode([SavingsGoal].self, from: json)

        #expect(goals.count == 3)
        #expect(goals[0].startDate == "2026-06-01")
        #expect(goals[0].targetAmount == 50000)
        #expect(goals[1].startDate == nil)
        #expect(goals[1].targetAmount == nil)
        #expect(goals[1].targetDate == nil)
        #expect(goals[2].startDate == nil)
        #expect(goals[2].targetAmount == nil)
        #expect(goals[2].targetDate == nil)
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

    @Test("ISO date formatter preserves a Zurich calendar day")
    func dateFormatter_zurichMidnight_preservesCalendarDay() throws {
        let zurich = try #require(TimeZone(identifier: "Europe/Zurich"))
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = zurich
        let date = try #require(
            calendar.date(from: DateComponents(year: 2027, month: 7, day: 10))
        )

        #expect(SavingsGoalDateFormatter.string(from: date, timeZone: zurich) == "2027-07-10")
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

    @Test("SavingsGoalCreate encodes initialAmount when set, omits it when nil")
    func savingsGoalCreate_initialAmount() throws {
        let withSeed = SavingsGoalCreate(
            name: "Voiture", targetAmount: 12000, targetDate: "2028-01-01", status: .active,
            initialAmount: 5000
        )
        let withoutSeed = SavingsGoalCreate(
            name: "Voiture", targetAmount: 12000, targetDate: "2028-01-01", status: .active
        )

        #expect((try encodedObject(withSeed)["initialAmount"] as? NSNumber)?.intValue == 5000)
        #expect(try encodedObject(withoutSeed)["initialAmount"] == nil)
    }

    @Test("SavingsGoalCreate supports a name-only open pot")
    func savingsGoalCreate_nameOnly() throws {
        let object = try encodedObject(SavingsGoalCreate(name: "Imprévus", status: .active))

        #expect(object["name"] as? String == "Imprévus")
        #expect(object["startDate"] == nil)
        #expect(object["targetAmount"] == nil)
        #expect(object["targetDate"] == nil)
    }

    @Test("SavingsGoalUpdate tri-states start, target amount and target date")
    func savingsGoalUpdate_triStatesOptionalFields() throws {
        let omitted = try encodedObject(SavingsGoalUpdate(name: "Maison"))
        #expect(omitted["startDate"] == nil)
        #expect(omitted["targetAmount"] == nil)
        #expect(omitted["targetDate"] == nil)

        var cleared = SavingsGoalUpdate()
        cleared.startDate = .some(nil)
        cleared.targetAmount = .some(nil)
        cleared.targetDate = .some(nil)
        let clearedObject = try encodedObject(cleared)
        #expect(clearedObject["startDate"] is NSNull)
        #expect(clearedObject["targetAmount"] is NSNull)
        #expect(clearedObject["targetDate"] is NSNull)

        var valued = SavingsGoalUpdate()
        valued.startDate = .some("2026-06-01")
        valued.targetAmount = .some(12_000)
        valued.targetDate = .some("2028-01-01")
        let valuedObject = try encodedObject(valued)
        #expect(valuedObject["startDate"] as? String == "2026-06-01")
        #expect((valuedObject["targetAmount"] as? NSNumber)?.intValue == 12_000)
        #expect(valuedObject["targetDate"] as? String == "2028-01-01")
    }

    @Test("SavingsGoalUpdate omits initialAmount when unset, sends 0 to erase")
    func savingsGoalUpdate_initialAmount() throws {
        let unset = try encodedObject(SavingsGoalUpdate(name: "Voiture"))
        #expect(unset["initialAmount"] == nil)

        let erased = try encodedObject(SavingsGoalUpdate(initialAmount: 0))
        #expect((erased["initialAmount"] as? NSNumber)?.intValue == 0)
    }

    // MARK: - Deletion impact

    @Test("SavingsGoalDeletionImpact decodes the complete nested preview")
    func deletionImpact_decodesCompletePreview() throws {
        let impact = try decoder().decode(
            SavingsGoalDeletionImpact.self,
            from: deletionImpactJSON
        )

        #expect(impact.summary.budgetCount == 1)
        #expect(impact.templateLines.first?.amount == 200)
        #expect(impact.budgets.first?.lines.first?.transactions.first?.amount == 180)
        #expect(impact.withdrawals.first?.name == "Apport cuisine")
        #expect(impact.withdrawals.first?.amount == Decimal(string: "320.55"))
        #expect(impact.summary.withdrawalTotal == Decimal(string: "320.55"))
        #expect(
            impact.revision.transactions.first?.updatedAt
                == "2026-07-27T10:00:00.123456+00:00"
        )
    }

    @Test(
        "SavingsGoalDeletionCommand preserves every mode and the exact revision string",
        arguments: SavingsGoalDeletionMode.allCases
    )
    func deletionCommand_encodesExactRevision(mode: SavingsGoalDeletionMode) throws {
        let updatedAt = "2026-07-27T10:00:00.123456+00:00"
        let command = SavingsGoalDeletionCommand(
            mode: mode,
            revision: SavingsGoalDeletionRevision(
                templateLines: [.init(id: "template-line", updatedAt: updatedAt)],
                budgetLines: [],
                transactions: []
            )
        )

        let object = try encodedObject(command)
        let revision = try #require(object["revision"] as? [String: Any])
        let entries = try #require(revision["templateLines"] as? [[String: Any]])

        #expect(object["mode"] as? String == mode.rawValue)
        #expect(entries.first?["updatedAt"] as? String == updatedAt)
    }

    // MARK: - Kind guard

    @Test("savingsGoalLink keeps the id only for saving, clears it otherwise")
    func kindGuard_savingsGoalLink() {
        #expect(TransactionKind.saving.savingsGoalLink("goal-1") == "goal-1")
        #expect(TransactionKind.saving.savingsGoalLink(nil) == nil)
        #expect(TransactionKind.expense.savingsGoalLink("goal-1") == nil)
        #expect(TransactionKind.income.savingsGoalLink("goal-1") == nil)
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

    @Test("TemplateLineUpdateWithId tri-states the link (bulk-propagate path)")
    func templateLineUpdateWithId_triState() throws {
        let unset = try encodedObject(TemplateLineUpdateWithId(id: "tl-1", name: "Épargne"))
        #expect(unset["savingsGoalId"] == nil)

        var untag = TemplateLineUpdateWithId(id: "tl-1")
        untag.savingsGoalId = .some(nil)
        #expect(try encodedObject(untag)["savingsGoalId"] is NSNull)

        var tag = TemplateLineUpdateWithId(id: "tl-1")
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
