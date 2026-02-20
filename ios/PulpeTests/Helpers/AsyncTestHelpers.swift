import Foundation
import Testing

/// Polls a condition with 10ms intervals until it returns `true` or the timeout elapses.
/// Fails the test with the given comment if the condition is not met within the timeout.
func waitForCondition(
    timeout: Duration = .milliseconds(1000),
    _ comment: Comment? = nil,
    _ condition: @escaping () -> Bool
) async {
    let interval: Duration = .milliseconds(10)
    let maxIterations = Int(timeout.components.seconds * 100 + timeout.components.attoseconds / 10_000_000_000_000_000)

    for _ in 0..<maxIterations {
        if condition() { return }
        try? await Task.sleep(for: interval)
    }

    #expect(condition(), comment)
}
