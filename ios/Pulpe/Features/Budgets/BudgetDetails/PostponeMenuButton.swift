import SwiftUI

/// "Reporter au mois suivant" menu entry (PUL-22), shared by the budget-line
/// detail page (`BudgetLineDetailPage`) and the transaction edit page
/// (`EditTransactionPage`) header menus so the eligibility / disabled-state
/// copy lives in one place.
///
/// Renders nothing when the item is ineligible (checked, recurring, or with
/// allocated transactions — CA1/CA6/CA7). When eligible but the next calendar
/// month's budget doesn't exist yet (CA5), it shows a disabled button with an
/// explanatory message instead of silently hiding the action.
struct PostponeMenuButton: View {
    let isEligible: Bool
    /// Whether the next calendar month's budget exists (CA5).
    let canPostpone: Bool
    /// Localized next-month name (e.g. "juillet"). `nil` only before the budget
    /// loads, which never coincides with an interactive row.
    let nextMonthLabel: String?
    let onPostpone: () -> Void

    var body: some View {
        if isEligible {
            if canPostpone {
                Button {
                    onPostpone()
                } label: {
                    Label("Reporter au mois suivant", systemImage: "arrow.uturn.forward")
                }
            } else {
                Button {} label: {
                    Label(disabledMessage, systemImage: "calendar.badge.exclamationmark")
                }
                .disabled(true)
            }
        }
    }

    private var disabledMessage: String {
        if let nextMonthLabel {
            return "Crée d'abord le budget de \(nextMonthLabel)"
        }
        return "Crée d'abord le budget du mois suivant"
    }
}
