import SwiftUI

/// The nature disc that opens a ledger row, and the control that points it.
///
/// Unpointed: the kind's glyph on a wash of its tint (`RowIcon`) inside a ring of the tint,
/// which is what says "to tick" before the first tap. Pointed: a full disc in the tint with
/// a checkmark. 44×44 hit area around a 36pt disc; the parent owns the state.
/// Uses `Button` so the tap is visible to VoiceOver independently of the row's own target.
struct PointCircle: View {
    let kind: TransactionKind
    let isPointed: Bool
    let color: Color
    let isSyncing: Bool
    var onPrepareToggle: () -> Bool = { true }
    let onToggle: () -> Void

    /// Debounced sync state — only flips true if the toggle takes >300 ms,
    /// so fast optimistic updates don't trigger a green-dot flash.
    @State private var displayedSyncing = false
    @State private var isCompleting = false
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

    var body: some View {
        Button(action: handleToggle) {
            ZStack {
                RowIcon(systemName: kind.icon, tint: color)
                    .overlay {
                        Circle().strokeBorder(color, lineWidth: DesignTokens.Checkbox.ringWidth)
                    }
                    .scaleEffect(displayedIsPointed && !reduceMotion ? DesignTokens.Animation.settleScale : 1)
                    .opacity(displayedIsPointed ? 0 : 1)
                    .animation(fillAnimation, value: displayedIsPointed)

                Circle()
                    .fill(color)
                    .frame(width: DesignTokens.IconSize.badge, height: DesignTokens.IconSize.badge)
                    .scaleEffect(
                        reduceMotion || displayedIsPointed ? 1 : DesignTokens.Checkbox.fillStartScale
                    )
                    .opacity(displayedIsPointed ? 1 : 0)
                    .animation(fillAnimation, value: displayedIsPointed)

                Image(systemName: "checkmark")
                    .font(PulpeTypography.metricLabelBold)
                    .foregroundStyle(Color.textOnPrimary)
                    .scaleEffect(
                        reduceMotion || displayedIsPointed ? 1 : DesignTokens.Animation.settleScale
                    )
                    .opacity(displayedIsPointed ? 1 : 0)
                    .animation(checkAnimation, value: displayedIsPointed)

                if displayedSyncing {
                    SyncIndicator(isSyncing: true)
                        .offset(
                            x: DesignTokens.IconSize.badge / 2 - DesignTokens.Checkbox.syncBadgeInset,
                            y: -DesignTokens.IconSize.badge / 2 + DesignTokens.Checkbox.syncBadgeInset
                        )
                }
            }
            .frame(
                width: DesignTokens.TapTarget.minimum,
                height: DesignTokens.TapTarget.minimum
            )
            .contentShape(Circle())
        }
        .buttonStyle(PointCirclePressStyle(reduceMotion: reduceMotion))
        .disabled(isCompleting || isSyncing)
        .sensoryFeedback(.success, trigger: displayedIsPointed) { old, new in
            !old && new
        }
        .sensoryFeedback(.selection, trigger: isPointed) { old, new in
            old && !new
        }
        .rampSyncIndicator(isSyncing: isSyncing, displayed: $displayedSyncing)
        .onChange(of: isPointed) {
            if isPointed { isCompleting = false }
        }
        .accessibilityLabel(displayedIsPointed ? "Pointé" : "À pointer")
        .accessibilityAddTraits(displayedIsPointed ? [.isButton, .isSelected] : .isButton)
    }

    private func handleToggle() {
        guard !isCompleting else { return }
        guard onPrepareToggle() else { return }
        guard !isPointed else {
            onToggle()
            return
        }

        isCompleting = true
        Task { @MainActor in
            await delayedAction(DesignTokens.Checkbox.completionHold) {
                onToggle()
            }
            await delayedAction(DesignTokens.Animation.fast) {
                isCompleting = false
            }
        }
    }
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
