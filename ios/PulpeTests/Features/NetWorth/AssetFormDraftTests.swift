import Foundation
@testable import Pulpe
import Testing

@MainActor
struct AssetFormDraftTests {
    private func valid() -> AssetFormDraft {
        var draft = AssetFormDraft()
        draft.name = "Compte UBS"
        draft.category = .existing(id: "c1")
        draft.amount = 12000
        return draft
    }

    @Test func emptyNameOrNoCategory_isInvalid() {
        var draft = valid()
        draft.name = "  "
        #expect(!draft.isValid)
        #expect(draft.nameError != nil)

        draft = valid()
        draft.category = nil
        #expect(!draft.isValid)
        #expect(valid().isValid)
        #expect(AssetFormDraft().nameError == nil)
    }

    @Test func suggestionsDropUsedNames_ignoringCase() {
        let starters = ["Comptes", "Épargne", "Biens"]
        let left = AssetFormDraft.starterSuggestions(existing: ["comptes", "ÉPARGNE"], starters: starters)

        #expect(left == ["Biens"])
    }

    @Test func typedNameMatchingACategory_resolvesToIt() {
        let existing = [AssetCategory(id: "c1", name: "Comptes", total: 0)]

        #expect(AssetFormDraft.choice(forName: " comptes ", existing: existing) == .existing(id: "c1"))
        #expect(AssetFormDraft.choice(forName: "Crypto", existing: existing) == .starter(name: "Crypto"))
        #expect(AssetFormDraft.choice(forName: "  ", existing: existing) == nil)
    }

    @Test func createPayload_neverNegative_andDebtIsNotInPulpe() {
        var draft = valid()
        draft.amount = -50
        draft.direction = .owe
        draft.inPulpe = true
        let payload = draft.createPayload(categoryId: "c1")

        #expect(payload.value == 0)
        #expect(!payload.inPulpe)
        #expect(payload.name == "Compte UBS")
    }

    @Test func updatePayload_sendsOnlyChangedKeys() {
        let original = TestDataFactory.makeAsset(categoryId: "c1", name: "Compte UBS")
        var draft = AssetFormDraft(asset: original)

        #expect(draft.updatePayload(original: original) == AssetUpdate())
        #expect(draft.categoryChange(from: original) == nil)

        draft.name = " UBS "
        draft.category = .starter(name: "Crypto")
        #expect(draft.updatePayload(original: original) == AssetUpdate(name: "UBS"))
        #expect(draft.categoryChange(from: original) == .starter(name: "Crypto"))
    }
}
