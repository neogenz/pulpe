import SwiftUI

/// Global toast manager for displaying confirmation messages
@Observable
final class ToastManager {
    enum ToastType {
        case success
        case error

        var icon: String {
            switch self {
            case .success: "checkmark.circle.fill"
            case .error: "xmark.circle.fill"
            }
        }

        var color: Color {
            switch self {
            case .success: .pulpePrimary
            case .error: .red
            }
        }
    }

    struct Toast: Equatable {
        let id = UUID()
        let message: String
        let type: ToastType

        static func == (lhs: Toast, rhs: Toast) -> Bool {
            lhs.id == rhs.id
        }
    }

    private(set) var currentToast: Toast?
    private var dismissTask: Task<Void, Never>?

    @MainActor
    func show(_ message: String, type: ToastType = .success) {
        // Cancel any pending dismiss
        dismissTask?.cancel()

        // Show new toast
        currentToast = Toast(message: message, type: type)

        // Auto-dismiss after 3 seconds
        dismissTask = Task { @MainActor in
            do {
                try await Task.sleep(for: .seconds(3))
                dismiss()
            } catch {
                // Task was cancelled, do nothing
            }
        }
    }

    @MainActor
    func dismiss() {
        dismissTask?.cancel()
        currentToast = nil
    }
}
