import SwiftUI

/// Global toast manager for displaying confirmation messages with optional undo action
@Observable @MainActor
final class ToastManager {
    /// Durée unique pour l’auto-fermeture et la fenêtre « annuler » (alignée avec le commit différé côté ViewModel).
    private static let autoDismissDuration: Duration = .seconds(3)

    enum ToastType {
        case success
        case error
        case undo

        var icon: String {
            switch self {
            case .success: "checkmark.circle.fill"
            case .error: "xmark.circle.fill"
            case .undo: "arrow.uturn.backward.circle.fill"
            }
        }

        var color: Color {
            switch self {
            case .success: .pulpePrimary
            case .error: .errorPrimary
            case .undo: .financialOverBudget
            }
        }
    }

    struct Toast: Equatable {
        let id: UUID
        let message: String
        let type: ToastType
        let undoAction: (@MainActor () async -> Void)?
        /// Appelé si le toast disparaît sans « Annuler » : timeout, bouton fermer, glisser pour fermer, ou remplacement par un nouveau toast.
        let onFinishedWithoutUndo: (@MainActor () async -> Void)?

        var hasUndo: Bool { undoAction != nil }

        init(
            message: String,
            type: ToastType,
            undoAction: (@MainActor () async -> Void)? = nil,
            onFinishedWithoutUndo: (@MainActor () async -> Void)? = nil
        ) {
            self.id = UUID()
            self.message = message
            self.type = type
            self.undoAction = undoAction
            self.onFinishedWithoutUndo = onFinishedWithoutUndo
        }

        static func == (lhs: Toast, rhs: Toast) -> Bool {
            lhs.id == rhs.id
        }
    }

    private(set) var currentToast: Toast?
    private var dismissTask: Task<Void, Never>?

    /// Show a simple toast message
    func show(_ message: String, type: ToastType = .success) {
        showToast(Toast(message: message, type: type))
    }

    /// Show a toast with an undo action; `onFinishedWithoutUndo` runs after auto-dismiss, fermeture (X), ou si un nouveau toast remplace celui-ci.
    func showWithUndo(
        _ message: String,
        undo: @escaping @MainActor () async -> Void,
        onFinishedWithoutUndo: @escaping @MainActor () async -> Void
    ) {
        showToast(
            Toast(
                message: message,
                type: .undo,
                undoAction: undo,
                onFinishedWithoutUndo: onFinishedWithoutUndo
            )
        )
    }

    private func showToast(_ toast: Toast) {
        dismissTask?.cancel()

        if let previous = currentToast, let finish = previous.onFinishedWithoutUndo {
            Task { @MainActor in
                await finish()
            }
        }

        // Replace toast without animation to avoid cross-fade between toasts
        var transaction = SwiftUI.Transaction()
        transaction.disablesAnimations = true
        withTransaction(transaction) {
            currentToast = toast
        }

        dismissTask = Task { @MainActor in
            do {
                try await Task.sleep(for: Self.autoDismissDuration)
                guard !Task.isCancelled else { return }
                dismiss()
            } catch {
                // Task was cancelled, do nothing
            }
        }
    }

    /// Execute the undo action if available, then dismiss (sans déclencher `onFinishedWithoutUndo`)
    func executeUndo() {
        dismissTask?.cancel()
        dismissTask = nil
        guard let toast = currentToast, let undoAction = toast.undoAction else { return }
        currentToast = nil
        Task { @MainActor in
            await undoAction()
        }
    }

    func dismiss() {
        dismissTask?.cancel()
        dismissTask = nil
        let finish = currentToast?.onFinishedWithoutUndo
        currentToast = nil
        if let finish {
            Task { @MainActor in
                await finish()
            }
        }
    }
}
