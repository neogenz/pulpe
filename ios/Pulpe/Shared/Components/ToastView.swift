import SwiftUI

/// Toast notification view with slide-in animation
struct ToastView: View {
    let toast: ToastManager.Toast
    let onDismiss: () -> Void

    @State private var offset: CGFloat = -100
    @State private var opacity: Double = 0
    @State private var animationTask: Task<Void, Never>?

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: toast.type.icon)
                .font(.system(size: 18, weight: .semibold))
                .foregroundStyle(toast.type.color)

            Text(toast.message)
                .font(.system(.subheadline, design: .rounded, weight: .medium))
                .foregroundStyle(.primary)

            Spacer(minLength: 0)

            Button {
                dismissWithAnimation()
            } label: {
                Image(systemName: "xmark")
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(.secondary)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Fermer")
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 14)
        .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 12))
        .shadow(color: .black.opacity(0.1), radius: 8, y: 4)
        .padding(.horizontal, 16)
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
            withAnimation(.spring(duration: 0.4, bounce: 0.3)) {
                offset = 0
                opacity = 1
            }
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel(toast.message)
        .accessibilityAddTraits(.isStaticText)
    }

    private func dismissWithAnimation() {
        // Cancel any pending dismiss
        animationTask?.cancel()

        withAnimation(.easeOut(duration: 0.2)) {
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
    .background(Color(.systemGroupedBackground))
}
