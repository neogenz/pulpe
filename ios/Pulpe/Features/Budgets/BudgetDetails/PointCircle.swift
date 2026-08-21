import SwiftUI

/// The nature disc that opens a ledger row, and the control that points it.
///
/// Unpointed: the kind's glyph on a wash of its tint (`RowIcon`). Pointed: a full disc in
/// the tint with a checkmark. 44×44 hit area around a 36pt disc; the parent owns the state.
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
        .buttonStyle(.plain)
        .sensoryFeedback(.impact(flexibility: .soft), trigger: isPointed)
        .rampSyncIndicator(isSyncing: isSyncing, displayed: $displayedSyncing)
        .accessibilityLabel(isPointed ? "Pointé" : "À pointer")
        .accessibilityAddTraits(isPointed ? [.isButton, .isSelected] : .isButton)
    }
}
