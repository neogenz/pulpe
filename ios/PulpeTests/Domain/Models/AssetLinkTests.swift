import Foundation
import Testing

@testable import Pulpe

/// The `assetId` link of a prévision (PUL-366): which kinds can carry one, the tri-state
/// PATCH contract, and the wire bodies. The key is absent unless the link was written.
@Suite("Asset link on prévisions")
@MainActor
struct AssetLinkTests {
    // MARK: - Direction

    @Test("Épargne feeds own assets, Dépense repays debts, Revenu links to nothing")
    func direction_perKind() {
        #expect(TransactionKind.saving.assetDirection == .own)
        #expect(TransactionKind.expense.assetDirection == .owe)
        #expect(TransactionKind.income.assetDirection == nil)
        #expect(TransactionKind.income.assetLink("a1") == nil)
        #expect(TransactionKind.saving.assetLink("a1") == "a1")
    }

    @Test("The picker is shown only with the flag on and a kind that has a direction")
    func pickerVisibility() {
        #expect(AssetPickerField.isShown(kind: .saving, flagEnabled: true))
        #expect(AssetPickerField.isShown(kind: .expense, flagEnabled: true))
        #expect(!AssetPickerField.isShown(kind: .income, flagEnabled: true))
        #expect(!AssetPickerField.isShown(kind: .saving, flagEnabled: false))
    }

    // MARK: - Tri-state change

    @Test("Unchanged link yields no PATCH value; cleared yields explicit null; changed yields the id")
    func change_triState() {
        #expect(assetLinkChange(initial: "a1", current: "a1") == nil)
        #expect(assetLinkChange(initial: nil, current: nil) == nil)
        #expect(assetLinkChange(initial: "a1", current: nil) == .some(nil))
        #expect(assetLinkChange(initial: nil, current: "a2") == .some("a2"))
        #expect(assetLinkChange(initial: "a1", current: "a2") == .some("a2"))
    }

    // MARK: - Wire bodies

    private func json(_ value: some Encodable) throws -> [String: Any] {
        let data = try JSONEncoder().encode(value)
        return try #require(JSONSerialization.jsonObject(with: data) as? [String: Any])
    }

    @Test("A PATCH omits assetId when untouched, sends null when cleared, the id when set")
    func update_bodies() throws {
        var untouched = BudgetLineUpdate(id: "l1", name: "Renamed")
        untouched.assetId = assetLinkChange(initial: "a1", current: "a1")
        #expect(try json(untouched)["assetId"] == nil)

        var cleared = BudgetLineUpdate(id: "l1")
        cleared.assetId = assetLinkChange(initial: "a1", current: nil)
        #expect(try json(cleared)["assetId"] is NSNull)

        var changed = TemplateLineUpdate()
        changed.assetId = assetLinkChange(initial: nil, current: "a2")
        #expect(try json(changed)["assetId"] as? String == "a2")
    }

    @Test("Create bodies carry assetId only when linked")
    func create_bodies() throws {
        let plain = BudgetLineCreate(budgetId: "b", name: "n", amount: 1, kind: .saving, recurrence: .oneOff)
        #expect(try json(plain)["assetId"] == nil)
        let linked = BudgetLineCreate(
            budgetId: "b", name: "n", amount: 1, kind: .saving, recurrence: .oneOff, assetId: "a1"
        )
        #expect(try json(linked)["assetId"] as? String == "a1")

        let template = TemplateLineCreate(name: "n", amount: 1, kind: .expense, recurrence: .fixed, assetId: "a2")
        #expect(try json(template)["assetId"] as? String == "a2")
        let unlinked = TemplateLineCreate(name: "n", amount: 1, kind: .expense, recurrence: .fixed)
        #expect(try json(unlinked)["assetId"] == nil)

        let spread = BudgetLineSpreadCreate(name: "n", kind: .saving, assetId: "a1", months: [])
        #expect(try json(spread)["assetId"] as? String == "a1")
        #expect(try json(BudgetLineSpreadCreate(name: "n", kind: .saving, months: []))["assetId"] == nil)
    }

    @Test("Spread submit carries the link for Épargne and Dépense, never for Revenu")
    func spread_logic() {
        let calculator = SpreadCalculator(anchorMonth: 11, anchorYear: 2026)
        func build(_ kind: TransactionKind) -> BudgetLineSpreadCreate {
            AddBudgetLineSpreadLogic.buildCreate(
                calculator: calculator,
                input: .init(
                    name: "n", kind: kind, amount: 10, mode: .perMonth, conversion: nil,
                    spreadGroupId: "g", assetId: "a1"
                )
            )
        }
        #expect(build(.saving).assetId == "a1")
        #expect(build(.expense).assetId == "a1")
        #expect(build(.income).assetId == nil)
    }

    @Test("Propagating a template line carries the link change")
    func propagation() {
        var update = TemplateLineUpdate()
        update.assetId = .some(nil)
        #expect(EditTemplateLineSheet.propagationUpdate(id: "t", data: update).assetId == .some(nil))
        #expect(EditTemplateLineSheet.propagationUpdate(id: "t", data: TemplateLineUpdate()).assetId == nil)
    }

    // MARK: - Models

    private static let lineJSON = """
    {"id":"l1","budgetId":"b","templateLineId":null,"savingsGoalId":null,"name":"n","amount":1,
    "kind":"saving","recurrence":"one_off","isManuallyAdjusted":false,"checkedAt":null,
    "createdAt":"2026-11-01T00:00:00Z","updatedAt":"2026-11-01T00:00:00Z"%@}
    """

    private func decodeLine(extra: String) throws -> BudgetLine {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return try decoder.decode(BudgetLine.self, from: Data(String(format: Self.lineJSON, extra).utf8))
    }

    @Test("A budget line decodes with and without assetId, and toggled() keeps it")
    func budgetLine_decodingAndToggle() throws {
        #expect(try decodeLine(extra: "").assetId == nil)
        let linked = try decodeLine(extra: ",\"assetId\":\"a1\"")
        #expect(linked.assetId == "a1")
        #expect(linked.toggled().assetId == "a1")
    }
}
