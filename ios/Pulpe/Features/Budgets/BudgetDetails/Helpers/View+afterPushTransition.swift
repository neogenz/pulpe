import SwiftUI

extension View {
    /// Runs `action` once after the push transition completes — gives the
    /// keyboard time to rise after the form view appears, matching the
    /// behavior of `SheetFormContainer`. Equivalent to a `.task` that sleeps
    /// for `DesignTokens.Animation.pushAutofocusDelayMs` before running.
    ///
    /// Centralises the `Task.sleep` autofocus pattern previously inlined in
    /// `AddAllocatedTransactionPage` and `EditTransactionPage`. The delay
    /// comes from a single design token so timing is configurable from one
    /// place.
    func afterPushTransition(_ action: @escaping @MainActor () -> Void) -> some View {
        task {
            try? await Task.sleep(for: .milliseconds(DesignTokens.Animation.pushAutofocusDelayMs))
            guard !Task.isCancelled else { return }
            action()
        }
    }
}
