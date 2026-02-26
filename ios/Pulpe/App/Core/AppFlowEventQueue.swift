import Foundation
import OSLog

/// A serialized event queue that ensures FIFO processing of async events.
///
/// This actor prevents race conditions by ensuring only one async event
/// handler runs at a time, maintaining deterministic state transitions.
///
/// The handler runs on the MainActor to integrate with SwiftUI state.
@MainActor
final class AppFlowEventQueue {
    // MARK: - Types

    typealias EventHandler = @MainActor (AppFlowEvent) async -> Void

    // MARK: - State

    private var isProcessing = false
    private var pendingEvents: [AppFlowEvent] = []
    private let handler: EventHandler

    // MARK: - Initialization

    init(handler: @escaping EventHandler) {
        self.handler = handler
    }

    // MARK: - Public API

    /// Enqueues an event for processing.
    /// Events are processed in FIFO order, one at a time.
    func enqueue(_ event: AppFlowEvent) {
        pendingEvents.append(event)
        Logger.auth.debug("[EVENT_QUEUE] Enqueued event: \(String(describing: event)), queue size: \(self.pendingEvents.count)")

        if !isProcessing {
            Task { @MainActor in
                await self.processQueue()
            }
        }
    }

    /// Returns the number of pending events (for testing/debugging).
    var pendingCount: Int {
        pendingEvents.count
    }

    // MARK: - Private

    private func processQueue() async {
        guard !isProcessing else { return }
        isProcessing = true

        while !pendingEvents.isEmpty {
            let event = pendingEvents.removeFirst()
            Logger.auth.debug("[EVENT_QUEUE] Processing event: \(String(describing: event))")
            await handler(event)
        }

        isProcessing = false
        Logger.auth.debug("[EVENT_QUEUE] Queue empty, processing complete")
    }
}
