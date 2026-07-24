import SwiftUI

/// Status chip shared by the goals list rows and the goal detail header —
/// one treatment per status everywhere. ACTIVE/COMPLETED tint épargne,
/// PAUSED stays neutral (RG-002: savings is never an alert color).
///
/// Tinted rather than `.muted`: the detail header sits on the bare
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
            style: style
        )
    }

    /// ACTIVE / COMPLETED share one savings color for wash and ink, so they take the
    /// shared `.semantic` recipe. PAUSED deliberately splits the pair — a neutral wash
    /// under a readable secondary ink — and keeps its explicit `.tinted`.
    private var style: PulpeChip<EmptyView>.Style {
        switch status {
        case .active, .completed:
            .semantic(.financialSavings)
        case .paused:
            .tinted(
                surface: Color.textTertiary.opacity(DesignTokens.Opacity.badgeBackground),
                foreground: Color.textSecondary
            )
        }
    }

    private var icon: String {
        switch status {
        case .active: "target"
        case .completed: "checkmark.circle.fill"
        case .paused: "pause.circle"
        }
    }
}
