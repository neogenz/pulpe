import Foundation
@testable import Pulpe
import Testing

/// The Test Scope of the web `reconcile-account-links.spec.ts`, plus the write on completion.
@MainActor
struct ReconcileLinkedAccountsTests {
    private let bcge = TestDataFactory.makeAsset(id: "bcge", name: "BCGE", inPulpe: true)
    private let revolut = TestDataFactory.makeAsset(id: "revolut", name: "Revolut")

    // MARK: - Rows

    @Test func followedAccountsSeedOneRowEach_theOthersWaitInTheMenu() {
        let flow = makeFlow([bcge, revolut])

        #expect(flow.accounts.map(\.label) == ["BCGE"])
        #expect(flow.accounts[0].amountText.isEmpty)
        #expect(flow.asset(id: flow.accounts[0].id)?.id == "bcge")
        #expect(flow.linksToNetWorth)
        #expect(flow.linkPlan.isEmpty)
    }

    @Test func monPatrimoineOff_keepsOneEmptyRow_andWritesNothing() {
        let flow = makeFlow(nil)
        flow.accounts[0].amountText = "100"
        flow.setAddToNetWorth(id: flow.accounts[0].id, true)
        flow.accounts[0].label = "Neon"

        #expect(flow.accounts.count == 1)
        #expect(!flow.linksToNetWorth)
        #expect(flow.linkPlan.isEmpty)
    }

    @Test func anAccountIsOfferedToOneRowOnly() {
        let flow = makeFlow([bcge, revolut])
        let added = flow.addAccount()

        #expect(flow.choices(for: added).map(\.id) == ["revolut"])
        #expect(flow.choices(for: flow.accounts[0].id).map(\.id) == ["bcge", "revolut"])
    }

    // MARK: - Plan

