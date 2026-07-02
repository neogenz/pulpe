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
    @Environment(\.dismiss) private var dismiss

    @State private var viewModel: SavingsGoalDetailViewModel
    @State private var editTarget: SavingsGoal?

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
                    emptyGuidanceCard
                } else {
                    progressCard(progress: progress)
                    if let pace = progress.paceStatus {
                        paceChip(pace)
                    }
                }

                if progress.isOverdue {
                    overdueCard
                }
                if progress.suggestCompletion {
                    completionSuggestionCard
                }
                if currentGoal.status == .completed {
                    reopenCard
                }
            }
            .padding(.horizontal, DesignTokens.Spacing.lg)
            .padding(.vertical, DesignTokens.Spacing.lg)
        }
        .scrollContentBackground(.hidden)
        .refreshable { await viewModel.load() }
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

    // MARK: - Derived-state cards

    private var overdueCard: some View {
        infoCard(
            icon: "calendar",
            title: "Échéance dépassée",
            message: "Ton échéance est passée. Tu peux la repousser pour continuer à ton rythme."
        ) {
            Button("Repousser la date") {
                editTarget = currentGoal
            }
            .secondaryButtonStyle()
        }
    }

    private var completionSuggestionCard: some View {
        infoCard(
            icon: "checkmark.seal.fill",
            title: "Objectif atteint",
            message: "Tu as mis de côté l'équivalent de ta cible. On le marque comme terminé ?"
        ) {
            Button("Marquer terminé") {
                Task { await setStatus(.completed) }
            }
            .primaryButtonStyle(isEnabled: !viewModel.isMutatingStatus)
            .disabled(viewModel.isMutatingStatus)
        }
    }

    private var reopenCard: some View {
        infoCard(
            icon: "flag.checkered",
            title: "Objectif terminé",
            message: "Tu peux le ré-ouvrir si tu veux continuer à épargner dessus."
        ) {
            Button("Ré-ouvrir") {
                Task { await setStatus(.active) }
            }
            .secondaryButtonStyle()
            .disabled(viewModel.isMutatingStatus)
        }
    }

    private var emptyGuidanceCard: some View {
        infoCard(
            icon: "link",
            title: "Aucune prévision rattachée",
            message: "Tague une prévision Épargne depuis ton Mois Type pour suivre cet objectif ici.",
            action: { EmptyView() }
        )
    }

    @ViewBuilder
    private func infoCard(
        icon: String,
        title: String,
        message: String,
        @ViewBuilder action: () -> some View
    ) -> some View {
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

    // MARK: - Actions

    private func setStatus(_ status: SavingsGoalStatus) async {
        await viewModel.changeStatus(to: status, via: store)
        if let error = viewModel.error {
            toastManager.show(DomainErrorLocalizer.localize(error), type: .error)
        } else {
            toastManager.show(status == .completed ? "Objectif marqué terminé" : "Objectif ré-ouvert")
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
    private(set) var isLoading = false
    private(set) var isMutatingStatus = false
    private(set) var error: Error?

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
        await fetchProgress()
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
            await fetchProgress()
        } catch {
            self.error = error
        }
    }

    private func fetchProgress() async {
        error = nil
        do {
            progress = try await service.getProgress(id: goalId)
        } catch {
            self.error = error
        }
    }
}
