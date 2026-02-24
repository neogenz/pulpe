import Foundation
import Testing

/// Polling helper that checks a condition at regular intervals until it becomes `true`
/// or the timeout elapses, then fails the test with the provided comment.
///
/// - Parameters:
///   - timeout: Maximum wait duration. Defaults to 2 seconds to accommodate slow CI environments.
///   - pollingInterval: Time between each condition check. Defaults to 10ms.
///   - comment: Failure message when the condition is not met.
///   - condition: Closure evaluated on each polling iteration.
///
/// - Note: This is a polling-based helper, not an event-driven one. The actual resolution
///   time depends on the polling interval. Keep `timeout` generous for CI runners where
///   CPU contention can cause scheduling delays.
func waitForCondition(
    timeout: Duration = .seconds(2),
    pollingInterval: Duration = .milliseconds(10),
    _ comment: Comment? = nil,
    _ condition: @escaping () -> Bool
) async {
    let timeoutAtto = timeout.components.seconds * 1_000_000_000_000_000_000
        + timeout.components.attoseconds
    let intervalAtto = pollingInterval.components.seconds * 1_000_000_000_000_000_000
        + pollingInterval.components.attoseconds
    let maxIterations = Int(timeoutAtto / intervalAtto)

    for _ in 0..<maxIterations {
        if condition() { return }
        try? await Task.sleep(for: pollingInterval)
    }

    #expect(condition(), comment)
}
