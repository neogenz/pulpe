import Foundation
@testable import Pulpe
import Testing

@MainActor
struct AssetFormDraftTests {
    private let categories = [
        AssetCategory(id: "c1", name: "Comptes", total: 0),
        AssetCategory(id: "c2", name: "Épargne", total: 0),
        AssetCategory(id: "c3", name: "Leasing", total: 0),
    ]

    private func valid() -> AssetFormDraft {
        var draft = AssetFormDraft()
        draft.name = "Compte UBS"
        draft.category = .existing(id: "c1")
        draft.amount = 12000
        return draft
    }

    @Test func nameTypeAndValueAreRequired() {
        var draft = valid()
        draft.name = "  "
        #expect(!draft.isValid)
        #expect(draft.nameError != nil)

        draft = valid()
        draft.category = nil
        #expect(!draft.isValid)

        draft = valid()
        draft.amount = nil
        #expect(!draft.isValid)

        #expect(valid().isValid)
        #expect(AssetFormDraft().nameError == nil)
    }

    @Test func editing_prefillsTheLastValue_andTheOverdraft() {
        let account = AssetFormDraft(asset: TestDataFactory.makeAsset(latestValue: 1200))
        #expect(account.amount == 1200)
        #expect(!account.isOverdraft)

        let overdrawn = AssetFormDraft(asset: TestDataFactory.makeAsset(latestValue: -300))
        #expect(overdrawn.amount == 300)
        #expect(overdrawn.isOverdraft)
        #expect(overdrawn.signedValue == -300)

        let debt = AssetFormDraft(asset: TestDataFactory.makeAsset(direction: .owe, latestValue: 8000))
        #expect(!debt.isOverdraft)
        #expect(debt.signedValue == 8000)
    }

    // MARK: - Types

    @Test func typesFollowTheDirection_mostUsedFirst() {
        let assets = [
            TestDataFactory.makeAsset(id: "a1", categoryId: "c2"),
            TestDataFactory.makeAsset(id: "a2", categoryId: "c1"),
            TestDataFactory.makeAsset(id: "a3", categoryId: "c2"),
            TestDataFactory.makeAsset(id: "d1", categoryId: "c3", direction: .owe),
        ]

        let own = AssetFormDraft.typeOptions(
            direction: .own, categories: categories, assets: assets, starters: ["Comptes", "Épargne", "Biens"]
        )
        #expect(own.used.map(\.id) == ["c2", "c1"])
        #expect(own.suggestions == ["Biens"])
        #expect(own.defaultChoice == .existing(id: "c2"))
    }

    @Test func aDebtNeverOffersTheTypesOfWhatIHave() {
        let assets = [TestDataFactory.makeAsset(categoryId: "c1")]

        let owe = AssetFormDraft.typeOptions(
            direction: .owe, categories: categories, assets: assets, starters: ["Crédit", "leasing"]
        )
        #expect(owe.used.isEmpty)
        #expect(owe.suggestions == ["Crédit", "leasing"])
        #expect(owe.defaultChoice == .starter(name: "Crédit"))
    }

    @Test func typedNameMatchingAType_resolvesToIt() {
        #expect(AssetFormDraft.choice(forName: " comptes ", existing: categories) == .existing(id: "c1"))
        #expect(AssetFormDraft.choice(forName: "Crypto", existing: categories) == .starter(name: "Crypto"))
        #expect(AssetFormDraft.choice(forName: "  ", existing: categories) == nil)
    }

    // MARK: - Payloads

    @Test func createPayload_signsAnOverdraft_neverADebt() {
        var draft = valid()
        draft.amount = 300
        draft.isOverdraft = true
        #expect(draft.createPayload(categoryId: "c1").value == -300)
        #expect(!draft.createPayload(categoryId: "c1").inPulpe)

        draft.direction = .owe
        #expect(draft.createPayload(categoryId: "c1").value == 300)
    }

    @Test func untouchedEdit_closes_andCreationCreates() {
        let original = TestDataFactory.makeAsset(categoryId: "c1", name: "Compte UBS")

        #expect(AssetFormDraft(asset: original).submission(original: original) == .close)
        #expect(valid().submission(original: nil) == .create)
    }

    @Test func edit_sendsOnlyWhatChanged() {
        let original = TestDataFactory.makeAsset(categoryId: "c1", name: "Compte UBS", latestValue: 1000)

        var value = AssetFormDraft(asset: original)
        value.amount = 1500
        #expect(value.submission(original: original) == .edit(AssetEdit(value: 1500)))

        var name = AssetFormDraft(asset: original)
        name.name = " UBS "
        #expect(name.submission(original: original) == .edit(AssetEdit(updates: AssetUpdate(name: "UBS"))))

        var type = AssetFormDraft(asset: original)
        type.category = .starter(name: "Crypto")
        #expect(type.submission(original: original) == .edit(AssetEdit(category: .starter(name: "Crypto"))))

        var overdraft = AssetFormDraft(asset: original)
        overdraft.isOverdraft = true
        #expect(overdraft.submission(original: original) == .edit(AssetEdit(value: -1000)))
    }
}
