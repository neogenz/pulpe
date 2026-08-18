import Foundation
@testable import Pulpe
import Testing

struct TagCodableTests {
    private func decode<T: Decodable>(_ type: T.Type, json: String) throws -> T {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return try decoder.decode(type, from: Data(json.utf8))
    }

    private func encodedObject(_ value: some Encodable) throws -> [String: Any] {
        let data = try JSONEncoder().encode(value)
        return try #require(JSONSerialization.jsonObject(with: data) as? [String: Any])
    }

    @Test("BudgetLine decodes tagIds and tolerates their absence")
    func budgetLine_decodesTagIds() throws {
        func json(_ tags: String) -> String {
            """
            {
              "id":"line-1","budgetId":"budget-1","templateLineId":null,"savingsGoalId":null,
              "name":"Courses","amount":80,"kind":"expense","recurrence":"one_off",
              "isManuallyAdjusted":false,"checkedAt":null,
              "createdAt":"2026-07-01T00:00:00Z","updatedAt":"2026-07-01T00:00:00Z"\(tags)
            }
            """
        }

        let tagged = try decode(BudgetLine.self, json: json(#", "tagIds":["tag-1","tag-2"]"#))
        let legacy = try decode(BudgetLine.self, json: json(""))

        #expect(tagged.tagIds == ["tag-1", "tag-2"])
        #expect(legacy.tagIds == nil)
        #expect(tagged.toggled().tagIds == tagged.tagIds)
    }

    @Test("Transaction decodes tagIds and preserves them when toggled")
    func transaction_decodesTagIds() throws {
        let transaction = try decode(Transaction.self, json: """
        {
          "id":"tx-1","budgetId":"budget-1","budgetLineId":null,"name":"Courses",
          "amount":80,"kind":"expense","transactionDate":"2026-07-01T00:00:00Z",
          "category":null,"checkedAt":null,"createdAt":"2026-07-01T00:00:00Z",
          "updatedAt":"2026-07-01T00:00:00Z","tagIds":["tag-1"]
        }
        """)

        #expect(transaction.tagIds == ["tag-1"])
        #expect(transaction.toggled().tagIds == ["tag-1"])
    }

    @Test("TemplateLine tolerates a missing tagIds key")
    func templateLine_decodesLegacyPayload() throws {
        let line = try decode(TemplateLine.self, json: """
        {
          "id":"template-line-1","templateId":"template-1","name":"Loyer","amount":1200,
          "kind":"expense","recurrence":"fixed","description":"",
          "createdAt":"2026-07-01T00:00:00Z","updatedAt":"2026-07-01T00:00:00Z"
        }
        """)

        #expect(line.tagIds == nil)
    }

    @Test("PATCH tagIds omit means preserve and empty array means detach")
    func updateDTOs_encodeTagSemantics() throws {
        let budgetUntouched = try encodedObject(BudgetLineUpdate(id: "line-1"))
        var budgetDetached = BudgetLineUpdate(id: "line-1")
        budgetDetached.tagIds = []

        let transactionUntouched = try encodedObject(TransactionUpdate())
        var transactionDetached = TransactionUpdate()
        transactionDetached.tagIds = []

        let templateUntouched = try encodedObject(TemplateLineUpdate())
        var templateDetached = TemplateLineUpdate()
        templateDetached.tagIds = []

        #expect(budgetUntouched["tagIds"] == nil)
        #expect(try encodedObject(budgetDetached)["tagIds"] as? [String] == [])
        #expect(transactionUntouched["tagIds"] == nil)
        #expect(try encodedObject(transactionDetached)["tagIds"] as? [String] == [])
        #expect(templateUntouched["tagIds"] == nil)
        #expect(try encodedObject(templateDetached)["tagIds"] as? [String] == [])
    }

    @Test("duplicate tag names use the localized conflict")
    func duplicateNameError_isLocalized() {
        let error = APIError.from(code: "ERR_TAG_ALREADY_EXISTS", message: nil)

        #expect(error.message(in: AppLocale.uiLocale(for: .fr)) == "Un tag porte déjà ce nom — choisis-en un autre")
    }
}
