import SwiftUI

/// iOS Reminders-style toggle.
///
/// 44×44 hit area, 24pt visible circle. Tap toggles via `onToggle` callback;
/// the parent owns state and animates `isPointed` flips. Uses `Button` so the
/// tap is visible to VoiceOver and can be hit independently of the parent row's
/// own tap target. Apple HIG: 44pt minimum tap area.
struct PointCircle: View {
    let isPointed: Bool
    let color: Color
    let isSyncing: Bool
    let onToggle: () -> Void

    /// Debounced sync state — only flips true if the toggle takes >300 ms,
    /// so fast optimistic updates don't trigger a green-dot flash.
    @State private var displayedSyncing = false

    var body: some View {
        Button(action: onToggle) {
            ZStack {
                Circle()
                    .fill(isPointed ? color : Color.clear)
                    .overlay {
                        Circle()
                            .strokeBorder(
                                isPointed ? color : Color.outlineVariant,
                                lineWidth: DesignTokens.BorderWidth.thick
                            )
                    }
                    .frame(
                        width: DesignTokens.Checkbox.size,
                        height: DesignTokens.Checkbox.size
                    )

                if isPointed {
                    Image(systemName: "checkmark")
                        .font(.caption2.weight(.bold))
                        .foregroundStyle(.white)
                        .transition(.scale.combined(with: .opacity))
                }

                if displayedSyncing {
                    SyncIndicator(isSyncing: true)
                        .offset(x: DesignTokens.Checkbox.size / 2 - 2, y: -DesignTokens.Checkbox.size / 2 + 2)
                }
            }
            .frame(
                width: DesignTokens.TapTarget.minimum,
                height: DesignTokens.TapTarget.minimum
            )
            .contentShape(Circle())
        }
        .buttonStyle(.plain)
        .rampSyncIndicator(isSyncing: isSyncing, displayed: $displayedSyncing)
        .accessibilityLabel(isPointed ? "Pointé" : "À pointer")
        .accessibilityAddTraits(isPointed ? [.isButton, .isSelected] : .isButton)
    }
}
