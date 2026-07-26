// swiftlint:disable file_length type_body_length
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
/// Renders the two server-computed layers — « Prévu » (`plannedCumulative`) and
/// « Pointé » (`confirmed`) — toward the target, plus the pace verdict and the
/// derived states D1 (échéance dépassée) / D2 (auto-complétion suggérée). Épargne
/// is never an alert, so every accent is savings/primary or neutral — never
/// amber/red (RG-002, `docs/SAVINGS.md` §7).
struct SavingsGoalDetailView: View {
    let goal: SavingsGoal

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
    @State private var showGenerationStop = false
    @State private var generationStopCandidates: [SavingsGoalFutureLine] = []
    @State private var generationStopContext: GoalGenerationStopContext?
    @State private var pendingEditUpdate: SavingsGoalUpdate?
    @State private var pendingDeadlineUpdate: SavingsGoalUpdate?
    @State private var reopenGenerationStop = false

    init(goal: SavingsGoal) {
        self.goal = goal
        _viewModel = State(initialValue: SavingsGoalDetailViewModel(goalId: goal.id))
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
        .trackScreen("SavingsGoalDetail")
    }

    // MARK: - Content

    @ViewBuilder
    private func content(progress: SavingsGoalProgress) -> some View {
        ScrollView {
            VStack(alignment: .leading, spacing: DesignTokens.Spacing.xl) {
                header(progress: progress)

                progressCard(progress: progress)
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

                if progress.linkedLineCount > 0, !progress.months.isEmpty {
                    // Construite une seule fois : la même série gate la section
                    // et alimente le chart (jusqu'à ~96 mois mappés par lecture).
                    let series = GoalProjectionSeries.read(from: progress)
                    if series.hasConfirmedTrend {
                        GoalTrajectorySection(progress: progress, series: series, currency: currency)
                    }
                    GoalPlanTimelineSection(
                        months: progress.months,
                        currency: currency,
                        canAdjust: canAdjust(progress),
                        onAdjust: { isSimulating = true }
                    )
                }

                contributionsSection(progress)
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

    /// Simulator entry (pilier C): active goal, at least one linked line, at least
    /// one open month. Hidden for PAUSED/COMPLETED (no rhythm verdict → no editing).
    private func canAdjust(_ progress: SavingsGoalProgress) -> Bool {
        guard currentGoal.status == .active, progress.linkedLineCount > 0 else { return false }
        return progress.months.contains { SavingsPlanCalculator.isContributivePlanMonth($0) }
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

    // MARK: - Progress card (prévu / confirmé)

    private func progressCard(progress: SavingsGoalProgress) -> some View {
        let hasClosedPlanMonth = SavingsGoalDetailViewModel.hasClosedPlanMonth(progress.months)
        return VStack(alignment: .leading, spacing: DesignTokens.Spacing.md) {
            HStack(alignment: .firstTextBaseline) {
                VStack(alignment: .leading, spacing: DesignTokens.Spacing.xxs) {
                    Text("Épargné")
                        .font(PulpeTypography.metricLabel)
                        .foregroundStyle(Color.textSecondary)
                    Text(progress.confirmed.asCompactCurrency(currency))
                        .font(PulpeTypography.amountCard)
                        .foregroundStyle(Color.financialSavings)
                        .monospacedDigit()
                        .sensitiveAmount()
                }

                Spacer()

                if let targetAmount = progress.targetAmount {
                    Text("sur \(targetAmount.asCurrency(currency))")
                        .font(PulpeTypography.metricLabel)
                        .foregroundStyle(Color.textSecondary)
                        .monospacedDigit()
                        .sensitiveAmount()
                }
            }

            if progress.targetAmount != nil {
                layeredBar(progress: progress)
            }

            if let pace = progress.paceStatus {
                if hasClosedPlanMonth {
                    paceIndicator(pace)
                } else if let amount = SavingsGoalDetailViewModel.currentMonthPlannedAmount(progress.months) {
                    planReadyIndicator(amount)
                }
            }

            progressStats(progress, hasClosedPlanMonth: hasClosedPlanMonth)
        }
        .pulpeCard()
    }

    @ViewBuilder
    private func progressStats(_ progress: SavingsGoalProgress, hasClosedPlanMonth: Bool) -> some View {
        VStack(spacing: DesignTokens.Spacing.sm) {
            if progress.initialAmount > 0 {
                statRow(label: "Montant de départ", value: progress.initialAmount.asCompactCurrency(currency))
            }
            statRow(
                label: "Déjà prévu",
                value: progress.plannedCumulative.asCompactCurrency(currency),
                swatch: Color.financialSavings.opacity(DesignTokens.Opacity.strong)
            )
            statRow(label: "Projection du plan", value: progress.plannedProjection.asCompactCurrency(currency))
            if let required = progress.required, hasClosedPlanMonth {
                if SavingsGoalDetailViewModel.requiredMatchesPlannedPace(
                    planned: progress.pace,
                    required: required
                ) {
                    statRow(
                        label: "Pour tenir ton échéance",
                        value: "\(required.asCompactCurrency(currency)) / mois"
                    )
                } else {
                    deadlineReconciliation(progress: progress, required: required)
                }
            }
        }
    }

    private func layeredBar(progress: SavingsGoalProgress) -> some View {
        let plannedFraction = progress.plannedFraction ?? 0
        let confirmedFraction = progress.confirmedFraction ?? 0
        return ZStack(alignment: .leading) {
            Capsule()
                .fill(Color.progressTrack)

            ProgressBarShape(progress: CGFloat(plannedFraction))
                .fill(Color.financialSavings.opacity(DesignTokens.Opacity.strong))

            ProgressBarShape(progress: CGFloat(confirmedFraction))
                .fill(Color.financialSavings)
                .animation(DesignTokens.Animation.gentleSpring, value: confirmedFraction)
        }
        .frame(height: DesignTokens.ProgressBar.thickHeight)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(progress.achievementPercent ?? 0)% de la cible épargné")
    }

    @ViewBuilder
    private func statRow(label: String, value: String, swatch: Color? = nil) -> some View {
        HStack(spacing: DesignTokens.Spacing.sm) {
            if let swatch {
                Circle()
                    .fill(swatch)
                    .frame(width: DesignTokens.Spacing.sm, height: DesignTokens.Spacing.sm)
            }
            Text(label)
                .font(PulpeTypography.metricLabel)
                .foregroundStyle(Color.textSecondary)

            Spacer(minLength: DesignTokens.Spacing.sm)

            Text(value)
                .font(PulpeTypography.metricLabelBold)
                .foregroundStyle(Color.textPrimary)
                .monospacedDigit()
                .sensitiveAmount()
        }
    }

    /// When the required pace drifts from the planned one, two bare numbers in
    /// separate rows read as a contradiction — one sentence relates them instead.
    private func deadlineReconciliation(progress: SavingsGoalProgress, required: Decimal) -> some View {
        let deadlinePart = progress.targetDateValue
            .map { "pour finir le \($0.formatted(date: .abbreviated, time: .omitted))" }
            ?? "pour tenir ton échéance"
        let plannedPart = "Ton rythme prévu : \(progress.pace.asCompactCurrency(currency))/mois"
        return Text(
            "\(plannedPart) · \(deadlinePart), vise \(required.asCompactCurrency(currency))/mois"
        )
        .font(PulpeTypography.metricLabel)
        .foregroundStyle(Color.textSecondary)
        .monospacedDigit()
        .fixedSize(horizontal: false, vertical: true)
        .frame(maxWidth: .infinity, alignment: .leading)
        .sensitiveAmount()
    }

    // MARK: - Pace verdict

    private func paceIndicator(_ pace: SavingsGoalPaceStatus) -> some View {
        Label(paceLabel(pace), systemImage: paceIcon(pace))
            .font(PulpeTypography.metricLabelBold)
            .foregroundStyle(Color.textSecondary)
            .accessibilityLabel("Rythme : \(paceLabel(pace))")
    }

    /// Jour-1 beat in the verdict slot: before any plan month has closed there
    /// is nothing to judge, so the verdict would read as a reproach at the
    /// moment of engagement. Whole label sensitive — the amount is inline.
    private func planReadyIndicator(_ amount: Decimal) -> some View {
        Label(
            "Ton plan est prêt — \(amount.asCurrency(currency)) à mettre de côté ce mois.",
            systemImage: "checkmark.circle"
        )
        .font(PulpeTypography.metricLabelBold)
        .foregroundStyle(Color.textSecondary)
        .sensitiveAmount()
    }

    /// Bienveillant, factuel — never anxiogène (behind reads as a gentle nudge).
    private func paceLabel(_ pace: SavingsGoalPaceStatus) -> String {
        switch pace {
        case .behind: "Un peu en retrait"
        case .onTrack: "Sur la bonne voie"
        case .ahead: "En avance"
        }
    }

    private func paceIcon(_ pace: SavingsGoalPaceStatus) -> String {
        switch pace {
        case .behind: "hourglass"
        case .onTrack: "checkmark.circle"
        case .ahead: "sparkles"
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
    private(set) var futureLines: [SavingsGoalFutureLine] = []
    private(set) var isLoading = true
    private(set) var isLoadingContributions = false
    private(set) var isMutatingStatus = false
    private(set) var error: Error?
    private(set) var contributionsError: Error?

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

    /// Initial / pull-to-refresh load. Shows the full-screen spinner while the
    /// first fetch is in flight (progress still nil).
    func load() async {
        isLoading = true
        defer { isLoading = false }
        async let progressLoad: Void = fetchProgress()
        async let contributionsLoad: Void = loadContributions()
        await progressLoad
        await contributionsLoad
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
