import SwiftUI

/// Progression detail for a single savings goal (PUL-8, CA7–CA9). Pushed from the
/// goals list row; the edit form now opens from here (« … » menu + the D1 CTA),
/// never straight from the row.
///
/// Renders the confirmed balance and its planned projection toward the target,
/// plus the plan verdict and the
/// derived states D1 (échéance dépassée) / D2 (auto-complétion suggérée). Épargne
/// is never an alert, so every accent is savings/primary or neutral — never
/// amber/red (RG-002, `docs/SAVINGS.md` §7).
struct SavingsGoalDetailView: View {
    let goal: SavingsGoal

    @Environment(AppState.self) private var appState
    @Environment(SavingsGoalStore.self) private var store
    @Environment(UserSettingsStore.self) var userSettingsStore
    @Environment(ToastManager.self) private var toastManager
    // Sibling aggregate stores invalidated after a plan apply (PUL-270 seam).
    @Environment(CurrentMonthStore.self) private var currentMonthStore
    @Environment(BudgetListStore.self) private var budgetListStore
    @Environment(DashboardStore.self) private var dashboardStore
    @Environment(\.dismiss) private var dismiss
    @Environment(\.requestGoalWithdrawal) var requestGoalWithdrawal

    @State var viewModel: SavingsGoalDetailViewModel
    @State var editTarget: SavingsGoal?
    @State var isSimulating = false
    @State private var pendingSimulatorBudgetId: String?
    @State var showRecoveryRecap = false
    @State private var generationStop: GenerationStopRequest?
    @State private var pendingEditUpdate: SavingsGoalUpdate?
    @State private var pendingDeadlineUpdate: SavingsGoalUpdate?
    /// Shown again once the current advisory finishes dismissing (deadline refresh).
    @State private var reopenedGenerationStop: GenerationStopRequest?
    @State var showDeletion = false

    init(
        goal: SavingsGoal,
        service: any SavingsGoalServicing = SavingsGoalService.shared
    ) {
        self.goal = goal
        _viewModel = State(initialValue: SavingsGoalDetailViewModel(goalId: goal.id, service: service))
    }

    /// Latest goal from the cache so name/status edits reflect after the form
    /// dismisses; falls back to the pushed value before the store refreshes.
    var currentGoal: SavingsGoal {
        store.goals.first { $0.id == goal.id } ?? goal
    }

    var currency: SupportedCurrency { userSettingsStore.currency }

    var body: some View {
        Group {
            if viewModel.isLoading, viewModel.progress == nil {
                SavingsGoalDetailSkeletonView()
            } else if let progress = viewModel.progress {
                content(progress: progress)
            } else if let error = viewModel.error {
                ErrorView(error: error) { await viewModel.load() }
            }
        }
        .navigationTitle(currentGoal.name)
        .navigationBarTitleDisplayMode(.inline)
        // The page states the name in its own header.
        .toolbar(removing: .title)
        .background { Color.appBackground.ignoresSafeArea() }
        .toolbar {
            ToolbarItem(placement: .primaryAction) { goalMenu }
        }
        .sheet(isPresented: $showDeletion) {
            GoalDeletionSheet(goal: currentGoal, currency: currency, onDeleted: deletionDidCommit)
                .standardSheetPresentation(detents: [.large])
        }
        .sheet(item: $editTarget, onDismiss: handleEditDismiss) { goal in
            SavingsGoalFormSheet(
                goal: goal,
                userCurrency: currency,
                payDayOfMonth: userSettingsStore.payDayOfMonth,
                onUpdate: { pendingEditUpdate = $0 }
            )
        }
        .sheet(isPresented: $showRecoveryRecap) {
            if let progress = viewModel.progress {
                GoalPlanApplyRecapSheet(
                    mode: .creation,
                    changes: recoveryChanges(progress),
                    verdict: recoveryVerdict(progress),
                    currency: currency,
                    goalName: currentGoal.name,
                    targetAmount: progress.targetAmount,
                    onConfirm: { _ in
                        let succeeded = await viewModel.applyMissingForecasts(from: progress)
                        guard succeeded else {
                            if let error = viewModel.error {
                                toastManager.show(DomainErrorLocalizer.localize(error), type: .error)
                            }
                            return false
                        }
                        await handlePlanApplied()
                        return true
                    }
                )
            }
        }
        .sheet(item: $generationStop, onDismiss: handleGenerationStopDismiss) { request in
            GoalGenerationStopSheet(
                lines: request.lines,
                context: request.context,
                currency: currency,
                goalName: currentGoal.name,
                savedAmount: viewModel.progress?.confirmed,
                onApply: { mode in
                    if case .deadline(let targetDate) = request.context {
                        try await applyDeadlineReconciliation(mode, lines: request.lines, targetDate: targetDate)
                    } else {
                        try await applyGenerationStop(mode, lines: request.lines)
                    }
                }
            )
            .standardSheetPresentation()
        }
        .task {
            await viewModel.load()
            await refreshFutureLinesIfStopped()
        }
        .onChange(of: store.budgetMutationVersion) {
            Task { await viewModel.load() }
        }
        .trackScreen("SavingsGoalDetail")
    }

