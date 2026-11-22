import Foundation
@testable import Pulpe
import Testing

/// The Test Scope of the web `reconcile-account-links.spec.ts`, plus the write on completion.
@MainActor
struct ReconcileLinkedAccountsTests {
    private let bcge = TestDataFactory.makeAsset(id: "bcge", name: "BCGE", inPulpe: true)
    private let revolut = TestDataFactory.makeAsset(id: "revolut", name: "Revolut")
    private let card = TestDataFactory.makeAsset(id: "card", name: "Carte", direction: .owe)

    // MARK: - Rows

    @Test func followedAccountsSeedOneRowEach_theOthersWaitInTheAddSheet() {
        let flow = makeFlow([bcge, revolut, card])

        #expect(flow.accounts.map(\.label) == ["BCGE"])
        #expect(flow.accounts[0].amountText.isEmpty)
        #expect(flow.asset(id: flow.accounts[0].id)?.id == "bcge")
        #expect(flow.linksToNetWorth)
        #expect(flow.linkPlan.isEmpty)
        #expect(flow.addableAssets(excluding: []).map(\.id) == ["revolut", "card"])
    }

    @Test func aFollowedDebtOpensOnTheOwingSide() {
        let flow = makeFlow([card.followed])

        #expect(flow.accounts.map(\.isOwed) == [true])
        #expect(flow.hasOwedRow)
    }

    @Test func monPatrimoineOff_hasFreeRowsOnly_andWritesNothing() {
        let flow = makeFlow(nil)
        flow.accounts[0].amountText = "100"
        flow.accounts[0].label = "Neon"

        #expect(flow.accounts.count == 1)
        #expect(!flow.linksToNetWorth)
        #expect(flow.addableAssets(excluding: []).isEmpty)
        #expect(flow.linkPlan.isEmpty)
    }

    @Test func anItemInTheListOrFedBySavings_isNotOffered() {
        let flow = makeFlow([bcge, revolut, card])
        flow.addAsset(revolut)

        #expect(flow.addableAssets(excluding: ["card"]).isEmpty)
        #expect(flow.addableAssets(excluding: []).map(\.id) == ["card"])
    }

    @Test func onlyASavingPrevisionHidesItsItem() {
        let checking = ReconciliationChecking(
            items: [], transactions: [],
            budgetLines: [
                makeLine(id: "l1", kind: .saving, assetId: "bcge"),
                makeLine(id: "l2", kind: .expense, assetId: "revolut"),
                makeLine(id: "l3", kind: .saving, assetId: nil),
            ],
            syncingTransactionIds: [], syncingBudgetLineIds: [], toggle: { _ in false }
        )

        #expect(checking.savingAssetIds == ["bcge"])
    }

    // MARK: - Plan

