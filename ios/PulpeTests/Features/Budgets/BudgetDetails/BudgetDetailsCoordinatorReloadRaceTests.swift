import Foundation
@testable import Pulpe
import Testing

/// Regression harness for PUL-257 — `reloadCurrentBudget()` had no coalescing,
/// so a reload whose network fetch finished AFTER a concurrent optimistic
/// mutation would blindly `applyDetails(...)` and silently revert it (lost
/// toggle / add / edit on fast month-nav or a detached post-save reload).
///
/// The fix is a generation token on `BudgetDataStore`: every optimistic local
/// mutation bumps `mutationGeneration`; a reload captures it before its fetch
/// and drops the snapshot via `applyDetails(_:ifGenerationMatches:)` when a
/// mutation landed mid-flight. A `MockBudgetService` gate reproduces the race
/// deterministically — no sleeps, no flakiness. They fail on the pre-fix code.
@Suite(.serialized)
@MainActor
struct BudgetDetailsCoordinatorReloadRaceTests {
    @Test
    func reload_staleSnapshotDuringConcurrentToggle_doesNotClobberMutation() async {
        let budgetId = "pul257-stale"
        BudgetDetailCache.shared.invalidate(budgetId: budgetId)
        let budgetService = MockBudgetService()
        let lineService = MockBudgetLineService()
        let coord = BudgetDetailsCoordinator(
            budgetId: budgetId,
            budgetService: budgetService,
            budgetLineService: lineService
        )
        let line = TestDataFactory.createBudgetLine(id: "line-1", isChecked: false)
        await coord.dispatch(.addBudgetLine(line))

        // The reload's snapshot is STALE: captured before the toggle, line still
        // unchecked. The server-confirmed toggle returns the line checked.
        budgetService.stubbedDetails = BudgetDetails(
            budget: TestDataFactory.createBudget(),
            transactions: [],
            budgetLines: [line]
        )
        lineService.stubbedToggle = line.toggled()
        budgetService.gateDetails()

        // Start the reload; it suspends inside getBudgetWithDetails.
        let reload = Task { await coord.reloadCurrentBudget() }
        await waitForCondition { budgetService.didEnterDetails }

        // Mid-reload: the user toggles the line. Optimistic apply flips it
        // checked and the server toggle completes — the mutation finishes
        // "between" the reload's fetch start and its apply.
        await coord.toggleBudgetLine(line)
        #expect(coord.dataStore.budgetLines.first?.isChecked == true)

        // Release the stale reload (its snapshot still has the line unchecked).
        budgetService.releaseDetails()
        await reload.value

        // Fix: the stale snapshot is dropped → the toggle survives.
        #expect(coord.dataStore.budgetLines.first?.isChecked == true)

        BudgetDetailCache.shared.invalidate(budgetId: budgetId)
    }

    @Test
    func reload_withoutConcurrentMutation_appliesServerSnapshot() async {
        let budgetId = "pul257-fresh"
        BudgetDetailCache.shared.invalidate(budgetId: budgetId)
        let budgetService = MockBudgetService()
        let coord = BudgetDetailsCoordinator(
            budgetId: budgetId,
            budgetService: budgetService
        )
        let line = TestDataFactory.createBudgetLine(id: "line-1", isChecked: false)
        await coord.dispatch(.addBudgetLine(line))

        // No gate, no concurrent mutation: the server snapshot (line checked)
        // must apply normally — the guard must not break the happy path.
        budgetService.stubbedDetails = BudgetDetails(
            budget: TestDataFactory.createBudget(),
            transactions: [],
            budgetLines: [line.toggled()]
        )

        await coord.reloadCurrentBudget()

        #expect(coord.dataStore.budgetLines.first?.isChecked == true)

        BudgetDetailCache.shared.invalidate(budgetId: budgetId)
    }
}

/// Unit-level lock on the generation token mechanism that backs the fix above.
@Suite(.serialized)
@MainActor
struct BudgetDataStoreGenerationTests {
    @Test
    func optimisticMutations_bumpGeneration() {
        let store = BudgetDataStore(budgetId: "gen-bump")
        let start = store.mutationGeneration

        store.appendBudgetLine(TestDataFactory.createBudgetLine(id: "l1"))
        store.appendTransaction(TestDataFactory.createTransaction(id: "t1"))
        store.removeBudgetLine(id: "l1")

        #expect(store.mutationGeneration == start + 3)
    }

    @Test
    func applyDetails_withMatchingGeneration_applies() {
        let budgetId = "gen-match"
        BudgetDetailCache.shared.invalidate(budgetId: budgetId)
        let store = BudgetDataStore(budgetId: budgetId)
        let captured = store.mutationGeneration

        let details = BudgetDetails(
            budget: TestDataFactory.createBudget(),
            transactions: [TestDataFactory.createTransaction(id: "tx-1")],
            budgetLines: []
        )
        let applied = store.applyDetails(details, ifGenerationMatches: captured)

        #expect(applied)
        #expect(store.transactions.contains { $0.id == "tx-1" })

        BudgetDetailCache.shared.invalidate(budgetId: budgetId)
    }

    @Test
    func applyDetails_withStaleGeneration_isDroppedAndPreservesMutation() {
        let budgetId = "gen-stale"
        BudgetDetailCache.shared.invalidate(budgetId: budgetId)
        let store = BudgetDataStore(budgetId: budgetId)
        let captured = store.mutationGeneration

        // An optimistic mutation lands after the generation was captured.
        store.appendTransaction(TestDataFactory.createTransaction(id: "optimistic-tx"))

        // A reload that started before the mutation tries to apply a snapshot
        // that predates it (no transactions).
        let staleDetails = BudgetDetails(
            budget: TestDataFactory.createBudget(),
            transactions: [],
            budgetLines: []
        )
        let applied = store.applyDetails(staleDetails, ifGenerationMatches: captured)

        #expect(!applied)
        #expect(store.transactions.contains { $0.id == "optimistic-tx" })

        BudgetDetailCache.shared.invalidate(budgetId: budgetId)
    }
}
