import Foundation
@testable import Pulpe
import Testing

/// `BudgetDetailsScreenState.content` is what the page body switches on. The
/// first case is the one build 10 shipped blank: cold stores, nothing loaded,
/// no error, not loading. It projects to `.loading`, never to nothing.
@Suite(.serialized)
@MainActor
struct BudgetDetailsContentStateTests {
    private func content(of stack: ProjectionTestStack.StoreStack) -> BudgetDetailsScreenState.Content {
        BudgetDetailsProjector.project(
            dataStore: stack.data,
            filtersStore: stack.filters,
            syncStore: stack.sync,
            searchText: ""
        ).content
    }

    @Test func coldStores_projectLoading() {
        let stack = ProjectionTestStack.makeStores()

        #expect(content(of: stack) == .loading)
    }

    @Test func loadingFlagAlone_projectsLoading() {
        let stack = ProjectionTestStack.makeStores()
        stack.sync.setLoading(true)

        #expect(content(of: stack) == .loading)
    }

    @Test func budgetPresent_projectsLoaded() {
        let stack = ProjectionTestStack.makeStores()
        stack.data.setBudget(TestDataFactory.createBudget())

        #expect(content(of: stack) == .loaded)
    }

    @Test func errorWithoutBudget_projectsFailed() {
        let stack = ProjectionTestStack.makeStores()
        stack.sync.setError(APIError.notFound)

        #expect(content(of: stack) == .failed)
    }

    @Test func errorWithBudgetOnScreen_staysLoaded() {
        let stack = ProjectionTestStack.makeStores()
        stack.data.setBudget(TestDataFactory.createBudget())
        stack.sync.setError(APIError.notFound)

        #expect(content(of: stack) == .loaded)
    }
}
