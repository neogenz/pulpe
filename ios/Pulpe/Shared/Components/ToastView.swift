import SwiftUI

/// Toast notification view with slide-in animation and optional undo button
struct ToastView: View {
    let toast: ToastManager.Toast
    let onDismiss: () -> Void
    let onUndo: (() -> Void)?

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var offset: CGFloat = DesignTokens.Control.toastTravel
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
    private static let comfortableTapMin = DesignTokens.TapTarget.minimum

    var body: some View {
        HStack(alignment: .center, spacing: DesignTokens.Spacing.md) {
            Image(systemName: toast.type.icon)
                .font(PulpeTypography.buttonPrimary)
                .foregroundStyle(toast.type.color)
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
            HStack(spacing: DesignTokens.Spacing.xs) {
                if toast.hasUndo, let onUndo {
                    Button {
                        onUndo()
                    } label: {
                        Text("Annuler")
                            .font(PulpeTypography.chipLabel)
                            .fontWeight(.bold)
                            .foregroundStyle(Color.pulpePrimary)
                            .frame(minHeight: Self.comfortableTapMin)
                            .padding(.horizontal, DesignTokens.Spacing.md)
                    }
                    .buttonStyle(PlainPressedButtonStyle())
                    .accessibilityLabel(toast.undoAccessibilityLabel)
                }

                // V2: an undo toast carries one action; it still leaves on a swipe down, on its
                // timer, or through the VoiceOver « Fermer » action below.
                if !toast.hasUndo || onUndo == nil {
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
            }
            .fixedSize(horizontal: true, vertical: false)
        }
        .accessibilityAction(named: Text("Fermer")) { dismissWithAnimation() }
        .padding(.horizontal, DesignTokens.Spacing.lg)
        .padding(.vertical, DesignTokens.Spacing.lg)
        .background(Color.surface, in: .rect(cornerRadius: DesignTokens.CornerRadius.toast))
        .overlay {
            RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.toast)
                .strokeBorder(Color.outlineVariant, lineWidth: DesignTokens.BorderWidth.hairline)
        }
        .shadow(DesignTokens.Shadow.toast)
        .padding(.horizontal, DesignTokens.Spacing.lg)
        .offset(y: offset)
        .opacity(opacity)
        .gesture(
            DragGesture()
                .onEnded { value in
                    if value.translation.height > DesignTokens.Control.toastSwipeDismiss {
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
            offset = DesignTokens.Control.toastTravel
            opacity = 0
            onDismiss()
        } else {
            withAnimation(DesignTokens.Animation.toastDismiss) {
                offset = DesignTokens.Control.toastTravel
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
            toast: ToastManager.Toast(message: "Enregistré", type: .success),
            onDismiss: {}
        )
        Spacer()
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity)
    .background(Color.surface)
}
