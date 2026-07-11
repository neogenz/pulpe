import SwiftUI

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
        .navigationBarTitleDisplayMode(.large)
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
            SavingsGoalFormSheet(goal: goal, userCurrency: currency)
        }
        .task { await viewModel.load() }
        .trackScreen("SavingsGoalDetail")
    }

    // MARK: - Content

    @ViewBuilder
    private func content(progress: SavingsGoalProgress) -> some View {
        ScrollView {
            VStack(alignment: .leading, spacing: DesignTokens.Spacing.xl) {
                header(progress: progress)

                if progress.linkedLineCount == 0 {
                    GoalEmptyGuidanceCard()
                } else {
                    progressCard(progress: progress)
                    if let pace = progress.paceStatus {
                        paceChip(pace)
                    }
                }

                GoalDerivedStateCards(
                    progress: progress,
                    status: currentGoal.status,
                    isMutatingStatus: viewModel.isMutatingStatus,
                    onEdit: { editTarget = currentGoal },
                    onComplete: { Task { await setStatus(.completed) } },
                    onReopen: { Task { await setStatus(.active) } }
                )

                if progress.linkedLineCount > 0, !progress.months.isEmpty {
                    GoalTrajectorySection(progress: progress, currency: currency)
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
        return progress.months.contains { SavingsPlanCalculator.isOpenPlanMonth($0) }
    }

    // MARK: - Header

    @ViewBuilder
    private func header(progress: SavingsGoalProgress) -> some View {
        HStack(spacing: DesignTokens.Spacing.sm) {
            PulpeChip(icon: statusIcon(currentGoal.status), label: currentGoal.status.label, style: .muted)

            if let date = progress.targetDateValue {
                Text("Échéance \(date.formatted(date: .abbreviated, time: .omitted))")
                    .font(PulpeTypography.listRowSubtitle)
                    .foregroundStyle(Color.textTertiary)
            }

            Spacer(minLength: 0)
        }
    }

    private func statusIcon(_ status: SavingsGoalStatus) -> String {
        switch status {
        case .active: "target"
        case .completed: "checkmark.circle.fill"
        case .paused: "pause.circle"
        }
    }

    // MARK: - Progress card (prévu / confirmé)

    private func progressCard(progress: SavingsGoalProgress) -> some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.md) {
            HStack(alignment: .firstTextBaseline) {
                Text(progress.confirmed.asCompactCurrency(currency))
                    .font(PulpeTypography.amountCard)
                    .foregroundStyle(Color.financialSavings)
                    .monospacedDigit()
                    .sensitiveAmount()

                Spacer()

                Text("sur \(progress.targetAmount.asCurrency(currency))")
                    .font(PulpeTypography.metricLabel)
                    .foregroundStyle(Color.textSecondary)
                    .monospacedDigit()
                    .sensitiveAmount()
            }

            layeredBar(progress: progress)

            VStack(spacing: DesignTokens.Spacing.sm) {
                statRow(
                    label: "Pointé",
                    value: progress.confirmed.asCompactCurrency(currency),
                    swatch: Color.financialSavings
                )
                statRow(
                    label: "Prévu cumulé",
                    value: progress.plannedCumulative.asCompactCurrency(currency),
                    swatch: Color.financialSavings.opacity(DesignTokens.Opacity.strong)
                )
                if let required = progress.required {
                    statRow(
                        label: "Pour tenir ton échéance",
                        value: "\(required.asCompactCurrency(currency)) / mois"
                    )
                }
                statRow(
                    label: "Projection à l'échéance",
                    value: progress.projected.asCompactCurrency(currency)
                )
            }
        }
        .pulpeCard()
    }

    private func layeredBar(progress: SavingsGoalProgress) -> some View {
        ZStack(alignment: .leading) {
            Capsule()
                .fill(Color.progressTrack)

            ProgressBarShape(progress: CGFloat(progress.plannedFraction))
                .fill(Color.financialSavings.opacity(DesignTokens.Opacity.strong))

            ProgressBarShape(progress: CGFloat(progress.confirmedFraction))
                .fill(Color.financialSavings)
                .animation(DesignTokens.Animation.gentleSpring, value: progress.confirmedFraction)
        }
        .frame(height: DesignTokens.ProgressBar.thickHeight)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(progress.achievementPercent)% de la cible pointé")
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

    // MARK: - Pace verdict

    private func paceChip(_ pace: SavingsGoalPaceStatus) -> some View {
        PulpeChip(icon: paceIcon(pace), label: paceLabel(pace), style: .muted)
            .accessibilityLabel("Rythme : \(paceLabel(pace))")
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
        } else {
            toastManager.show(status == .completed ? "Objectif marqué comme atteint" : "Objectif ré-ouvert")
        }
    }

    private func handleEditDismiss() {
        if store.goals.contains(where: { $0.id == goal.id }) {
            Task { await viewModel.load() }
        } else {
            // Goal was deleted from the edit form — pop back to the list.
            dismiss()
        }
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
}

private struct GoalContributionsSection: View {
    let contributions: [SavingsGoalContribution]
    let currency: SupportedCurrency
    let isLoading: Bool
    let error: Error?
    let onRetry: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.md) {
            Text("Ton suivi")
                .font(PulpeTypography.headline)
                .foregroundStyle(Color.textPrimary)

            if isLoading, contributions.isEmpty {
                ProgressView("Chargement du suivi…")
                    .frame(maxWidth: .infinity)
                    .padding(DesignTokens.Spacing.xl)
            } else if let error, contributions.isEmpty {
                GoalInfoCard(
                    icon: "arrow.clockwise",
                    title: "Suivi indisponible",
                    message: DomainErrorLocalizer.localize(error)
                ) {
                    Button("Réessayer", action: onRetry)
                        .secondaryButtonStyle()
                }
            } else {
                ForEach(contributions) { contribution in
                    contributionCard(contribution)
                }
            }
        }
    }

    private func contributionCard(_ contribution: SavingsGoalContribution) -> some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.md) {
            HStack(spacing: DesignTokens.Spacing.md) {
                Image(systemName: contribution.isChecked ? "checkmark.circle.fill" : "circle")
                    .font(PulpeTypography.actionIcon)
                    .foregroundStyle(contribution.isChecked ? Color.financialSavings : Color.textTertiary)
                    .accessibilityLabel(contribution.isChecked ? "Prévision pointée" : "Prévision à pointer")

                VStack(alignment: .leading, spacing: DesignTokens.Spacing.xxs) {
                    Text(contribution.name)
                        .font(PulpeTypography.listRowTitle)
                        .foregroundStyle(Color.textPrimary)
                        .lineLimit(2)
                    Text("\(Formatters.monthName(for: contribution.budgetMonth)) \(contribution.budgetYear)")
                        .font(PulpeTypography.listRowSubtitle)
                        .foregroundStyle(Color.textTertiary)
                }

                Spacer(minLength: DesignTokens.Spacing.sm)

                Text(contribution.amount.asCurrency(currency))
                    .font(PulpeTypography.amountCard)
                    .monospacedDigit()
                    .foregroundStyle(Color.textPrimary)
                    .sensitiveAmount()
            }

            if !contribution.transactions.isEmpty {
                VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
                    Text("Transactions réelles")
                        .font(PulpeTypography.metricLabel)
                        .foregroundStyle(Color.textSecondary)

                    ForEach(Array(contribution.transactions.enumerated()), id: \.element.id) { index, transaction in
                        if index > 0 { Divider() }
                        contributionTransactionRow(transaction)
                    }
                }
                .padding(DesignTokens.Spacing.md)
                .background(
                    Color.surfaceContainerHigh,
                    in: RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.sm)
                )
            }
        }
        .pulpeCard()
    }

    private func contributionTransactionRow(_ transaction: Transaction) -> some View {
        HStack(spacing: DesignTokens.Spacing.sm) {
            Image(systemName: transaction.isChecked ? "checkmark.circle.fill" : "circle")
                .foregroundStyle(transaction.isChecked ? Color.financialSavings : Color.textTertiary)
                .accessibilityLabel(transaction.isChecked ? "Transaction pointée" : "Transaction à pointer")

            VStack(alignment: .leading, spacing: DesignTokens.Spacing.xxs) {
                Text(transaction.name)
                    .font(PulpeTypography.listRowSubtitle)
                    .foregroundStyle(Color.textPrimary)
                    .lineLimit(2)
                Text(transaction.transactionDate.formatted(date: .abbreviated, time: .omitted))
                    .font(PulpeTypography.caption)
                    .foregroundStyle(Color.textTertiary)
            }

            Spacer(minLength: DesignTokens.Spacing.sm)

            Text(transaction.amount.asCurrency(currency))
                .font(PulpeTypography.metricLabelBold)
                .monospacedDigit()
                .foregroundStyle(Color.textPrimary)
                .sensitiveAmount()
        }
    }
}
