import SwiftUI

// MARK: - Retraits & Objectif sections

extension SavingsGoalDetailView {
    /// Retraits shows where it has something to say (history, planned) and on an
    /// ordinary active goal, whose header offers « Faire un retrait ». Late or paused,
    /// the board moves that entry into the Objectif rows instead.
    func showsWithdrawalsSection(_ progress: SavingsGoalProgress) -> Bool {
        GoalWithdrawalsSection.isRelevant(
            withdrawals: viewModel.withdrawals,
            planned: viewModel.plannedWithdrawals,
            planOnly: viewModel.planOnlyWithdrawals,
            isLoading: viewModel.isLoadingWithdrawals,
            error: viewModel.withdrawalsError
        ) || (currentGoal.status == .active && !progress.isOverdue)
    }

    func goalActionsSection(_ progress: SavingsGoalProgress) -> some View {
        let status = currentGoal.status
        let isOrdinary = status == .active && !progress.isOverdue && progress.suggestCompletion != true
        let withdrawal = showsWithdrawalsSection(progress) ? nil : requestGoalWithdrawal
        return VStack(alignment: .leading, spacing: DesignTokens.Spacing.md) {
            SectionHeader(title: AppLocale.string("Objectif"))
            VStack(spacing: DesignTokens.Spacing.none) {
                GoalActionRow(
                    title: AppLocale.string("Modifier l'objectif"),
                    subtitle: AppLocale.string("Nom, cible, échéance")
                ) { editTarget = currentGoal }
                if isOrdinary {
                    Divider().overlay(Color.outlineVariant)
                    GoalActionRow(
                        title: AppLocale.string("Mettre en pause"),
                        subtitle: AppLocale.string("Plus rien de nouveau n'est prévu")
                    ) { Task { await setStatus(.paused) } }
                    .disabled(viewModel.isMutatingStatus)
                    .accessibilityIdentifier("savingsGoalPauseButton")
                }
                if let withdrawal {
                    Divider().overlay(Color.outlineVariant)
                    GoalActionRow(
                        title: AppLocale.string("Faire un retrait"),
                        subtitle: status == .paused
                            ? AppLocale.string("L'argent reste disponible pendant la pause")
                            : AppLocale.string("Tu as déjà payé une partie ?")
                    ) { withdrawal(goal.id) }
                }
                Divider().overlay(Color.outlineVariant)
                GoalActionRow(
                    title: AppLocale.string("Supprimer l'objectif"),
                    subtitle: AppLocale.string("Tu choisis ce que tu gardes"),
                    isDestructive: true
                ) { showDeletion = true }
                .accessibilityIdentifier("savingsGoalDeleteButton")
            }
            .padding(.horizontal, DesignTokens.Spacing.lg)
            .pulpeSurfaceCard()
        }
    }
}

/// One row of the « Objectif » card: a title, one fact, a chevron. The delete row reads
/// in red and drops the chevron's promise of a page.
private struct GoalActionRow: View {
    let title: String
    let subtitle: String
    var isDestructive = false
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: DesignTokens.Spacing.md) {
                VStack(alignment: .leading, spacing: DesignTokens.Spacing.dividerGap) {
                    Text(title)
                        .font(PulpeTypography.rowTitle)
                        .foregroundStyle(isDestructive ? Color.destructivePrimary : Color.textPrimary)
                    Text(subtitle)
                        .font(PulpeTypography.captionRegular)
                        .foregroundStyle(Color.textSecondary)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                if !isDestructive {
                    RowChevron()
                }
            }
            .padding(.vertical, DesignTokens.ListRow.verticalPadding + DesignTokens.Spacing.xxs)
            .frame(minHeight: DesignTokens.ListRow.minHeight)
        }
        .plainPressedButtonStyle()
        .contentShape(Rectangle())
    }
}
