import Foundation
@testable import Pulpe
import Testing

@MainActor
struct ReconcileLinkedAccountsTests {
    private let ubs = TestDataFactory.makeAsset(id: "a1", name: "UBS")
    private let post = TestDataFactory.makeAsset(id: "a2", name: "PostFinance")

    @Test func linkedAssetsSeedOneRowEachWithEmptyAmount() {
        let flow = makeFlow([ubs, post])

        #expect(flow.accounts.map(\.label) == ["UBS", "PostFinance"])
        #expect(flow.accounts.allSatisfy { $0.amountText.isEmpty })
        #expect(flow.lastValueHint(id: flow.accounts[1].id)?.id == "a2")
        #expect(flow.hasLinkedAccounts)
    }

    @Test func noLinkedAccountKeepsOneEmptyRow() {
        let flow = makeFlow([])

        #expect(flow.accounts.count == 1)
        #expect(flow.accounts[0].label.isEmpty)
        #expect(!flow.hasLinkedAccounts)
        #expect(flow.linkedSnapshotItems.isEmpty)
    }

    @Test func onlyFilledLinkedRowsAreSnapshotted() {
        let flow = makeFlow([ubs, post])
        flow.accounts[0].amountText = "12300"
        let free = flow.addAccount()
        flow.accounts[2].amountText = "50"

        #expect(flow.linkedSnapshotItems == [AssetSnapshotItem(assetId: "a1", value: 12300)])
        #expect(flow.lastValueHint(id: free) == nil)
    }

    @Test func negativeRowIsSnapshottedAsNegative() {
        let flow = makeFlow([ubs])
        flow.accounts[0].amountText = "80.50"
        flow.accounts[0].isNegative = true

        #expect(flow.linkedSnapshotItems == [AssetSnapshotItem(assetId: "a1", value: -80.5)])
    }

    @Test func invalidRowIsNotSnapshotted() {
        let flow = makeFlow([ubs])
        flow.accounts[0].amountText = "abc"

        #expect(flow.linkedSnapshotItems.isEmpty)
    }

    private func makeFlow(_ linked: [Asset]) -> ReconcileAccountsFlow {
        ReconcileAccountsFlow(
            budgetId: "b",
            adjustmentLabel: "Ajustement",
            createTransaction: { _ in throw CancellationError() },
            onAdjustmentCreated: { _ in },
            onCompleted: { _ in },
            linkedAccounts: linked
        )
    }
}