    // MARK: - Content

    @ViewBuilder
    private func content(progress: SavingsGoalProgress) -> some View {
        let hero = GoalHeroPresentation(progress: progress, status: currentGoal.status, currency: currency)
        ScrollView {
            VStack(alignment: .leading, spacing: DesignTokens.Spacing.none) {
                PageHeader(title: currentGoal.name, subtitle: hero.dateLine?.text)
                    .ifLet(hero.dateLine?.identifier) { view, id in view.accessibilityIdentifier(id) }
                    .padding(.top, DesignTokens.Spacing.sm)
                    .padding(.bottom, DesignTokens.Spacing.md)

                VStack(alignment: .leading, spacing: DesignTokens.Spacing.xxl) {
                    GoalProgressHero(presentation: hero, currency: currency)
                    sections(progress, hero: hero)
                }
                .padding(.horizontal, DesignTokens.Spacing.lg)
                .padding(.bottom, DesignTokens.Spacing.lg)
            }
        }
        .scrollContentBackground(.hidden)
        .pulpeRootBottomInset()
        .refreshable { await viewModel.load() }
        .accessibilityIdentifier("savingsGoalDetailRoot")
        .sheet(isPresented: $isSimulating, onDismiss: openPendingSimulatorBudget) {
            simulator(progress: progress)
        }
    }

    /// Section rhythm of the home: `xxl` between sections, `md` from a
    /// title to the card it introduces — the 2:1 ratio that tells which
    /// block a header belongs to.
    @ViewBuilder
    private func sections(_ progress: SavingsGoalProgress, hero: GoalHeroPresentation) -> some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.xxl) {
            if progress.linkedLineCount == 0 {
                GoalEmptyGuidanceCard()
            }

            GoalDerivedStateCards(
                progress: progress,
                status: currentGoal.status,
                currency: currency,
                payDayOfMonth: userSettingsStore.payDayOfMonth,
                isMutatingStatus: viewModel.isMutatingStatus,
                futureLinesCount: viewModel.futureLines.count,
                onEdit: { editTarget = currentGoal },
                onComplete: { Task { await setStatus(.completed) } },
                onReopen: { Task { await setStatus(.active) } },
                onManageFutureLines: { Task { await proposeGenerationStop() } }
            )

            thisMonthCard(progress, hero: hero)
            upcomingSection(progress)
            historyRow(progress)
        }
    }

    private func simulator(progress: SavingsGoalProgress) -> some View {
        GoalPlanSimulatorSheet(
            goal: currentGoal,
            progress: progress,
            currency: currency,
            plannedWithdrawals: viewModel.plannedWithdrawals,
            onApplied: { await handlePlanApplied() },
            onOpenBudget: queueBudgetFromSimulator,
            onPlanConflict: { await handlePlanConflict() }
        )
    }

    /// Pushes the budget onto the stack the user is actually looking at, so Back
    /// returns to this goal instead of dropping them into another tab.
    func openWithdrawal(_ budgetId: String) {
        appState.pushOnActiveStack(BudgetDestination.details(budgetId: budgetId))
    }

    private func queueBudgetFromSimulator(_ budgetId: String) {
        pendingSimulatorBudgetId = budgetId
        isSimulating = false
    }

    private func openPendingSimulatorBudget() {
        guard let budgetId = pendingSimulatorBudgetId else { return }
        pendingSimulatorBudgetId = nil
        openWithdrawal(budgetId)
    }
}

