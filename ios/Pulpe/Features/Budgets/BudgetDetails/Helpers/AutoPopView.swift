import SwiftUI

/// Drop-in placeholder rendered when a pushed page detects its target
/// model has disappeared from the source state. Sleeps for a grace window
/// (so a transient lookup miss during a reload race doesn't pop a
/// freshly-pushed page), then re-checks `isStillEmpty` and dismisses if
/// still empty.
///
/// Centralises the `Task.sleep`-based autopop pattern previously duplicated
/// across `BudgetLineDetailPage`, `AddAllocatedTransactionPage`, and
/// `EditTransactionPage`. The grace window comes from
/// `DesignTokens.Animation.autoPopGraceMs` so the timing is configurable
/// from one place.
struct AutoPopView: View {
    let isStillEmpty: () -> Bool

    @Environment(\.dismiss) private var dismiss

    var body: some View {
        Color.clear.task {
            try? await Task.sleep(for: .milliseconds(DesignTokens.Animation.autoPopGraceMs))
            guard !Task.isCancelled, isStillEmpty() else { return }
            dismiss()
        }
    }
}
