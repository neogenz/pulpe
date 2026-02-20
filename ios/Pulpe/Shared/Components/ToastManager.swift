import SwiftUI

/// Global toast manager for displaying confirmation messages with optional undo action
@Observable @MainActor
final class ToastManager {
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
        let id = UUID()
        let message: String
        let type: ToastType
        let undoAction: (@MainActor () async -> Void)?

        var hasUndo: Bool { undoAction != nil }

        static func == (lhs: Toast, rhs: Toast) -> Bool {
            lhs.id == rhs.id
        }
    }

    private(set) var currentToast: Toast?
    private var dismissTask: Task<Void, Never>?

    /// Show a simple toast message
    func show(_ message: String, type: ToastType = .success) {
        showToast(Toast(message: message, type: type, undoAction: nil))
    }

    /// Show a toast with an undo action (3-second window)
    func showWithUndo(_ message: String, undo: @escaping @MainActor () async -> Void) {
        showToast(Toast(message: message, type: .undo, undoAction: undo))
    }

    private func showToast(_ toast: Toast) {
        // Cancel any pending dismiss
        dismissTask?.cancel()

        // Show new toast
        currentToast = toast

        // Auto-dismiss after 3 seconds
        dismissTask = Task {
            do {
                try await Task.sleep(for: .seconds(3))
                dismiss()
            } catch {
                // Task was cancelled, do nothing
            }
        }
    }

    /// Execute the undo action if available, then dismiss
    func executeUndo() {
        guard let toast = currentToast, let undoAction = toast.undoAction else { return }
        dismissTask?.cancel()
        currentToast = nil

        Task {
            await undoAction()
        }
    }

    func dismiss() {
        dismissTask?.cancel()
        currentToast = nil
    }
}
