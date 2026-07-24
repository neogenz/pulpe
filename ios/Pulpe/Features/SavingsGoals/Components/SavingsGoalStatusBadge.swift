import SwiftUI

/// Status chip shared by the goals list rows and the goal detail header —
/// one treatment per status everywhere. ACTIVE/COMPLETED tint épargne,
/// PAUSED stays neutral (RG-002: savings is never an alert color).
///
/// `.tinted` rather than `.muted`: the detail header sits on the bare
/// `appBackground`, where `surfaceContainerHigh` is indistinguishable from
/// the canvas (1.04:1 light) — an explicit tint + ink pair separates on
/// canvas and card alike.
struct SavingsGoalStatusBadge: View {
    let status: SavingsGoalStatus
    var showsIcon = false

    var body: some View {
        PulpeChip(
            icon: showsIcon ? icon : nil,
            label: status.label,
            style: .tinted(
                surface: tint.opacity(DesignTokens.Opacity.badgeBackground),
                foreground: ink
            )
        )
    }

    private var icon: String {
        switch status {
        case .active: "target"
        case .completed: "checkmark.circle.fill"
        case .paused: "pause.circle"
        }
    }

    private var tint: Color {
        switch status {
        case .active, .completed: Color.financialSavings
        case .paused: Color.textTertiary
        }
    }

    private var ink: Color {
        switch status {
        case .active, .completed: Color.financialSavings
        case .paused: Color.textSecondary
        }
    }
}
