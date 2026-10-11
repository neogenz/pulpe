import SwiftUI

extension View {
    /// Delays revealing the sync spinner so brief in-flight states (sub-300ms
    /// optimistic→server convergence) never flash. Once `isSyncing` settles to
    /// true past `DesignTokens.Sync.indicatorRampDelayMs`, `displayed` flips on;
    /// any earlier resolution cancels the ramp and keeps it hidden.
    ///
    /// Centralises the `Task.sleep`-based ramp pattern previously inlined in
    /// `BudgetLineMixedRow`, shared by every `PointCircle`.
    func rampSyncIndicator(
        isSyncing: Bool,
        displayed: Binding<Bool>
    ) -> some View {
        task(id: isSyncing) {
            guard isSyncing else {
                displayed.wrappedValue = false
                return
            }
            try? await Task.sleep(for: .milliseconds(DesignTokens.Sync.indicatorRampDelayMs))
            guard !Task.isCancelled else { return }
            displayed.wrappedValue = true
        }
    }
}