extension SavingsGoalDetailView {
    // MARK: - Actions

    /// Post-apply invalidation (PUL-270): a plan apply rewrites budget-line amounts,
    /// so every store projecting those aggregates goes stale. Invalidate them, drop
    /// the shared budget-detail cache and the goal list, then refetch this goal's
    /// progression and confirm.
    private func handlePlanApplied() async {
        currentMonthStore.invalidateCache()
        budgetListStore.invalidateCache()
        dashboardStore.invalidateCache()
        BudgetDetailCache.shared.invalidateAll()
        store.invalidateCache()
        await viewModel.load()
        toastManager.show(AppLocale.string("Ton plan est à jour"))
    }

    /// A 409 means the recap's baseline is stale. The simulator has already
    /// closed; reload all three detail reads before asking for a new simulation.
    private func handlePlanConflict() async {
        store.invalidateCache()
        await viewModel.load()
        toastManager.show(APIError.savingsGoalPlanConflict.localizedDescription, type: .error)
    }

    func setStatus(_ status: SavingsGoalStatus) async {
        await viewModel.changeStatus(to: status, via: store)
        if let error = viewModel.error {
            toastManager.show(DomainErrorLocalizer.localize(error), type: .error)
            return
        }
        let message = switch status {
        case .completed: AppLocale.string("Objectif marqué comme atteint")
        case .paused: AppLocale.string("Objectif mis en pause")
        case .active: AppLocale.string("Objectif ré-ouvert")
        }
        toastManager.show(message)
        if status != .active {
            await proposeGenerationStop()
        }
    }

    private func handleEditDismiss() {
        if let update = pendingEditUpdate {
            pendingEditUpdate = nil
            Task { await submitEdit(update) }
            return
        }
        if store.goals.contains(where: { $0.id == goal.id }) {
            Task {
                await viewModel.load()
                // The goal may have been paused/completed meanwhile — refresh the
                // advisory candidates so the CA8 card reflects the new status.
                await refreshFutureLinesIfStopped()
            }
        } else {
            // Goal was deleted elsewhere: pop back to the list.
            dismiss()
        }
    }

    func deletionDidCommit(warning: String?) {
        showDeletion = false
        if let warning {
            toastManager.show(warning, type: .error)
        } else {
            toastManager.show(AppLocale.string("Objectif supprimé"))
        }
        dismiss()
    }

    private func submitEdit(_ update: SavingsGoalUpdate) async {
        if let targetDate = Self.deadlinePreviewTarget(
            previous: currentGoal.targetDate,
            update: update.targetDate,
            payDayOfMonth: userSettingsStore.payDayOfMonth
        ) {
            do {
                let lines = try await store.getFutureLines(id: goal.id, targetDate: targetDate)
                if !lines.isEmpty {
                    pendingDeadlineUpdate = update
                    generationStop = GenerationStopRequest(lines: lines, context: .deadline(targetDate: targetDate))
                    return
                }
            } catch {
                toastManager.show(DomainErrorLocalizer.localize(error), type: .error)
                return
            }
        }
        await applyEdit(update)
    }

    private func applyEdit(_ update: SavingsGoalUpdate) async {
        do {
            _ = try await store.update(id: goal.id, data: update)
            await viewModel.load()
            await refreshFutureLinesIfStopped()
            toastManager.show(AppLocale.string("Objectif modifié"))
        } catch let error as APIError where error.requiresSavingsGoalReconciliationRefresh {
            guard case .some(let updatedTarget) = update.targetDate,
                  let targetDate = updatedTarget else {
                toastManager.show(DomainErrorLocalizer.localize(error), type: .error)
                return
            }
            do {
                try await refreshDeadlineDecision(
                    update,
                    targetDate: targetDate,
                    after: error,
                    reopenAfterDismiss: false
                )
            } catch {
                toastManager.show(DomainErrorLocalizer.localize(error), type: .error)
            }
        } catch {
            toastManager.show(DomainErrorLocalizer.localize(error), type: .error)
        }
    }