    @Test func pickingAnAccountOnANewRow_followsItAndRecordsItsBalance() {
        let flow = makeFlow([bcge, revolut])
        flow.accounts[0].amountText = "12300"
        let added = flow.addAccount()
        flow.selectAccount(id: added, revolut)
        flow.accounts[1].amountText = "50"

        #expect(flow.accounts[1].label == "Revolut")
        #expect(flow.linkPlan == .init(
            links: ["revolut"],
            snapshots: [
                AssetSnapshotItem(assetId: "bcge", value: 12300), AssetSnapshotItem(assetId: "revolut", value: 50),
            ]
        ))
    }

    @Test func anotherAccountAddedToMonPatrimoine_isCreatedWithoutASnapshotOnTop() {
        let flow = makeFlow([bcge])
        let added = flow.addAccount()
        flow.accounts[1].label = " Neon "
        flow.accounts[1].amountText = "300"
        flow.setAddToNetWorth(id: added, true)

        #expect(flow.linkPlan == .init(creates: [.init(name: "Neon", value: 300)]))
    }

    @Test func aTypedLineLeftOutOfMonPatrimoine_writesNothing() {
        let flow = makeFlow([bcge])
        flow.addAccount()
        flow.accounts[1].label = "Enveloppe"
        flow.accounts[1].amountText = "40"

        #expect(flow.linkPlan.isEmpty)
    }

    @Test func removingAFollowedRow_stopsFollowingIt_withoutSnapshot() {
        let flow = makeFlow([bcge, revolut])
        let added = flow.addAccount()
        flow.accounts[1].amountText = "50"

        #expect(flow.canRemoveAccount(id: flow.accounts[0].id))
        flow.removeAccount(id: flow.accounts[0].id)

        #expect(flow.accounts.map(\.id) == [added])
        #expect(flow.linkPlan == .init(unlinks: ["bcge"]))
    }

    @Test func turningAFollowedRowIntoAnotherAccount_stopsFollowingIt() {
        let flow = makeFlow([bcge])
        flow.selectAccount(id: flow.accounts[0].id, nil)

        #expect(flow.accounts[0].label.isEmpty)
        #expect(flow.linkPlan == .init(unlinks: ["bcge"]))
    }

    @Test func negativeRowIsSnapshottedAsNegative_andAnInvalidOneIsNot() {
        let flow = makeFlow([bcge])
        flow.accounts[0].amountText = "80.50"
        flow.accounts[0].isNegative = true
        #expect(flow.linkPlan.snapshots == [AssetSnapshotItem(assetId: "bcge", value: -80.5)])

        flow.accounts[0].amountText = "abc"
        #expect(flow.linkPlan.isEmpty)
    }

    @Test func theSameAccountOnTwoRows_isSnapshottedOnce() {
        let flow = makeFlow([bcge])
        flow.accounts[0].amountText = "10"
        flow.selectAccount(id: flow.addAccount(), bcge)
        flow.accounts[1].amountText = "20"

        #expect(flow.linkPlan.snapshots.map(\.assetId) == ["bcge"])
        #expect(flow.linkPlan.links.isEmpty)
    }

    // MARK: - Name

    @Test func addingToMonPatrimoineWithoutAName_cannotFinish() {
        let flow = makeFlow([])
        let id = flow.accounts[0].id
        flow.accounts[0].amountText = "100"
        flow.setAddToNetWorth(id: id, true)

        #expect(flow.isNameMissing(id: id))
        #expect(!flow.canConfirmUpToDate(realizedBalance: 100, of: "b"))
        #expect(!flow.canSubmitAdjustment(realizedBalance: 40, of: "b"))

        flow.accounts[0].label = "Neon"
        #expect(!flow.isNameMissing(id: id))
        #expect(flow.canConfirmUpToDate(realizedBalance: 100, of: "b"))
    }

    @Test func addingToMonPatrimoineWithoutABalance_cannotFinish() {
        let flow = makeFlow([bcge])
        flow.accounts[0].amountText = "100"
        let id = flow.addAccount()
        flow.accounts[1].label = "Neon"
        flow.setAddToNetWorth(id: id, true)

        #expect(flow.isBalanceMissing(id: id))
        #expect(!flow.canConfirmUpToDate(realizedBalance: 100, of: "b"))
        #expect(!flow.canSubmitAdjustment(realizedBalance: 40, of: "b"))

        flow.accounts[1].amountText = "0"
        #expect(!flow.isBalanceMissing(id: id))
        #expect(flow.canConfirmUpToDate(realizedBalance: 100, of: "b"))
    }

    // MARK: - Write

    @Test func completion_createsThenLinksThenUnlinksThenOneBatch() async {
        let service = MockAssetService()
        let flow = makeFlow([bcge, revolut])
        flow.removeAccount(id: flow.addAndReturnFirst())
        flow.selectAccount(id: flow.accounts[0].id, revolut)
        flow.accounts[0].amountText = "60"
        flow.addAccount()
        flow.accounts[1].label = "Neon"
        flow.accounts[1].amountText = "40"
        flow.setAddToNetWorth(id: flow.accounts[1].id, true)
        _ = flow.confirmUpToDate(realizedBalance: 100, of: "b")

        await flow.applyAccountLinks(
            into: AssetStore(service: service), currency: .chf, toastManager: ToastManager()
        )

        #expect(service.calls == ["createCategory", "create", "update", "update", "snapshots", "get"])
        #expect(service.lastCreate?.inPulpe == true)
        #expect(service.lastCreate?.name == "Neon")
        #expect(service.updates == [
            "revolut": AssetUpdate(inPulpe: true), "bcge": AssetUpdate(inPulpe: false),
        ])
    }

    @Test func refusedLink_showsItsOwnToast_andRecordsNoBalance() async {
        let service = MockAssetService()
        service.updateError = APIError.assetCreateFailed
        let toast = ToastManager()
        let flow = makeFlow([bcge, revolut])
        flow.accounts[0].amountText = "40"
        flow.selectAccount(id: flow.addAccount(), revolut)
        flow.accounts[1].amountText = "60"
        _ = flow.confirmUpToDate(realizedBalance: 100, of: "b")

        await flow.applyAccountLinks(into: AssetStore(service: service), currency: .chf, toastManager: toast)

        #expect(service.calls == ["update", "get"])
        #expect(toast.currentToast?.type == .error)
    }

    @Test func dismiss_writesNothing() async {
        let service = MockAssetService()
        let flow = makeFlow([bcge, revolut])
        flow.accounts[0].amountText = "100"

        await flow.applyAccountLinks(
            into: AssetStore(service: service), currency: .chf, toastManager: ToastManager()
        )

        #expect(service.calls.isEmpty)
    }

    @Test func failure_showsToast_andKeepsTheCompletedFlow() async {
        let service = MockAssetService()
        service.snapshotsError = APIError.assetCreateFailed
        let toast = ToastManager()
        let flow = makeFlow([bcge])
        flow.accounts[0].amountText = "100"
        _ = flow.confirmUpToDate(realizedBalance: 100, of: "b")

        await flow.applyAccountLinks(into: AssetStore(service: service), currency: .chf, toastManager: toast)

        #expect(toast.currentToast?.type == .error)
        #expect(flow.isCompleted)
    }

    private func makeFlow(_ accounts: [Asset]?) -> ReconcileAccountsFlow {
        ReconcileAccountsFlow(
            budgetId: "b",
            adjustmentLabel: "Ajustement",
            createTransaction: { _ in throw CancellationError() },
            onAdjustmentCreated: { _ in },
            onCompleted: { _ in },
            netWorthAccounts: accounts
        )
    }
}

private extension ReconcileAccountsFlow {
    /// Adds a row so the first one can go, and returns the first one's id.
    func addAndReturnFirst() -> AccountReconciliation.Account.ID {
        let first = accounts[0].id
        addAccount()
        return first
    }
}
