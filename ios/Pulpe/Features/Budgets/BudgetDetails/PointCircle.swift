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
    let onToggle: () -> Void

    /// Debounced sync state — only flips true if the toggle takes >300 ms,
    /// so fast optimistic updates don't trigger a green-dot flash.
    @State private var displayedSyncing = false
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        Button(action: onToggle) {
            ZStack {
                if isPointed {
                    Circle()
                        .fill(color)
                        .frame(width: DesignTokens.IconSize.badge, height: DesignTokens.IconSize.badge)
                        .overlay {
                            Image(systemName: "checkmark")
                                .font(PulpeTypography.metricLabelBold)
                                .foregroundStyle(Color.textOnPrimary)
                        }
                        .transition(.scale.combined(with: .opacity))
                } else {
                    RowIcon(systemName: kind.icon, tint: color)
                        .overlay {
                            Circle().strokeBorder(color, lineWidth: DesignTokens.Checkbox.ringWidth)
                        }
                        .transition(.scale.combined(with: .opacity))
                }

                if displayedSyncing {
                    SyncIndicator(isSyncing: true)
                        .offset(
                            x: DesignTokens.IconSize.badge / 2 - DesignTokens.Checkbox.syncBadgeInset,
                            y: -DesignTokens.IconSize.badge / 2 + DesignTokens.Checkbox.syncBadgeInset
                        )
                }
            }
            .animation(reduceMotion ? nil : .easeInOut(duration: DesignTokens.Animation.fast), value: isPointed)
            .frame(
                width: DesignTokens.TapTarget.minimum,
                height: DesignTokens.TapTarget.minimum
            )
            .contentShape(Circle())
        }
        .buttonStyle(PointCirclePressStyle(reduceMotion: reduceMotion))
        .sensoryFeedback(.impact(flexibility: .soft), trigger: isPointed)
        .rampSyncIndicator(isSyncing: isSyncing, displayed: $displayedSyncing)
        .accessibilityLabel(isPointed ? "Pointé" : "À pointer")
        .accessibilityAddTraits(isPointed ? [.isButton, .isSelected] : .isButton)
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
