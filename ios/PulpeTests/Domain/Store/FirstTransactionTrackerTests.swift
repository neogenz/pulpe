import Foundation
@testable import Pulpe
import Testing

@MainActor
struct FirstTransactionTrackerTests {
    private struct Captured: Equatable {
        let kind: TransactionKind
        let source: FirstTransactionTracker.Source
    }

    private final class CaptureLog {
        var entries: [Captured] = []
    }

    private func makeDefaults() throws -> UserDefaults {
        let suiteName = "FirstTransactionTrackerTests-\(UUID().uuidString)"
        let defaults = try #require(UserDefaults(suiteName: suiteName))
        defaults.removePersistentDomain(forName: suiteName)
        return defaults
    }

    private func makeTracker(
        defaults: UserDefaults,
        log: CaptureLog = CaptureLog(),
        answer: @escaping @Sendable () async throws -> Bool = { false }
    ) -> FirstTransactionTracker {
        FirstTransactionTracker(
            defaults: defaults,
            fetchHasTransaction: answer,
            captureFirstTransaction: { kind, source in
                log.entries.append(Captured(kind: kind, source: source))
            }
        )
    }

    @Test func loadIfNeeded_serverHoldsNothing_awaitsFirstTransaction() async throws {
        let tracker = makeTracker(defaults: try makeDefaults())
        #expect(tracker.isAwaitingFirstTransaction == false)

        await tracker.loadIfNeeded()

        #expect(tracker.isAwaitingFirstTransaction)
    }

    @Test func loadIfNeeded_serverHoldsAnEntry_doesNotAwait() async throws {
        let tracker = makeTracker(defaults: try makeDefaults(), answer: { true })

        await tracker.loadIfNeeded()

        #expect(tracker.isAwaitingFirstTransaction == false)
    }

    @Test func loadIfNeeded_serverFails_staysUnknownAndHidden() async throws {
        let tracker = makeTracker(defaults: try makeDefaults(), answer: { throw URLError(.notConnectedToInternet) })

        await tracker.loadIfNeeded()

        #expect(tracker.hasTransaction == nil)
        #expect(tracker.isAwaitingFirstTransaction == false)
    }

    @Test func recordCreated_fromAnySurface_marksOnlyTheFirstEntry() async throws {
        let log = CaptureLog()
        let tracker = makeTracker(defaults: try makeDefaults(), log: log)
        await tracker.loadIfNeeded()

        tracker.recordCreated(kind: .expense, source: .budgetDetails)
        tracker.recordCreated(kind: .income, source: .widget)

        #expect(log.entries == [Captured(kind: .expense, source: .budgetDetails)])
        #expect(tracker.isAwaitingFirstTransaction == false)
    }

    @Test func recordCreated_whileUnknown_marksNothing() throws {
        let log = CaptureLog()
        let tracker = makeTracker(defaults: try makeDefaults(), log: log)

        tracker.recordCreated(kind: .expense, source: .addButton)

        #expect(log.entries.isEmpty)
    }

    /// An entry undone right away empties the account again on the server.
    @Test func loadIfNeeded_afterRecordingOnThisDevice_doesNotAskAgain() async throws {
        let defaults = try makeDefaults()
        makeTracker(defaults: defaults).recordCreated(kind: .expense, source: .activationPrompt)

        let tracker = makeTracker(defaults: defaults, answer: { false })
        await tracker.loadIfNeeded()

        #expect(tracker.isAwaitingFirstTransaction == false)
    }

    @Test func reset_atIdentityBoundary_asksTheServerAgain() async throws {
        let defaults = try makeDefaults()
        let tracker = makeTracker(defaults: defaults)
        await tracker.loadIfNeeded()
        tracker.recordCreated(kind: .expense, source: .addButton)

        tracker.reset()
        await tracker.loadIfNeeded()

        #expect(tracker.isAwaitingFirstTransaction)
    }

    @Test func source_rawValues_matchWebContract() {
        let rawValues: [FirstTransactionTracker.Source: String] = [
            .activationPrompt: "activation_prompt",
            .addButton: "add_button",
            .budgetDetails: "budget_details",
            .reconciliation: "reconciliation",
            .widget: "widget"
        ]
        for (source, rawValue) in rawValues {
            #expect(source.rawValue == rawValue)
        }
    }
}
