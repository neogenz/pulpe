import Foundation
@testable import Pulpe
import Testing

/// The free rows kept on the device between two comparisons: names and sides, never an amount.
struct ReconcileFreeAccountsStoreTests {
    private let defaults: UserDefaults
    private let suite = "ReconcileFreeAccountsStoreTests-\(UUID().uuidString)"

    init() throws {
        defaults = try #require(UserDefaults(suiteName: suite))
    }

    @Test func namesAndSidesComeBack() {
        let store = ReconcileFreeAccountsStore(defaults: defaults)
        #expect(store.entries.isEmpty)

        store.save([.init(name: "Revolut", isOwed: false), .init(name: "Klarna", isOwed: true)])

        #expect(store.entries == [.init(name: "Revolut", isOwed: false), .init(name: "Klarna", isOwed: true)])
    }

    @Test @MainActor func comparing_keepsNamesOnly_andClearingForgetsThem() {
        let store = ReconcileFreeAccountsStore(defaults: defaults)
        let flow = ReconcileAccountsFlow(
            budgetId: "b", adjustmentLabel: "Écart",
            createTransaction: { _ in throw CancellationError() },
            onAdjustmentCreated: { _ in }, onCompleted: { _ in }
        )
        flow.accounts[0].label = " Revolut "
        flow.accounts[0].amountText = "1000"
        flow.addFreeAccount(isOwed: true)

        store.save(flow.freeAccountEntries)

        // The blank row is not kept, and the amount never reaches the device.
        #expect(store.entries == [.init(name: "Revolut", isOwed: false)])
        let stored = defaults.data(forKey: "reconcileFreeAccounts").flatMap { String(data: $0, encoding: .utf8) }
        #expect(stored?.contains("1000") == false)

        store.clear()
        #expect(store.entries.isEmpty)
    }
}
