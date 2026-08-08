// swiftlint:disable file_length
import SwiftUI

struct SavingsGoalDeadlineDecision {
    var update: SavingsGoalUpdate
    let targetDate: String
    let lines: [SavingsGoalFutureLine]
}

/// Progression detail for a single savings goal (PUL-8, CA7–CA9). Pushed from the
/// goals list row; the edit form now opens from here (toolbar + the D1 CTA),
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
    @Environment(UserSettingsStore.self) private var userSettingsStore
    @Environment(ToastManager.self) private var toastManager
    // Sibling aggregate stores invalidated after a plan apply (PUL-270 seam).
    @Environment(CurrentMonthStore.self) private var currentMonthStore
    @Environment(BudgetListStore.self) private var budgetListStore
    @Environment(DashboardStore.self) private var dashboardStore
    @Environment(\.dismiss) private var dismiss

    @State private var viewModel: SavingsGoalDetailViewModel
    @State private var editTarget: SavingsGoal?
    @State private var isSimulating = false
    @State private var showRecoveryRecap = false
    @State private var showGenerationStop = false
    @State private var generationStopCandidates: [SavingsGoalFutureLine] = []
    @State private var generationStopContext: GoalGenerationStopContext?
    @State private var pendingEditUpdate: SavingsGoalUpdate?
    @State private var pendingDeadlineUpdate: SavingsGoalUpdate?
    @State private var reopenGenerationStop = false

    init(
        goal: SavingsGoal,
        service: any SavingsGoalServicing = SavingsGoalService.shared
    ) {
        self.goal = goal
        _viewModel = State(initialValue: SavingsGoalDetailViewModel(goalId: goal.id, service: service))
    }

    /// Latest goal from the cache so name/status edits reflect after the form
    /// dismisses; falls back to the pushed value before the store refreshes.
    private var currentGoal: SavingsGoal {
        store.goals.first { $0.id == goal.id } ?? goal
    }

    private var currency: SupportedCurrency { userSettingsStore.currency }

    var body: some View {
        Group {
            if viewModel.isLoading, viewModel.progress == nil {
                ProgressView()
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if let progress = viewModel.progress {
                content(progress: progress)
            } else if let error = viewModel.error {
                ErrorView(error: error) { await viewModel.load() }
            }
        }
        .navigationTitle(currentGoal.name)
        .navigationBarTitleDisplayMode(.inline)
        .pulpeBackground()
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button {
                    editTarget = currentGoal
                } label: {
                    Image(systemName: "pencil")
                }
                .accessibilityLabel("Modifier l'objectif")
            }
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
        .sheet(isPresented: $showGenerationStop, onDismiss: handleGenerationStopDismiss) {
            GoalGenerationStopSheet(
                lines: generationStopCandidates,
                context: generationStopContext ?? .status(currentGoal.status),
                currency: currency,
                onApply: { mode in
                    if pendingDeadlineUpdate != nil {
                        try await applyDeadlineReconciliation(mode)
                    } else {
                        try await applyGenerationStop(mode)
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
        ScrollView {
            VStack(alignment: .leading, spacing: DesignTokens.Spacing.xl) {
                header(progress: progress)

                GoalProgressCard(progress: progress, currency: currency)
                if progress.linkedLineCount == 0 {
                    GoalEmptyGuidanceCard()
                }

                GoalDerivedStateCards(
                    progress: progress,
                    status: currentGoal.status,
                    isMutatingStatus: viewModel.isMutatingStatus,
                    futureLinesCount: viewModel.futureLines.count,
                    onEdit: { editTarget = currentGoal },
                    onComplete: { Task { await setStatus(.completed) } },
                    onReopen: { Task { await setStatus(.active) } },
                    onManageFutureLines: { Task { await proposeGenerationStop() } }
                )

                if SavingsGoalDetailViewModel.shouldShowPlanTimeline(progress) {
                    if progress.linkedLineCount > 0 {
                        // Construite une seule fois : la même série gate la section
                        // et alimente le chart (jusqu'à ~96 mois mappés par lecture).
                        let series = GoalProjectionSeries.read(from: progress)
                        if series.hasConfirmedTrend {
                            GoalTrajectorySection(progress: progress, series: series, currency: currency)
                        }
                    }
                    GoalPlanTimelineSection(
                        months: progress.months,
                        currency: currency,
                        canAdjust: canAdjust(progress),
                        canRepair: SavingsGoalDetailViewModel.canRepairPlan(progress, status: currentGoal.status),
                        onAdjust: { isSimulating = true },
                        onRepair: { showRecoveryRecap = true }
                    )
                }

                contributionsSection(progress)
                withdrawalsSection
            }
            .padding(.horizontal, DesignTokens.Spacing.lg)
            .padding(.vertical, DesignTokens.Spacing.lg)
        }
        .scrollContentBackground(.hidden)
        .refreshable { await viewModel.load() }
        .accessibilityIdentifier("savingsGoalDetailRoot")
        .sheet(isPresented: $isSimulating) {
            GoalPlanSimulatorSheet(
                goal: currentGoal,
                progress: progress,
                currency: currency,
                onApplied: { await handlePlanApplied() }
            )
        }
    }

    @ViewBuilder
    private func contributionsSection(_ progress: SavingsGoalProgress) -> some View {
        if progress.linkedLineCount > 0 {
            GoalContributionsSection(
                contributions: viewModel.contributions,
                currency: currency,
                isLoading: viewModel.isLoadingContributions,
                error: viewModel.contributionsError,
                onRetry: { Task { await viewModel.loadContributions() } }
            )
            .accessibilityIdentifier("savingsGoalContributionsSection")
        }
    }

    /// Survives an empty plan on purpose: a goal can lose every linked prévision
    /// and still owe its withdrawal history (PUL-329).
    @ViewBuilder
    private var withdrawalsSection: some View {
        if GoalWithdrawalsSection.isRelevant(
            withdrawals: viewModel.withdrawals,
            planned: viewModel.plannedWithdrawals,
            planOnly: viewModel.planOnlyWithdrawals,
            isLoading: viewModel.isLoadingWithdrawals,
            error: viewModel.withdrawalsError
        ) {
            GoalWithdrawalsSection(
                withdrawals: viewModel.withdrawals,
                planned: viewModel.plannedWithdrawals,
                planOnly: viewModel.planOnlyWithdrawals,
                currency: currency,
                isLoading: viewModel.isLoadingWithdrawals,
                error: viewModel.withdrawalsError,
                onOpenBudget: openWithdrawal
            )
            .accessibilityIdentifier("savingsGoalWithdrawalsSection")
        }
    }

    /// Pushes the budget onto the stack the user is actually looking at, so Back
    /// returns to this goal instead of dropping them into another tab.
    private func openWithdrawal(_ budgetId: String) {
        appState.pushOnActiveStack(BudgetDestination.details(budgetId: budgetId))
    }

    /// Simulator entry (pilier C): active goal, at least one linked line, at least
    /// one open month. Hidden for PAUSED/COMPLETED (no rhythm verdict → no editing).
    private func canAdjust(_ progress: SavingsGoalProgress) -> Bool {
        guard currentGoal.status == .active, progress.linkedLineCount > 0 else { return false }
        return progress.months.contains { SavingsPlanCalculator.isContributivePlanMonth($0) }
    }

    private func recoveryChanges(
        _ progress: SavingsGoalProgress
    ) -> [SavingsPlanCalculator.SimulatedMonth] {
        guard let amount = SavingsGoalDetailViewModel.recoveryAmount(progress) else { return [] }
        // Each repaired month adds `amount` on top of every repair before it, so
        // the running total accumulates — `plannedCumulative + amount` alone would
        // report the same figure for all N months. Mirrors the accumulation
        // `SavingsPlanCalculator.simulate` performs on the adjustment path.
        var repaired = Decimal.zero
        return progress.months.filter(\.isRepairable).map {
            repaired += amount
            return SavingsPlanCalculator.SimulatedMonth(
                month: $0,
                simulatedAmount: amount,
                simulatedCumulative: $0.plannedCumulative + repaired,
                isAdjusted: true,
                replacesExistingPlanWithdrawal: false
            )
        }
    }

    private func recoveryVerdict(_ progress: SavingsGoalProgress) -> String {
        let changes = recoveryChanges(progress)
        let added = changes.reduce(Decimal.zero) { $0 + $1.simulatedAmount }
        return "Projection après création : "
            + (progress.plannedProjection + added).asCompactCurrency(currency)
    }

    // MARK: - Header

    @ViewBuilder
    private func header(progress: SavingsGoalProgress) -> some View {
        HStack(spacing: DesignTokens.Spacing.sm) {
            SavingsGoalStatusBadge(status: currentGoal.status, showsIcon: true)

            if let start = progress.startDateValue, let end = progress.targetDateValue {
                Text(
                    "\(start.formatted(date: .abbreviated, time: .omitted))"
                        + " → \(end.formatted(date: .abbreviated, time: .omitted))"
                )
                .font(PulpeTypography.listRowSubtitle)
                .foregroundStyle(Color.textTertiary)
            } else if let date = progress.targetDateValue {
                Text("Échéance \(date.formatted(date: .abbreviated, time: .omitted))")
                    .font(PulpeTypography.listRowSubtitle)
                    .foregroundStyle(Color.textTertiary)
            } else if let date = progress.startDateValue {
                Text("Depuis \(date.formatted(date: .abbreviated, time: .omitted))")
                    .font(PulpeTypography.listRowSubtitle)
                    .foregroundStyle(Color.textTertiary)
            }

            Spacer(minLength: 0)
        }
    }
}

private extension SavingsGoalDetailView {
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
        toastManager.show("Ton plan est à jour")
    }

    private func setStatus(_ status: SavingsGoalStatus) async {
        await viewModel.changeStatus(to: status, via: store)
        if let error = viewModel.error {
            toastManager.show(DomainErrorLocalizer.localize(error), type: .error)
            return
        }
        toastManager.show(status == .completed ? "Objectif marqué comme atteint" : "Objectif ré-ouvert")
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
                // The edit form can pause/complete the goal — refresh the
                // advisory candidates so the CA8 card reflects the new status.
                await refreshFutureLinesIfStopped()
            }
        } else {
            // Goal was deleted from the edit form — pop back to the list.
            dismiss()
        }
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
                    generationStopCandidates = lines
                    generationStopContext = .deadline(targetDate: targetDate)
                    showGenerationStop = true
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
            toastManager.show("Objectif modifié")
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
        generationStopCandidates = viewModel.futureLines
        generationStopContext = .status(currentGoal.status)
        showGenerationStop = true
    }

    private func handleGenerationStopDismiss() {
        if reopenGenerationStop {
            reopenGenerationStop = false
            showGenerationStop = true
        } else {
            pendingDeadlineUpdate = nil
            generationStopContext = nil
        }
    }

    private func applyDeadlineReconciliation(_ mode: SavingsGoalGenerationStopMode) async throws {
        guard var update = pendingDeadlineUpdate,
              case .deadline(let targetDate) = generationStopContext else { return }
        update.reconciliation = SavingsGoalGenerationStop(
            mode: mode,
            budgetLineIds: generationStopCandidates.map(\.budgetLineId)
        )
        do {
            _ = try await store.update(id: goal.id, data: update)
            await viewModel.load()
            await refreshFutureLinesIfStopped()
            toastManager.show("Objectif modifié")
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
        generationStopCandidates = decision.lines
        generationStopContext = .deadline(targetDate: decision.targetDate)
        if reopenAfterDismiss {
            reopenGenerationStop = true
        } else {
            showGenerationStop = true
        }
    }

    /// Applies the decision through the store seam, which owns the aggregate
    /// invalidation (frozen or deleted budget lines stale every store projecting
    /// them, PUL-270). Then refetches this goal's progression and candidates.
    private func applyGenerationStop(_ mode: SavingsGoalGenerationStopMode) async throws {
        let result = try await store.applyGenerationStop(
            id: goal.id,
            SavingsGoalGenerationStop(
                mode: mode,
                budgetLineIds: generationStopCandidates.map(\.budgetLineId)
            )
        )
        await viewModel.load()
        await viewModel.loadFutureLines()
        toastManager.show(
            mode == .freeze
                ? "\(result.affectedCount) prévision(s) conservée(s) sans objectif"
                : "\(result.affectedCount) prévision(s) retirée(s) de tes mois futurs"
        )
    }
}

extension SavingsGoalDetailView {
    @MainActor
    static func refreshedDeadlineDecision(
        id: String,
        update: SavingsGoalUpdate,
        targetDate: String,
        store: SavingsGoalStore
    ) async throws -> SavingsGoalDeadlineDecision? {
        let lines = try await store.getFutureLines(id: id, targetDate: targetDate)
        guard !lines.isEmpty else { return nil }
        var update = update
        update.reconciliation = nil
        return SavingsGoalDeadlineDecision(update: update, targetDate: targetDate, lines: lines)
    }

    nonisolated static func deadlinePreviewTarget(
        previous: String?,
        update: String??,
        payDayOfMonth: Int?
    ) -> String? {
        guard let previous,
              case .some(let updatedValue) = update,
              let updated = updatedValue,
              let previousDate = SavingsGoalDateFormatter.parse(previous),
              let updatedDate = SavingsGoalDateFormatter.parse(updated) else { return nil }
        let previousPeriod = BudgetPeriodCalculator.periodForDate(previousDate, payDayOfMonth: payDayOfMonth)
        let updatedPeriod = BudgetPeriodCalculator.periodForDate(updatedDate, payDayOfMonth: payDayOfMonth)
        return BudgetPeriodCalculator.comparePeriods(updatedPeriod, previousPeriod) < 0 ? updated : nil
    }
}

// MARK: - ViewModel

/// Drives `SavingsGoalDetailView`: fetches the derived progression and routes
/// status changes through `SavingsGoalStore` (so the goals list stays fresh),
/// refetching progress after each change. The server owns every figure; this
/// object only loads and mutates status.
@Observable @MainActor
final class SavingsGoalDetailViewModel {
    let goalId: String

    private(set) var progress: SavingsGoalProgress?
    private(set) var contributions: [SavingsGoalContribution] = []
    private(set) var withdrawals: [SavingsGoalWithdrawal] = []
    private(set) var plannedWithdrawals: [SavingsGoalPlannedWithdrawal] = []
    private(set) var planOnlyWithdrawals: [SavingsGoalPlanOnlyWithdrawal] = []
    private(set) var futureLines: [SavingsGoalFutureLine] = []
    private(set) var isLoading = true
    private(set) var isLoadingContributions = false
    private(set) var isLoadingWithdrawals = false
    private(set) var isMutatingStatus = false
    private(set) var error: Error?
    private(set) var contributionsError: Error?
    private(set) var withdrawalsError: Error?

    private let service: any SavingsGoalServicing

    init(goalId: String, service: any SavingsGoalServicing = SavingsGoalService.shared) {
        self.goalId = goalId
        self.service = service
    }

    // MARK: - Day-1 verdict gate

    /// No pace verdict before the first plan month has closed: a fresh goal has
    /// nothing to be judged on yet. Closed = server-locked (strictly-past cycle
    /// or everything pointé — same signal the timeline dims rows on).
    static func hasClosedPlanMonth(_ months: [SavingsGoalPlanMonth]) -> Bool {
        months.contains { $0.isContributionEligible && $0.isLocked }
    }

    /// Amount for the day-1 « plan prêt » beat: the current month's planned
    /// amount. `nil` (beat hidden) when the timeline has no funded current
    /// month — legacy payload without `months`, or a gap month.
    static func currentMonthPlannedAmount(_ months: [SavingsGoalPlanMonth]) -> Decimal? {
        guard let amount = months.first(where: { $0.state == .current })?.plannedAmount,
              amount > 0 else { return nil }
        return amount
    }

    /// « requis ≈ prévu » band for the deadline stat — same ±5 % relative
    /// tolerance as the server's pace verdict (`PACE_TOLERANCE_PERCENT`), so
    /// the stat never contradicts the verdict shown above it. Outside the band
    /// the stat becomes one sentence relating both rhythms.
    static func requiredMatchesPlannedPace(planned: Decimal, required: Decimal) -> Bool {
        guard planned > 0 else { return required <= 0 }
        return abs(required - planned) <= planned * SavingsGoalProgress.paceTolerancePercent / 100
    }

    static func recoveryAmount(_ progress: SavingsGoalProgress) -> Decimal? {
        guard let amount = progress.required?.rounded(2, .up), amount > 0 else { return nil }
        return amount
    }

    static func canRepairPlan(_ progress: SavingsGoalProgress, status: SavingsGoalStatus) -> Bool {
        status == .active
            && recoveryAmount(progress) != nil
            && progress.months.contains(where: \.isRepairable)
    }

    static func shouldShowPlanTimeline(_ progress: SavingsGoalProgress) -> Bool {
        !progress.months.isEmpty
    }

    /// Initial / pull-to-refresh load. Shows the full-screen spinner while the
    /// first fetch is in flight (progress still nil). The three reads carry
    /// their own state: a history that fails must not blank out a progression
    /// that loaded, so none of them can speak for the others.
    func load() async {
        isLoading = true
        defer { isLoading = false }
        async let progressLoad: Void = fetchProgress()
        async let contributionsLoad: Void = loadContributions()
        async let withdrawalsLoad: Void = loadWithdrawals()
        await progressLoad
        await contributionsLoad
        await withdrawalsLoad
    }

    func loadContributions() async {
        isLoadingContributions = true
        contributionsError = nil
        defer { isLoadingContributions = false }
        do {
            contributions = try await service.getContributions(id: goalId)
        } catch {
            contributionsError = error
        }
    }

    /// Incomes drawn from this goal (PUL-329), newest first — the server's order
    /// is the displayed order.
    func loadWithdrawals() async {
        isLoadingWithdrawals = true
        withdrawalsError = nil
        defer { isLoadingWithdrawals = false }
        do {
            let readModel = try await service.getWithdrawals(id: goalId)
            withdrawals = readModel.withdrawals
            plannedWithdrawals = readModel.planned
            planOnlyWithdrawals = readModel.planOnly
        } catch {
            withdrawalsError = error
        }
    }

    /// Changes status via the store (keeps the cached list in sync) then
    /// refetches progress so `suggestCompletion` and the status flip are
    /// reflected. Never auto-flips — always user-initiated (pilier Contrôle).
    func changeStatus(to status: SavingsGoalStatus, via store: SavingsGoalStore) async {
        isMutatingStatus = true
        defer { isMutatingStatus = false }
        error = nil
        do {
            _ = try await store.update(id: goalId, data: SavingsGoalUpdate(status: status))
            await fetchProgress(reportError: false)
        } catch {
            self.error = error
        }
    }

    func applyMissingForecasts(from progress: SavingsGoalProgress) async -> Bool {
        error = nil
        guard let amount = Self.recoveryAmount(progress) else { return false }
        let adjustments = progress.months
            .filter(\.isRepairable)
            .map {
                SavingsGoalPlanApply.MissingMonthAdjustment(
                    month: $0.month,
                    year: $0.year,
                    amount: amount
                )
            }
        guard !adjustments.isEmpty else { return false }

        do {
            _ = try await service.applyPlan(
                id: goalId,
                SavingsGoalPlanApply(
                    monthAdjustments: [],
                    missingMonthAdjustments: adjustments
                )
            )
            return true
        } catch {
            self.error = error
            return false
        }
    }

    private func fetchProgress(reportError: Bool = true) async {
        error = nil
        do {
            progress = try await service.getProgress(id: goalId)
        } catch {
            if reportError { self.error = error }
        }
    }

    // MARK: - Generation stop (PUL-285 CA8)

    /// Advisory candidates: the goal's future linked lines. Read is advisory —
    /// a failure just leaves the card hidden (the user can pull-to-refresh).
    func loadFutureLines() async {
        futureLines = (try? await service.getFutureLines(id: goalId)) ?? []
    }
}
