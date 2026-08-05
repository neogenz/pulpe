import SwiftUI

/// "Supprimer" menu entry, shared by the budget-line detail page
/// (`BudgetLineDetailPage`) and the transaction edit page
/// (`EditTransactionPage`) header menus.
///
/// `role: .destructive` reds the title only — the SF Symbol follows the ambient
/// tint, which the enclosing menu's `pulpeMenuContent()` sets to the label
/// colour. The explicit tint below overrides it so the icon matches the red
/// title rather than sitting black beside it.
struct DeleteMenuButton: View {
    let onDelete: () -> Void

    var body: some View {
        Button("Supprimer", systemImage: "trash", role: .destructive) {
            onDelete()
        }
        .tint(Color.destructivePrimary)
    }
}
