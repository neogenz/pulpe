import Foundation
@testable import Pulpe
import Testing

struct PostOnboardingFlagsStoreTests {
    private func makeStore() throws -> PostOnboardingFlagsStore {
        let suiteName = "PostOnboardingFlagsStoreTests-\(UUID().uuidString)"
        let defaults = try #require(UserDefaults(suiteName: suiteName))
        defaults.removePersistentDomain(forName: suiteName)
        return PostOnboardingFlagsStore(defaults: defaults)
    }

    @Test func firstTransaction_whenRecorded_staysRecorded() throws {
        let store = try makeStore()
        #expect(store.hasRecordedFirstTransaction == false)

        store.setHasRecordedFirstTransaction()

        #expect(store.hasRecordedFirstTransaction)
    }

    @Test func reset_atIdentityBoundary_clearsBothFlags() throws {
        let store = try makeStore()
        store.setHasSeenPostOnboardingHandoff()
        store.setHasRecordedFirstTransaction()

        store.reset()

        #expect(store.hasSeenPostOnboardingHandoff == false)
        #expect(store.hasRecordedFirstTransaction == false)
    }
}