    @Test func addingAnItem_followsItAndRecordsItsBalance() {
        let flow = makeFlow([bcge, revolut])
        flow.accounts[0].amountText = "12300"
        let added = flow.addAsset(revolut)
        flow.accounts[1].amountText = "50"

        #expect(flow.accounts[1].label == "Revolut")
        #expect(flow.assetIds[added] == "revolut")
        #expect(flow.linkPlan == .init(
            links: ["revolut"],
            snapshots: [
                AssetSnapshotItem(assetId: "bcge", value: 12300), AssetSnapshotItem(assetId: "revolut", value: 50),
            ]
        ))
    }

    @Test func aFreeRow_writesNothingToMonPatrimoine() {
        let flow = makeFlow([bcge])
        flow.addFreeAccount(isOwed: false)
        flow.accounts[1].label = "Enveloppe"
        flow.accounts[1].amountText = "40"

        #expect(flow.linkPlan.isEmpty)
        #expect(flow.freeAccountEntries == [.init(name: "Enveloppe", isOwed: false)])
    }

    @Test func removingAFollowedRow_stopsFollowingIt_withoutSnapshot() {
        let flow = makeFlow([bcge, revolut])
        flow.addAsset(revolut)
        flow.accounts[1].amountText = "50"

        flow.removeAccount(id: flow.accounts[0].id)

        #expect(flow.accounts.map(\.label) == ["Revolut"])
        #expect(flow.linkPlan == .init(
            links: ["revolut"], unlinks: ["bcge"], snapshots: [AssetSnapshotItem(assetId: "revolut", value: 50)]
        ))
    }

    @Test func aDebtIsSnapshottedAsWhatRemains_andAnInvalidAmountIsNot() {
        let flow = makeFlow([card.followed])
        flow.accounts[0].amountText = "800"
        #expect(flow.linkPlan.snapshots == [AssetSnapshotItem(assetId: "card", value: 800)])

        flow.accounts[0].amountText = "abc"
        #expect(flow.linkPlan.isEmpty)
    }

    @Test func anItemGoneDuringTheLock_comesBackAsAFreeRow_andIsNotWritten() throws {
        let typed = makeFlow([bcge, revolut.followed])
        typed.accounts[0].amountText = "3000"
        typed.accounts[1].amountText = "500"
        let draft = try #require(typed.draft)

        // Revolut was deleted on another device while the app was locked.
        let restored = makeFlow([bcge], restoring: draft)

        #expect(restored.accounts.map(\.label) == ["BCGE", "Revolut"])
        #expect(restored.accounts.map(\.amountText) == ["3000", "500"])
        #expect(restored.asset(id: restored.accounts[1].id) == nil)
        #expect(restored.linkPlan == .init(snapshots: [AssetSnapshotItem(assetId: "bcge", value: 3000)]))

        // Unread, nothing is known gone: both rows stay linked, so no name is kept as a free one.
        #expect(makeFlow(nil, restoring: draft).freeAccountEntries.isEmpty)
    }

    // MARK: - Write

    @Test func completion_linksThenUnlinksThenOneBatch() async {
        let service = MockAssetService()
        let flow = makeFlow([bcge, revolut])
        flow.addAsset(revolut)
        flow.removeAccount(id: flow.accounts[0].id)
        flow.accounts[0].amountText = "100"
        await flow.loadContext()
        _ = flow.finishWithoutEntry(of: "b")

        await flow.applyAccountLinks(into: AssetStore(service: service), toastManager: ToastManager())

        #expect(service.calls == ["update", "update", "snapshots", "get"])
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
        flow.addAsset(revolut)
        flow.accounts[1].amountText = "60"
        await flow.loadContext()
        _ = flow.finishWithoutEntry(of: "b")

        await flow.applyAccountLinks(into: AssetStore(service: service), toastManager: toast)

        #expect(service.calls == ["update", "get"])
        #expect(toast.currentToast?.type == .error)
    }

    @Test func dismiss_writesNothing() async {
        let service = MockAssetService()
        let flow = makeFlow([bcge, revolut])
        flow.accounts[0].amountText = "100"

        await flow.applyAccountLinks(
            into: AssetStore(service: service), toastManager: ToastManager()
        )

        #expect(service.calls.isEmpty)
    }

    @Test func failure_showsToast_andKeepsTheCompletedFlow() async {
        let service = MockAssetService()
        service.snapshotsError = APIError.assetCreateFailed
        let toast = ToastManager()
        let flow = makeFlow([bcge])
        flow.accounts[0].amountText = "100"
        await flow.loadContext()
        _ = flow.finishWithoutEntry(of: "b")

        await flow.applyAccountLinks(into: AssetStore(service: service), toastManager: toast)

        #expect(toast.currentToast?.type == .error)
        #expect(flow.isCompleted)
    }

    @Test("« Oui, c'était déjà là » then any exit records the balances once, without Terminer")
    func keptAsStartingAmount_recordsTheBalancesOnce() async {
        let service = MockAssetService()
        let store = AssetStore(service: service)
        let flow = makeFlow([bcge])
        flow.accounts[0].amountText = "100"
        flow.compare()
        await flow.loadContext()

        #expect(await flow.keepGapAsStartingAmount(realizedBalance: 0, of: "b") == .written)
        await flow.applyAccountLinks(into: store, toastManager: ToastManager())
        await flow.applyAccountLinks(into: store, toastManager: ToastManager())

        #expect(!flow.isCompleted)
        #expect(service.calls == ["snapshots", "get"])
    }

    @Test("the lock taking the sheet after « Oui » saves nothing; the restored sheet saves once on its real close")
    func lockAfterKeptAmount_savesOnlyOnTheRealClose() async throws {
        let service = MockAssetService()
        let store = AssetStore(service: service)
        let flow = makeFlow([bcge])
        flow.accounts[0].amountText = "100"
        flow.compare()
        await flow.loadContext()
        #expect(await flow.keepGapAsStartingAmount(realizedBalance: 0, of: "b") == .written)
        flow.editAccounts()

        await flow.applyAccountLinks(into: store, toastManager: ToastManager(), isLocked: true)
        #expect(service.calls.isEmpty)

        let draft = try #require(flow.draft)
        #expect(draft.didCompleteComparison)
        let restored = makeFlow([bcge], restoring: draft)
        restored.accounts[0].amountText = "150"
        await restored.applyAccountLinks(into: store, toastManager: ToastManager())
        await restored.applyAccountLinks(into: store, toastManager: ToastManager())

        #expect(service.calls == ["snapshots", "get"])
        #expect(service.snapshotItems == [AssetSnapshotItem(assetId: "bcge", value: 150)])
    }

    @Test("two comparisons completed in one sheet record the balances once, as the rows stand at the close")
    func twoComparisons_recordTheLastBalancesOnce() async {
        let service = MockAssetService()
        let flow = makeFlow([bcge])
        flow.accounts[0].amountText = "4000"
        flow.compare()
        await flow.loadContext()
        #expect(await flow.keepGapAsStartingAmount(realizedBalance: 0, of: "b") == .written)

        flow.editAccounts()
        flow.accounts[0].amountText = "4200"
        flow.compare()
        await flow.loadContext()
        #expect(flow.finishWithoutEntry(of: "b"))
        await flow.applyAccountLinks(into: AssetStore(service: service), toastManager: ToastManager())

        #expect(service.calls == ["snapshots", "get"])
        #expect(service.snapshotItems == [AssetSnapshotItem(assetId: "bcge", value: 4200)])
    }

    private func makeLine(id: String, kind: TransactionKind, assetId: String?) -> BudgetLine {
        BudgetLine(
            id: id, budgetId: "b", templateLineId: nil, savingsGoalId: nil, name: id, amount: 100,
            kind: kind, recurrence: .fixed, isManuallyAdjusted: false, checkedAt: nil,
            createdAt: TestDataFactory.fixedDate, updatedAt: TestDataFactory.fixedDate, assetId: assetId
        )
    }

    private func makeFlow(
        _ accounts: [Asset]?,
        restoring draft: ReconcileAccountsFlow.Draft? = nil
    ) -> ReconcileAccountsFlow {
        ReconcileAccountsFlow(
            budgetId: "b",
            entryName: "Écart avec mes comptes",
            createTransaction: { _ in throw CancellationError() },
            fetchContext: { _ in TestDataFactory.createReconciliationContext() },
            // The server takes every answer: « Oui, c'était déjà là » completes the comparison.
            updateState: { ReconciliationState(startingAmount: $0.startingAmount ?? 0, hasCompletedComparison: true) },
            onAdjustmentCreated: { _ in },
            onCompleted: { _ in },
            netWorthAccounts: accounts,
            restoring: draft
        )
    }
}

private extension Asset {
    /// The same item, followed in Pulpe.
    var followed: Asset {
        TestDataFactory.makeAsset(id: id, categoryId: categoryId, name: name, direction: direction, inPulpe: true)
    }
}
