import SwiftUI

/// The item a postpone confirmation (PUL-22, CA10) is pending for. Carries the
/// entity so the confirm handler can dispatch the right coordinator action, and
/// its display name for the dialog title.
enum PostponeTarget: Identifiable {
    case budgetLine(BudgetLine)
    case transaction(Transaction)

    var id: String {
        switch self {
        case .budgetLine(let line): "line-\(line.id)"
        case .transaction(let tx): "tx-\(tx.id)"
        }
    }

    var name: String {
        switch self {
        case .budgetLine(let line): line.name
        case .transaction(let tx): tx.name
        }
    }
}

extension View {
    /// Quick confirmation before reporting an item to next month (PUL-22, CA10).
    /// Driven by an optional `PostponeTarget` binding the caller sets from the
    /// row context-menu; `onConfirm` fires the coordinator dispatch.
    func postponeConfirmation(
        target: Binding<PostponeTarget?>,
        nextMonthLabel: String?,
        onConfirm: @escaping (PostponeTarget) -> Void
    ) -> some View {
        modifier(
            PostponeConfirmationModifier(
                target: target,
                nextMonthLabel: nextMonthLabel,
                onConfirm: onConfirm
            )
        )
    }
}

private struct PostponeConfirmationModifier: ViewModifier {
    @Binding var target: PostponeTarget?
    let nextMonthLabel: String?
    let onConfirm: (PostponeTarget) -> Void

    func body(content: Content) -> some View {
        content.confirmationDialog(
            confirmationTitle,
            isPresented: isPresentedBinding,
            titleVisibility: .visible,
            presenting: target
        ) { item in
            Button("Reporter") { onConfirm(item) }
            Button("Annuler", role: .cancel) {}
        }
    }

    private var confirmationTitle: String {
        guard let target else { return "" }
        if let nextMonthLabel {
            return "Reporter \(target.name) en \(nextMonthLabel) ?"
        }
        return "Reporter \(target.name) au mois suivant ?"
    }

    /// Bridges the `PostponeTarget?` state to the `Bool` binding the dialog
    /// needs: present while a target is set, clear the target on dismissal.
    private var isPresentedBinding: Binding<Bool> {
        Binding(
            get: { target != nil },
            set: { if !$0 { target = nil } }
        )
    }
}
