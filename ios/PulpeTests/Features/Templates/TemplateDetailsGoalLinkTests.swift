import Foundation
@testable import Pulpe
import Testing

@Suite("Template details goal link")
@MainActor
struct TemplateDetailsGoalLinkTests {
    private func makeGoal(id: String = "goal-1", name: String = "Maison") -> SavingsGoal {
        SavingsGoal(
            id: id,
            userId: "user-1",
            name: name,
            targetAmount: 100_000,
            targetDate: "2030-12-31",
            status: .active,
            createdAt: Date(timeIntervalSince1970: 0),
            updatedAt: Date(timeIntervalSince1970: 0)
        )
    }

    @Test("a linked template line resolves the goal name")
    func linkedLine_resolvesGoalName() {
        let goals = [makeGoal(name: "Maison")]

        #expect(TemplateLineRow.goalName(for: "goal-1", in: goals) == "Maison")
    }

    @Test("an unlinked template line stays unchanged")
    func unlinkedLine_hasNoGoalName() {
        #expect(TemplateLineRow.goalName(for: nil, in: [makeGoal()]) == nil)
    }

    @Test("an unknown goal id stays unchanged")
    func unknownGoal_hasNoGoalName() {
        #expect(TemplateLineRow.goalName(for: "missing", in: [makeGoal()]) == nil)
    }

    @Test("renaming a goal updates the name for the same id")
    func renamedGoal_updatesResolvedName() async throws {
        let service = MockSavingsGoalService()
        service.stubbedGoals = [makeGoal(name: "Maison")]
        let store = SavingsGoalStore(service: service)
        await store.loadIfNeeded()

        #expect(TemplateLineRow.goalName(for: "goal-1", in: store.goals) == "Maison")

        _ = try await store.update(
            id: "goal-1",
            data: SavingsGoalUpdate(name: "Voyage")
        )

        #expect(TemplateLineRow.goalName(for: "goal-1", in: store.goals) == "Voyage")
    }

    @Test("a cold template entry loads the shared list at most once")
    func coldEntry_loadsGoalListOnce() async {
        let service = MockSavingsGoalService()
        service.stubbedGoals = [makeGoal()]
        let store = SavingsGoalStore(service: service)

        await store.loadIfNeeded()
        _ = TemplateLineRow.goalName(for: "goal-1", in: store.goals)
        _ = TemplateLineRow.goalName(for: "goal-1", in: store.goals)
        _ = TemplateLineRow.goalName(for: "missing", in: store.goals)

        #expect(service.getAllCallCount == 1)
    }

    @Test("a cached template entry performs no additional GET")
    func cachedEntry_doesNotReloadGoalList() async {
        let service = MockSavingsGoalService()
        service.stubbedGoals = [makeGoal()]
        let store = SavingsGoalStore(service: service)
        await store.loadIfNeeded()
        let callCountBeforeEntry = service.getAllCallCount

        await store.loadIfNeeded()

        #expect(callCountBeforeEntry == 1)
        #expect(service.getAllCallCount == callCountBeforeEntry)
    }
}
