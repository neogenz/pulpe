import SwiftUI

/// Reusable info card for the savings-goal detail — icon, title, message, and an
/// action slot. Extracted from `SavingsGoalDetailView` so the detail view stays
/// under the 500-LOC warning once the trajectory + timeline sections land.
/// Épargne accents stay primary/neutral, never amber/red (RG-002).
struct GoalInfoCard<Action: View>: View {
    let icon: String
    let title: String
    let message: String
    @ViewBuilder var action: () -> Action

    var body: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.md) {
            HStack(alignment: .top, spacing: DesignTokens.Spacing.md) {
                Image(systemName: icon)
                    .font(PulpeTypography.actionIcon)
                    .foregroundStyle(Color.pulpePrimary)

                VStack(alignment: .leading, spacing: DesignTokens.Spacing.xxs) {
                    Text(title)
                        .font(PulpeTypography.listRowTitle)
                        .foregroundStyle(Color.textPrimary)
                    Text(message)
                        .font(PulpeTypography.listRowSubtitle)
                        .foregroundStyle(Color.textSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
            action()
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .pulpeCard()
    }
}

/// The empty-state card shown when no prévision is linked to the goal.
struct GoalEmptyGuidanceCard: View {
    var body: some View {
        GoalInfoCard(
            icon: "link",
            title: "Aucune prévision rattachée",
            message: "Rattache une prévision Épargne depuis ton Mois Type ou un budget pour suivre cet objectif ici."
        ) {
            EmptyView()
        }
    }
}

/// The derived-state cards D1 (échéance dépassée), D2 (auto-complétion suggérée)
/// and the COMPLETED re-open affordance. The server owns the flags; this view only
/// renders them and forwards the user-initiated actions (never auto-flips —
/// pilier Contrôle, `docs/SAVINGS.md` §6).
struct GoalDerivedStateCards: View {
    let progress: SavingsGoalProgress
    let status: SavingsGoalStatus
    let isMutatingStatus: Bool
    let onEdit: () -> Void
    let onComplete: () -> Void
    let onReopen: () -> Void

    var body: some View {
        if status == .active, progress.isOverdue {
            GoalInfoCard(
                icon: "calendar",
                title: "Échéance dépassée",
                message: "Ton échéance est passée. Tu peux la repousser pour continuer à ton rythme."
            ) {
                Button("Repousser la date", action: onEdit)
                    .secondaryButtonStyle()
            }
        }

        if status == .active, progress.suggestCompletion {
            GoalInfoCard(
                icon: "checkmark.seal.fill",
                title: "Objectif atteint",
                message: "Tu as mis de côté l'équivalent de ta cible. On le marque comme atteint ?"
            ) {
                Button("Marquer comme atteint", action: onComplete)
                    .primaryButtonStyle(isEnabled: !isMutatingStatus)
                    .disabled(isMutatingStatus)
            }
        }

        if status == .completed {
            GoalInfoCard(
                icon: "flag.checkered",
                title: "Objectif atteint",
                message: "Tu peux le ré-ouvrir si tu veux continuer à épargner dessus."
            ) {
                Button("Ré-ouvrir", action: onReopen)
                    .secondaryButtonStyle()
                    .disabled(isMutatingStatus)
            }
        }
    }
}
