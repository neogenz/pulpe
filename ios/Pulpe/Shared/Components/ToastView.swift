import SwiftUI

/// Toast notification view with slide-in animation and optional undo button
struct ToastView: View {
    let toast: ToastManager.Toast
    let onDismiss: () -> Void
    let onUndo: (() -> Void)?

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var offset: CGFloat = -100
    @State private var opacity: Double = 0

    init(toast: ToastManager.Toast, onDismiss: @escaping () -> Void, onUndo: (() -> Void)? = nil) {
        self.toast = toast
        self.onDismiss = onDismiss
        self.onUndo = onUndo
    }

    private var accessibilitySummary: String {
        if let detail = toast.detail, !detail.isEmpty {
            "\(toast.message). \(detail)"
        } else {
            toast.message
        }
    }

    /// Cible minimale confortable (Practical UI / WCAG :48×48 ; Apple HIG : 44).
    private static let comfortableTapMin: CGFloat = 48

    var body: some View {
        HStack(alignment: .center, spacing: DesignTokens.Spacing.md) {
            Image(systemName: toast.type.icon)
                .font(PulpeTypography.buttonPrimary)
                .foregroundStyle(toast.type.color)
                .frame(width: Self.comfortableTapMin, height: Self.comfortableTapMin)
                .accessibilityHidden(true)

            VStack(alignment: .leading, spacing: DesignTokens.Spacing.xs) {
                Text(toast.message)
                    .font(PulpeTypography.buttonSecondary)
                    .foregroundStyle(.primary)
                    .multilineTextAlignment(.leading)
                if let detail = toast.detail, !detail.isEmpty {
                    Text(detail)
                        .font(PulpeTypography.caption)
                        .foregroundStyle(Color.onSurfaceVariant)
                        .multilineTextAlignment(.leading)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            // 16pt entre actions (Practical UI) ; « Annuler » = poids secondaire (lisible sur verre, pas seulement la couleur).
            HStack(spacing: DesignTokens.Spacing.lg) {
                if toast.hasUndo, let onUndo {
                    Button {
                        onUndo()
                    } label: {
                        Text("Annuler")
                            .font(PulpeTypography.buttonSecondary)
                            .fontWeight(.semibold)
                            .foregroundStyle(toast.type.color)
                            .frame(minHeight: Self.comfortableTapMin)
                            .padding(.horizontal, DesignTokens.Spacing.lg)
                            .background(
                                Capsule()
                                    .fill(toast.type.color.opacity(0.1))
                            )
                            .overlay(
                                Capsule()
                                    .strokeBorder(toast.type.color.opacity(0.42), lineWidth: 1)
                            )
                    }
                    .buttonStyle(PlainPressedButtonStyle())
                    .accessibilityLabel("Annuler la suppression")
                }

                Button {
                    dismissWithAnimation()
                } label: {
                    Image(systemName: "xmark")
                        .font(PulpeTypography.inputHelper)
                        .foregroundStyle(Color.textSecondary)
                }
                .iconButtonStyle()
                .accessibilityLabel("Fermer")
            }
            .fixedSize(horizontal: true, vertical: false)
        }
        .padding(.horizontal, DesignTokens.Spacing.lg)
        .padding(.vertical, DesignTokens.Spacing.lg)
        .pulpeFloatingGlass(cornerRadius: DesignTokens.CornerRadius.md)
        .shadow(color: Color.black.opacity(0.12), radius: 10, x: 0, y: 4)
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
        .accessibilityLabel(accessibilitySummary)
        .accessibilityAddTraits(.isStaticText)
        .ifLet(toast.hasUndo ? "Annuler disponible" : nil) { view, hint in
            view.accessibilityHint(hint)
        }
    }

    private func dismissWithAnimation() {
        if reduceMotion {
            offset = -100
            opacity = 0
            onDismiss()
        } else {
            withAnimation(DesignTokens.Animation.toastDismiss) {
                offset = -100
                opacity = 0
            } completion: {
                onDismiss()
            }
        }
    }
}

#Preview {
    VStack {
        Spacer()
        ToastView(
            toast: ToastManager.Toast(message: "Transaction ajoutée", type: .success),
            onDismiss: {}
        )
        Spacer()
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity)
    .background(Color.surface)
}
