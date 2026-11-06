import SwiftUI

/// The control that points a ledger row: always the same 28pt circle (V2 `check`).
///
/// Unpointed: a plain 2pt ring in `pointRing`. Pointed: a `pulpePrimary` disc with a white
/// check. Never tinted by nature, never dashed. 44×44 hit area around the 28pt circle;
/// the parent owns the state. Uses `Button` so the tap is visible to VoiceOver
/// independently of the row's own target.
struct PointCircle: View {
    let isPointed: Bool
    let isSyncing: Bool
    var onPrepareToggle: () -> Bool = { true }
    var onCompletionStateChange: (Bool) -> Void = { _ in }
    let onToggle: () -> Void

    @State private var isCompleting = false
    @State private var successFeedbackTrigger = 0
    @State private var selectionFeedbackTrigger = 0
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    private var displayedIsPointed: Bool { isPointed || isCompleting }

    private var fillAnimation: Animation {
        .easeOut(duration: reduceMotion ? DesignTokens.Animation.microFadeIn : DesignTokens.Animation.normal)
    }

    private var checkAnimation: Animation {
        reduceMotion
            ? fillAnimation
            : .spring(response: DesignTokens.Animation.quickSnap, dampingFraction: 0.9)
                .delay(DesignTokens.Animation.microFadeOut)
    }

    private var completionAnimation: Animation {
        .easeOut(
            duration: reduceMotion
                ? DesignTokens.Animation.microFadeIn
                : DesignTokens.Checkbox.completionHold
        )
    }

    var body: some View {
        Button(action: handleToggle) {
            ZStack {
                Circle()
                    .strokeBorder(Color.pointRing, lineWidth: DesignTokens.Checkbox.ringWidth)
                    .frame(width: DesignTokens.Checkbox.size, height: DesignTokens.Checkbox.size)
                    .scaleEffect(displayedIsPointed && !reduceMotion ? DesignTokens.Animation.settleScale : 1)
                    .opacity(displayedIsPointed ? 0 : 1)
                    .animation(fillAnimation, value: displayedIsPointed)

                Circle()
                    .fill(Color.pulpePrimary)
                    .frame(width: DesignTokens.Checkbox.size, height: DesignTokens.Checkbox.size)
                    .scaleEffect(
                        reduceMotion || displayedIsPointed ? 1 : DesignTokens.Checkbox.fillStartScale
                    )
                    .opacity(displayedIsPointed ? 1 : 0)
                    .animation(fillAnimation, value: displayedIsPointed)

                Image(systemName: "checkmark")
                    .font(.system(size: DesignTokens.Checkbox.glyphSize, weight: .heavy))
                    .foregroundStyle(Color.textOnPrimary)
                    .scaleEffect(
                        reduceMotion || displayedIsPointed ? 1 : DesignTokens.Animation.settleScale
                    )
                    .opacity(displayedIsPointed ? 1 : 0)
                    .animation(checkAnimation, value: displayedIsPointed)
            }
            .frame(
                width: DesignTokens.TapTarget.minimum,
                height: DesignTokens.TapTarget.minimum
            )
            .contentShape(Circle())
        }
        .buttonStyle(PointCirclePressStyle(reduceMotion: reduceMotion))
        .disabled(isCompleting || isSyncing)
        .sensoryFeedback(.success, trigger: successFeedbackTrigger)
        .sensoryFeedback(.selection, trigger: selectionFeedbackTrigger)
        .onChange(of: isPointed) {
            if isPointed { finishCompletion() }
        }
        // A parent that points only once the server confirms (an announced withdrawal)
        // may end its sync unpointed: release the completion, or the disc stays filled.
        .onChange(of: isSyncing) {
            if !isSyncing, !isPointed { finishCompletion() }
        }
        .accessibilityLabel(displayedIsPointed ? "Pointé" : "À pointer")
        .accessibilityAddTraits(displayedIsPointed ? [.isButton, .isSelected] : .isButton)
    }

    private func handleToggle() {
        guard !isCompleting else { return }
        guard onPrepareToggle() else { return }
        guard !isPointed else {
            selectionFeedbackTrigger += 1
            onToggle()
            return
        }

        successFeedbackTrigger += 1
        withAnimation(completionAnimation) {
            isCompleting = true
            onCompletionStateChange(true)
        } completion: {
            onToggle()
        }
    }

    private func finishCompletion() {
        guard isCompleting else { return }
        isCompleting = false
        onCompletionStateChange(false)
    }
}

@MainActor
final class PointCompletionGate {
    var isPending = false
}

/// A flick under the finger: the disc dips while pressed and springs back, faster out than
/// in. Nothing moves under Reduce Motion.
private struct PointCirclePressStyle: ButtonStyle {
    let reduceMotion: Bool

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed && !reduceMotion ? DesignTokens.Checkbox.pressedScale : 1)
            .animation(
                reduceMotion ? nil : .spring(response: 0.2, dampingFraction: 0.8),
                value: configuration.isPressed
            )
    }
}

#Preview {
    HStack(spacing: DesignTokens.Spacing.lg) {
        PointCircle(isPointed: false, isSyncing: false) {}
        PointCircle(isPointed: true, isSyncing: false) {}
    }
    .padding()
    .background(Color.surface)
}
