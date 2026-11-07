import SwiftUI

// MARK: - Ce mois-ci, À venir, Historique, menu

extension SavingsGoalDetailView {
    /// « Ce mois-ci »: the current month when it holds a prévision, the pace sentence,
    /// and the page's single button. « Planifier … » fills an empty run ahead; without
    /// one, « Ajuster mon plan » opens the simulator.
    @ViewBuilder
    func thisMonthCard(_ progress: SavingsGoalProgress, hero: GoalHeroPresentation) -> some View {
        let month = currentGoal.status == .active
            ? progress.months.first { $0.state == .current && !$0.lines.isEmpty }
            : nil
        let planTitle = GoalMonthByMonthPresentation(
            months: progress.months,
            initialAmount: progress.initialAmount,
            currency: currency
        ).planTitle
        let plan = planButton(progress, planTitle: planTitle)
        if GoalThisMonthCard.isRelevant(month: month, sentence: hero.sentence, plan: plan) {
            GoalThisMonthCard(month: month, sentence: hero.sentence, plan: plan, currency: currency)
        }
    }

    private func planButton(_ progress: SavingsGoalProgress, planTitle: String?) -> GoalThisMonthCard.PlanButton? {
        let title = planTitle ?? AppLocale.string("Ajuster mon plan")
        if canAdjust(progress) {
            return .init(title: title, opensSimulator: true, explainsChoice: planTitle != nil) { isSimulating = true }
        }
        if planTitle != nil, SavingsGoalDetailViewModel.canRepairPlan(progress, status: currentGoal.status) {
            return .init(title: title, opensSimulator: false, explainsChoice: true) { showRecoveryRecap = true }
        }
        return nil
    }

    @ViewBuilder
    func upcomingSection(_ progress: SavingsGoalProgress) -> some View {
        let items = GoalUpcomingItem.items(
            segments: GoalMonthByMonthPresentation(
                months: progress.months,
                initialAmount: progress.initialAmount,
                currency: currency
            ).segments,
            planned: viewModel.plannedWithdrawals,
            planOnly: viewModel.planOnlyWithdrawals
        )
        let failed = viewModel.withdrawalsError != nil
        if !items.isEmpty || failed {
            GoalUpcomingSection(
                items: items,
                currency: currency,
                withdrawalsFailed: failed,
                onOpenBudget: openWithdrawal,
                onRetry: { Task { await viewModel.loadWithdrawals() } }
            )
        }
    }

    /// One row that opens the whole story, summed up in a line.
    @ViewBuilder
    func historyRow(_ progress: SavingsGoalProgress) -> some View {
        let history = GoalHistoryPresentation(
            progress: progress,
            withdrawals: viewModel.withdrawals,
            payDayOfMonth: userSettingsStore.payDayOfMonth
        )
        if history.hasContent {
            NavigationLink(value: SavingsGoalDestination.history(currentGoal)) {
                PulpeListRow(
                    title: AppLocale.string("Historique"),
                    subtitle: history.summary(currency: currency)
                ) { EmptyView() }
                .sensitiveAmount()
                .padding(.horizontal, DesignTokens.Spacing.lg)
                .pulpeSurfaceCard()
                .contentShape(Rectangle())
            }
            .plainPressedButtonStyle()
            .accessibilityIdentifier("savingsGoalHistoryRow")
        }
    }

    /// Everything the goal itself can do, out of the reading path.
    @ViewBuilder
    var goalMenu: some View {
        let status = currentGoal.status
        let isOverdue = viewModel.progress?.isOverdue == true
        Menu {
            Button("Modifier l'objectif", systemImage: "pencil") { editTarget = currentGoal }
                .accessibilityIdentifier("savingsGoalEditButton")
            if status == .active, !isOverdue {
                Button("Mettre en pause", systemImage: "pause") { Task { await setStatus(.paused) } }
                    .disabled(viewModel.isMutatingStatus)
                    .accessibilityIdentifier("savingsGoalPauseButton")
            } else if status == .paused {
                Button("Reprendre", systemImage: "play") { Task { await setStatus(.active) } }
                    .disabled(viewModel.isMutatingStatus)
                    .accessibilityIdentifier("savingsGoalResumeButton")
            }
            if let requestGoalWithdrawal {
                Button("Faire un retrait", systemImage: "arrow.down") { requestGoalWithdrawal(goal.id) }
                    .accessibilityIdentifier("savingsGoalAddWithdrawalButton")
            }
            Divider()
            Button("Supprimer l'objectif", systemImage: "trash", role: .destructive) { showDeletion = true }
                .accessibilityIdentifier("savingsGoalDeleteButton")
        } label: {
            Label("Actions de l'objectif", systemImage: "ellipsis")
        }
        .accessibilityIdentifier("savingsGoalMenuButton")
    }
}
