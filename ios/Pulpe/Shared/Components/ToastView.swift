import SwiftUI

/// Toast notification view with slide-in animation and optional undo button
struct ToastView: View {
    let toast: ToastManager.Toast
    let onDismiss: () -> Void
    let onUndo: (() -> Void)?

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var offset: CGFloat = -100
    @State private var opacity: Double = 0
    @State private var animationTask: Task<Void, Never>?

    init(toast: ToastManager.Toast, onDismiss: @escaping () -> Void, onUndo: (() -> Void)? = nil) {
        self.toast = toast
        self.onDismiss = onDismiss
        self.onUndo = onUndo
    }

    var body: some View {
        HStack(spacing: DesignTokens.Spacing.md) {
            Image(systemName: toast.type.icon)
                .font(PulpeTypography.buttonPrimary)
                .foregroundStyle(toast.type.color)

            Text(toast.message)
                .font(PulpeTypography.buttonSecondary)
                .foregroundStyle(.primary)

            Spacer(minLength: 0)

            if toast.hasUndo, let onUndo {
                Button {
                    onUndo()
                } label: {
                    Text("Annuler")
                        .font(PulpeTypography.buttonSecondary)
                        .fontWeight(.semibold)
                        .foregroundStyle(Color.pulpePrimary)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Annuler l'action")
            }

            Button {
                dismissWithAnimation()
            } label: {
                Image(systemName: "xmark")
                    .font(PulpeTypography.inputHelper)
                    .foregroundStyle(.secondary)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Fermer")
        }
        .padding(.horizontal, DesignTokens.Spacing.lg)
        .padding(.vertical, 14)
        .pulpeFloatingGlass(cornerRadius: DesignTokens.CornerRadius.md)
        .shadow(DesignTokens.Shadow.toast)
        .padding(.horizontal, DesignTokens.Spacing.lg)
        .offset(y: offset)
        .opacity(opacity)
        .gesture(
            DragGesture()
                .onEnded { value in
                    if value.translation.height < -20 {
                        dismissWithAnimation()
                    }
                }
        )
        .onAppear {
            if reduceMotion {
                offset = 0
                opacity = 1
            } else {
                withAnimation(DesignTokens.Animation.toastEntrance) {
                    offset = 0
                    opacity = 1
                }
            }
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel(toast.message)
        .accessibilityAddTraits(.isStaticText)
        .ifLet(toast.hasUndo ? "Annuler disponible" : nil) { view, hint in
            view.accessibilityHint(hint)
        }
    }

    private func dismissWithAnimation() {
        // Cancel any pending dismiss
        animationTask?.cancel()

        if reduceMotion {
            offset = -100
            opacity = 0
            onDismiss()
        } else {
            withAnimation(DesignTokens.Animation.toastDismiss) {
                offset = -100
                opacity = 0
            }

            animationTask = Task { @MainActor in
                do {
                    try await Task.sleep(for: .milliseconds(200))
                    onDismiss()
                } catch {
                    // Task was cancelled, do nothing
                }
            }
        }
    }
}

#Preview {
    VStack {
        Spacer()
        ToastView(
            toast: ToastManager.Toast(message: "Transaction ajoutée", type: .success, undoAction: nil),
            onDismiss: {}
        )
        Spacer()
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity)
    .background(Color(.systemGroupedBackground))
}
