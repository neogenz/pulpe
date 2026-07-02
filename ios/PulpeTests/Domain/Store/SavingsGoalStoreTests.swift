import Foundation
@testable import Pulpe
import Testing

@MainActor
struct SavingsGoalStoreTests {
    private func makeGoal(
        id: String,
        name: String = "Goal",
        status: SavingsGoalStatus = .active
    ) -> SavingsGoal {
        SavingsGoal(
            id: id,
            userId: "user-1",
            name: name,
            targetAmount: 1000,
            targetDate: "2099-01-01",
            status: status,
            createdAt: Date(timeIntervalSince1970: 0),
            updatedAt: Date(timeIntervalSince1970: 0)
        )
    }

    @Test("forceRefresh loads goals, ACTIVE before COMPLETED")
    func forceRefresh_loadsAndSorts() async {
        let service = MockSavingsGoalService()
        service.stubbedGoals = [
            makeGoal(id: "done", name: "Alpha", status: .completed),
            makeGoal(id: "active", name: "Zebra", status: .active),
        ]
        let store = SavingsGoalStore(service: service)

        await store.forceRefresh()

        #expect(store.goals.count == 2)
        #expect(store.goals.first?.status == .active, "ACTIVE goals sort before COMPLETED")
        #expect(store.goals.last?.status == .completed)
        #expect(store.hasLoadedOnce)
        #expect(store.error == nil)
    }

    @Test("create appends to the cache and forwards the DTO")
    func create_appends() async throws {
        let service = MockSavingsGoalService()
        let store = SavingsGoalStore(service: service)

        let created = try await store.create(
            SavingsGoalCreate(name: "Maison", targetAmount: 5000, targetDate: "2099-01-01", status: .active)
        )

        #expect(store.goals.count == 1)
        #expect(store.goals.first?.id == created.id)
        #expect(service.lastCreate?.name == "Maison")
    }

    @Test("update replaces the goal in the cache (status change)")
    func update_replaces() async throws {
        let service = MockSavingsGoalService()
        service.stubbedGoals = [makeGoal(id: "g1", status: .active)]
        let store = SavingsGoalStore(service: service)
        await store.forceRefresh()

        _ = try await store.update(id: "g1", data: SavingsGoalUpdate(status: .completed))

        #expect(store.goals.first { $0.id == "g1" }?.status == .completed)
        #expect(service.lastUpdate?.status == .completed)
    }

    @Test("delete removes the goal from the cache")
    func delete_removes() async throws {
        let service = MockSavingsGoalService()
        service.stubbedGoals = [makeGoal(id: "g1")]
        let store = SavingsGoalStore(service: service)
        await store.forceRefresh()

        try await store.delete(id: "g1")

        #expect(store.goals.isEmpty)
        #expect(service.lastDeletedId == "g1")
    }

    @Test("forceRefresh surfaces an API error")
    func forceRefresh_surfacesError() async {
        let service = MockSavingsGoalService()
        service.error = APIError.networkError(URLError(.notConnectedToInternet))
        let store = SavingsGoalStore(service: service)

        await store.forceRefresh()

        #expect(store.error != nil)
        #expect(store.goals.isEmpty)
    }

    @Test("reset clears the cache")
    func reset_clears() async {
        let service = MockSavingsGoalService()
        service.stubbedGoals = [makeGoal(id: "g1")]
        let store = SavingsGoalStore(service: service)
        await store.forceRefresh()
        #expect(!store.goals.isEmpty)

        store.reset()

        #expect(store.goals.isEmpty)
        #expect(store.hasLoadedOnce == false)
        #expect(store.error == nil)
    }
}
