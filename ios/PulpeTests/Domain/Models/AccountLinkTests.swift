import Foundation
import Testing

@testable import Pulpe

/// The « Compte » of a movement (PUL-378, phase 7): decoding, the three-state wire value, the
/// picker's content and the rules the forms apply. Amounts follow the contract's jeu d'essai:
/// Compte courant 5 000, Revolut 400, Livret 10 000, Leasing 8 000, Carte de crédit 200.
@Suite("Account on movements")
@MainActor
struct AccountLinkTests {
    // MARK: - Fixtures

    private static func asset(
        _ id: String, _ name: String, _ direction: AssetDirection, _ value: Decimal, archived: Bool = false
    ) -> Asset {
        TestDataFactory.makeAsset(
            id: id, name: name, direction: direction,
            archivedAt: archived ? TestDataFactory.fixedDate : nil, latestValue: value
        )
    }

    private static func loadedStore(archivingCard: Bool = false) async -> AssetStore {
        let service = MockAssetService()
        service.stubbedNetWorth = TestDataFactory.makeNetWorth(assets: [
            asset("checking", "Compte courant", .own, 5000),
            asset("revolut", "Revolut", .own, 400),
            asset("savings", "Livret", .own, 10_000),
            asset("leasing", "Leasing", .owe, 8000),
            asset("card", "Carte de crédit", .owe, 200, archived: archivingCard)
        ])
        let store = AssetStore(service: service)
        await store.forceRefresh()
        return store
    }

    private func json(_ value: some Encodable) throws -> [String: Any] {
        let data = try JSONEncoder().encode(value)
        return try #require(JSONSerialization.jsonObject(with: data) as? [String: Any])
    }

    // MARK: - CA1, CA2, CA3: the field

    @Test("CA1: the picker lists what I have, then what I owe, active elements only")
    func ca1_sections() async {
        let store = await Self.loadedStore(archivingCard: true)
        #expect(store.activeAssets(direction: .own).map(\.name) == ["Compte courant", "Revolut", "Livret"])
        #expect(store.activeAssets(direction: .owe).map(\.name) == ["Leasing"])
    }

    @Test("CA2: the picker is absent with the flag off or no active element")
    func ca2_absent() async {
        let store = await Self.loadedStore()
        #expect(AccountPickerField.isShown(flagEnabled: true, store: store))
        #expect(!AccountPickerField.isShown(flagEnabled: false, store: store))
        #expect(!AccountPickerField.isShown(flagEnabled: true, store: AssetStore(service: MockAssetService())))
    }

    @Test("CA2: with the field absent a creation still states « Aucun », an explicit null")
    func ca2_absentSendsNull() throws {
        let line = BudgetLineCreate(
            budgetId: "b", name: "n", amount: 1, kind: .expense, recurrence: .oneOff, accountId: .some(nil)
        )
        #expect(try json(line)["accountId"] is NSNull)
    }

    @Test("CA3: without a default account the field starts on « Aucun »")
    func ca3_noDefault() async {
        let store = await Self.loadedStore()
        #expect(AccountLink.start(defaultId: nil, link: nil, store: store) == nil)
    }

    // MARK: - CA4: a movement allocated to a prévision

    @Test("CA4: an allocated movement shows no account and sends none")
    func ca4_allocatedSendsNothing() throws {
        #expect(AccountLink.onCreate(lineId: "line-1", account: "checking", didPrefill: true) == nil)
        #expect(AccountLink.onUpdate(lineId: "line-1", initial: nil, account: "revolut") == nil)
        let tx = TransactionCreate(
            budgetId: "b", name: "n", amount: 1, kind: .expense, budgetLineId: "line-1",
            accountId: AccountLink.onCreate(lineId: "line-1", account: "checking", didPrefill: true)
        )
        #expect(try json(tx)["accountId"] == nil)
    }

    @Test("A free movement states its account on creation, null for « Aucun »")
    func freeMovementCreate() throws {
        func body(_ account: String?) throws -> [String: Any] {
            try json(TransactionCreate(
                budgetId: "b", name: "Restaurant", amount: 80, kind: .expense,
                accountId: AccountLink.onCreate(lineId: nil, account: account, didPrefill: true)
            ))
        }
        #expect(try body("checking")["accountId"] as? String == "checking")
        #expect(try body(nil)["accountId"] is NSNull)
        #expect(try json(TransactionCreate(budgetId: "b", name: "n", amount: 1, kind: .expense))["accountId"] == nil)
    }