    // MARK: - Generation stop (PUL-285 CA8)

    private func refreshFutureLinesIfStopped() async {
        guard currentGoal.status != .active else { return }
        await viewModel.loadFutureLines()
    }

    /// Fetches fresh candidates and presents the advisory sheet when the
    /// stopped goal still has linked prévisions on future months. Dismissing
    /// writes nothing — the derived card stays as re-entry.
    private func proposeGenerationStop() async {
        await viewModel.loadFutureLines()
        guard !viewModel.futureLines.isEmpty else { return }
        generationStop = GenerationStopRequest(lines: viewModel.futureLines, context: .status(currentGoal.status))
    }

    private func handleGenerationStopDismiss() {
        if let reopened = reopenedGenerationStop {
            reopenedGenerationStop = nil
            generationStop = reopened
        } else {
            pendingDeadlineUpdate = nil
        }
    }

    private func applyDeadlineReconciliation(
        _ mode: SavingsGoalGenerationStopMode,
        lines: [SavingsGoalFutureLine],
        targetDate: String
    ) async throws {
        guard var update = pendingDeadlineUpdate else { return }
        update.reconciliation = SavingsGoalGenerationStop(mode: mode, budgetLineIds: lines.map(\.budgetLineId))
        do {
            _ = try await store.update(id: goal.id, data: update)
            await viewModel.load()
            await refreshFutureLinesIfStopped()
            toastManager.show(AppLocale.string("Objectif modifié"))
        } catch let error as APIError where error.requiresSavingsGoalReconciliationRefresh {
            try await refreshDeadlineDecision(
                update,
                targetDate: targetDate,
                after: error,
                reopenAfterDismiss: true
            )
        }
    }

    private func refreshDeadlineDecision(
        _ update: SavingsGoalUpdate,
        targetDate: String,
        after error: APIError,
        reopenAfterDismiss: Bool
    ) async throws {
        toastManager.show(DomainErrorLocalizer.localize(error), type: .error)
        guard let decision = try await Self.refreshedDeadlineDecision(
            id: goal.id,
            update: update,
            targetDate: targetDate,
            store: store
        ) else {
            pendingDeadlineUpdate = nil
            return
        }
        pendingDeadlineUpdate = decision.update
        let request = GenerationStopRequest(lines: decision.lines, context: .deadline(targetDate: decision.targetDate))
        if reopenAfterDismiss {
            reopenedGenerationStop = request
        } else {
            generationStop = request
        }
    }

    /// Applies the decision through the store seam, which owns the aggregate
    /// invalidation (frozen or deleted budget lines stale every store projecting
    /// them, PUL-270). Then refetches this goal's progression and candidates.
    private func applyGenerationStop(
        _ mode: SavingsGoalGenerationStopMode,
        lines: [SavingsGoalFutureLine]
    ) async throws {
        let result = try await store.applyGenerationStop(
            id: goal.id,
            SavingsGoalGenerationStop(mode: mode, budgetLineIds: lines.map(\.budgetLineId))
        )
        await viewModel.load()
        await viewModel.loadFutureLines()
        toastManager.show(
            mode == .freeze
                ? AppLocale.string("\(result.affectedCount) prévision(s) conservée(s) sans objectif")
                : AppLocale.string("\(result.affectedCount) prévision(s) retirée(s) de tes mois futurs")
        )
    }
}

/// One opening of the generation-stop advisory: its candidates and why it opened. Presented
/// as a sheet item so the sheet is built from this payload, never from side state that the
/// presentation can read before it is written.
private struct GenerationStopRequest: Identifiable {
    let id = UUID()
    let lines: [SavingsGoalFutureLine]
    let context: GoalGenerationStopContext
}