    @Test("CA2: with the flag off the field never shows, so a creation sends no account at all")
    func ca2_flagOffSendsNoAccount() throws {
        func body(_ account: String?, didPrefill: Bool) throws -> [String: Any] {
            try json(TransactionCreate(
                budgetId: "b", name: "Restaurant", amount: 80, kind: .expense,
                accountId: AccountLink.onCreate(lineId: nil, account: account, didPrefill: didPrefill)
            ))
        }
        #expect(try body(nil, didPrefill: false).keys.contains("accountId") == false)
        #expect(try body("checking", didPrefill: true)["accountId"] as? String == "checking")
        #expect(AccountLink.onCreate(account: nil, didPrefill: false) == nil)
        #expect(AccountLink.onCreate(account: "checking", didPrefill: true) == .some("checking"))
    }

    // MARK: - CA25, CA45: the same element twice

    @Test("CA25: the same element as account and link is a conflict with a message")
    func ca25_conflict() {
        #expect(AccountLink.conflicts(account: "savings", link: "savings"))
        #expect(!AccountLink.conflicts(account: "checking", link: "savings"))
        #expect(!AccountLink.conflicts(account: nil, link: nil))
        #expect(
            AccountLink.conflictMessage(name: "Livret")
                == "Choisis un autre compte : « Livret » est déjà l'élément lié."
        )
    }

    @Test("CA25: a link chosen on purpose stays and is refused, it does not erase the account")
    func ca25_chosenAccountStays() {
        #expect(AccountLink.afterLinkChange(account: "savings", link: "savings", defaultId: "checking") == "savings")
    }

    @Test("CA45: the default account never starts on the element the line already feeds")
    func ca45_startSkipsLink() async {
        let store = await Self.loadedStore()
        #expect(AccountLink.start(defaultId: "savings", link: "savings", store: store) == nil)
        #expect(AccountLink.start(defaultId: "savings", link: "leasing", store: store) == "savings")
    }

    @Test("CA45: choosing the prefilled account as « Versée sur » puts the account back on « Aucun »")
    func ca45_linkReplacesPrefill() {
        #expect(AccountLink.afterLinkChange(account: "savings", link: "savings", defaultId: "savings") == nil)
        #expect(AccountLink.afterLinkChange(account: "checking", link: "savings", defaultId: "checking") == "checking")
    }

    @Test("The link title names the field the message points at")
    func linkTitles() {
        #expect(AssetPickerField.linkTitle(kind: .saving) == "Versée sur")
        #expect(AssetPickerField.linkTitle(kind: .expense) == "Dette remboursée")
        #expect(AssetPickerField.linkTitle(kind: .income) == "Tiré de")
    }

    @Test("An income edit only counts the origin it was created with")
    func editLinkedAsset() {
        func line(_ kind: TransactionKind) -> BudgetLine {
            BudgetLine(
                id: "l", budgetId: "b", templateLineId: nil, savingsGoalId: nil, name: "n", amount: 1,
                kind: kind, recurrence: .fixed, isManuallyAdjusted: false, checkedAt: nil,
                createdAt: TestDataFactory.fixedDate, updatedAt: TestDataFactory.fixedDate, assetId: "savings"
            )
        }
        #expect(EditBudgetLineSheet.linkedAssetId(line: line(.income), kind: .income, assetId: "savings") == "savings")
        #expect(EditBudgetLineSheet.linkedAssetId(line: line(.saving), kind: .income, assetId: nil) == nil)
        #expect(EditBudgetLineSheet.linkedAssetId(line: line(.saving), kind: .saving, assetId: "savings") == "savings")
    }

    // MARK: - CA29: the default account

    @Test("CA29: with Compte courant as default a new movement starts on it, and it can change")
    func ca29_prefill() async {
        let store = await Self.loadedStore()
        var account = AccountLink.start(defaultId: "checking", link: nil, store: store)
        #expect(account == "checking")
        account = "revolut"
        #expect(AccountLink.onCreate(lineId: nil, account: account, didPrefill: true) == .some("revolut"))
        account = nil
        #expect(AccountLink.onCreate(lineId: nil, account: account, didPrefill: true) == .some(nil))
    }

    @Test("An archived default account is not prefilled")
    func archivedDefault() async {
        let store = await Self.loadedStore(archivingCard: true)
        #expect(AccountLink.start(defaultId: "card", link: nil, store: store) == nil)
    }

    // MARK: - CA26: an edit that does not touch the field

    @Test("CA26: an untouched edit omits accountId, a change sends the id, a clear sends null")
    func ca26_updateBodies() throws {
        let line = BudgetLine(
            id: "l", budgetId: "b", templateLineId: nil, savingsGoalId: nil, name: "n", amount: 80,
            kind: .expense, recurrence: .oneOff, isManuallyAdjusted: false, checkedAt: nil,
            createdAt: TestDataFactory.fixedDate, updatedAt: TestDataFactory.fixedDate, accountId: "checking"
        )
        var untouched = BudgetLineUpdate(id: "l", name: "Renamed")
        untouched.accountId = EditBudgetLineSheet.accountChange(line: line, accountId: "checking")
        #expect(try json(untouched)["accountId"] == nil)

        var moved = BudgetLineUpdate(id: "l")
        moved.accountId = EditBudgetLineSheet.accountChange(line: line, accountId: "revolut")
        #expect(try json(moved)["accountId"] as? String == "revolut")

        var cleared = BudgetLineUpdate(id: "l")
        cleared.accountId = EditBudgetLineSheet.accountChange(line: line, accountId: nil)
        #expect(try json(cleared)["accountId"] is NSNull)
    }

    @Test("CA26: a template line and a free movement follow the same three states")
    func ca26_templateAndMovement() throws {
        let templateLine = TemplateLine(
            id: "t", templateId: "tpl", name: "Loyer", amount: 1500, kind: .expense, recurrence: .fixed,
            description: "", createdAt: TestDataFactory.fixedDate, updatedAt: TestDataFactory.fixedDate,
            accountId: "checking"
        )
        var update = TemplateLineUpdate(name: "Loyer")
        update.accountId = EditTemplateLineSheet.accountChange(line: templateLine, accountId: "checking")
        #expect(try json(update)["accountId"] == nil)
        update.accountId = EditTemplateLineSheet.accountChange(line: templateLine, accountId: "revolut")
        #expect(try json(update)["accountId"] as? String == "revolut")
        #expect(EditTemplateLineSheet.propagationUpdate(id: "t", data: update).accountId == .some("revolut"))

        var movement = TransactionUpdate(name: "Restaurant")
        movement.accountId = AccountLink.onUpdate(lineId: nil, initial: "checking", account: "checking")
        #expect(try json(movement)["accountId"] == nil)
        movement.accountId = AccountLink.onUpdate(lineId: nil, initial: "checking", account: nil)
        #expect(try json(movement)["accountId"] is NSNull)
    }

    // MARK: - CA44: the reconciliation gap

    @Test("CA44: the gap noted by the reconciliation is sent with an explicit null account")
    func ca44_adjustment() throws {
        let payload = try #require(AccountReconciliation.adjustmentPayload(
            budgetId: "b", label: "Écart avec mes comptes", verdict: .adjustment(kind: .expense, amount: 80),
            now: TestDataFactory.fixedDate
        ))
        let body = try json(payload)
        #expect(body["accountId"] is NSNull)
        #expect(body["name"] as? String == "Écart avec mes comptes")
    }

    // MARK: - Create bodies

    @Test("A line added while creating a model leaves with the account picked in its sheet")
    func newModelLineCarriesItsAccount() throws {
        func body(_ accountId: String??) throws -> [String: Any] {
            let input = TemplateLineInput(
                name: "Loyer", amount: 1_500, kind: .expense, recurrence: .fixed, accountId: accountId
            )
            return try json(CreateTemplateView.lineCreate(input))
        }
        #expect(try body(.some("revolut"))["accountId"] as? String == "revolut")
        #expect(try body(.some(nil))["accountId"] is NSNull)
        // Field never shown (flag off): the key is left out; a model line never gets the default.
        #expect(try body(.none)["accountId"] == nil)
    }

    @Test("Create bodies of a prévision, a model line and a spread carry the three states")
    func createBodies() throws {
        let line = BudgetLineCreate(
            budgetId: "b", name: "n", amount: 1, kind: .saving, recurrence: .oneOff, accountId: .some("checking")
        )
        #expect(try json(line)["accountId"] as? String == "checking")
        let omitted = BudgetLineCreate(budgetId: "b", name: "n", amount: 1, kind: .saving, recurrence: .oneOff)
        #expect(try json(omitted)["accountId"] == nil)

        let template = TemplateLineCreate(
            name: "n", amount: 1, kind: .expense, recurrence: .fixed, accountId: .some(nil)
        )
        #expect(try json(template)["accountId"] is NSNull)

        let calculator = SpreadCalculator(anchorMonth: 11, anchorYear: 2026)
        let spread = AddBudgetLineSpreadLogic.buildCreate(
            calculator: calculator,
            input: .init(
                name: "n", kind: .expense, amount: 10, mode: .perMonth, conversion: nil,
                spreadGroupId: "g", accountId: "revolut"
            )
        )
        #expect(try json(spread)["accountId"] as? String == "revolut")
        let noAccount = AddBudgetLineSpreadLogic.buildCreate(
            calculator: calculator,
            input: .init(
                name: "n", kind: .expense, amount: 10, mode: .perMonth, conversion: nil,
                spreadGroupId: "g", accountId: .some(nil)
            )
        )
        #expect(try json(noAccount)["accountId"] is NSNull)
        // Flag off: the field never showed, so the key stays out (CA2).
        let flagOff = AddBudgetLineSpreadLogic.buildCreate(
            calculator: calculator,
            input: .init(name: "n", kind: .expense, amount: 10, mode: .perMonth, conversion: nil, spreadGroupId: "g")
        )
        #expect(try json(flagOff)["accountId"] == nil)
    }

    // MARK: - Models

    private func decoder() -> JSONDecoder {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return decoder
    }

    @Test("A budget line decodes with and without accountId, and toggled() keeps it")
    func budgetLineDecoding() throws {
        func decode(_ extra: String) throws -> BudgetLine {
            let json = """
            {"id":"l1","budgetId":"b","templateLineId":null,"savingsGoalId":null,"name":"n","amount":1,
            "kind":"expense","recurrence":"one_off","isManuallyAdjusted":false,"checkedAt":null,
            "createdAt":"2026-11-01T00:00:00Z","updatedAt":"2026-11-01T00:00:00Z"\(extra)}
            """
            return try decoder().decode(BudgetLine.self, from: Data(json.utf8))
        }
        #expect(try decode("").accountId == nil)
        #expect(try decode(",\"accountId\":null").accountId == nil)
        let linked = try decode(",\"accountId\":\"checking\"")
        #expect(linked.accountId == "checking")
        #expect(linked.toggled().accountId == "checking")
    }

    @Test("A transaction decodes with and without accountId, and toggled() keeps it")
    func transactionDecoding() throws {
        func decode(_ extra: String) throws -> Transaction {
            let json = """
            {"id":"t1","budgetId":"b","budgetLineId":null,"name":"Restaurant","amount":80,"kind":"expense",
            "transactionDate":"2026-11-01T00:00:00Z","category":null,"checkedAt":null,
            "createdAt":"2026-11-01T00:00:00Z","updatedAt":"2026-11-01T00:00:00Z"\(extra)}
            """
            return try decoder().decode(Transaction.self, from: Data(json.utf8))
        }
        #expect(try decode("").accountId == nil)
        let linked = try decode(",\"accountId\":\"checking\"")
        #expect(linked.accountId == "checking")
        #expect(linked.toggled().accountId == "checking")
    }

    @Test("A template line decodes with and without accountId")
    func templateLineDecoding() throws {
        func decode(_ extra: String) throws -> TemplateLine {
            let json = """
            {"id":"t1","templateId":"tpl","name":"Loyer","amount":1500,"kind":"expense","recurrence":"fixed",
            "description":"","createdAt":"2026-11-01T00:00:00Z","updatedAt":"2026-11-01T00:00:00Z"\(extra)}
            """
            return try decoder().decode(TemplateLine.self, from: Data(json.utf8))
        }
        #expect(try decode("").accountId == nil)
        #expect(try decode(",\"accountId\":\"checking\"").accountId == "checking")
    }
}
