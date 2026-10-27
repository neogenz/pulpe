import SwiftUI

/// Lists the user's savings goals (PUL-12). Creating opens the form sheet from
/// here; a row now pushes the progression detail (PUL-8), which owns edit /
/// status / delete.
struct SavingsGoalsListView: View {
    /// The goal shown beside the list on the open iPhone Duo.
    var selectedGoalId: String?
    /// Set when a goal opens beside the list rather than on top of it.
    var onSelect: ((String) -> Void)?

    @Environment(SavingsGoalStore.self) private var store
    @Environment(UserSettingsStore.self) private var userSettingsStore

    @State private var isCreatingGoal = false

    // First-access intro (PUL-12): shown once, gated by `SavingsGoalsIntroGate`.
    @AppStorage(SavingsGoalsIntroGate.storageKey) private var hasSeenIntro = false
    @State private var showIntro = false
    @State private var pendingCreateAfterIntro = false

    var body: some View {
        Group {
            if store.isLoading && store.goals.isEmpty {
                SavingsGoalsListSkeletonView()
            } else if store.hasError, let error = store.error {
                ErrorView(error: error) { await store.forceRefresh() }
            } else if store.goals.isEmpty {
                emptyState
            } else {
                goalList
            }
        }
        .localizedNavigationTitle("Objectifs d'épargne")
        // A large title does not fit the narrow pane beside a goal.
        .navigationBarTitleDisplayMode(onSelect == nil ? .large : .inline)
        .pulpeBackground()
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button("Ajouter un objectif", systemImage: "plus") {
                    isCreatingGoal = true
                }
            }
        }
        .sheet(isPresented: $isCreatingGoal) {
            SavingsGoalFormSheet(
                goal: nil,
                userCurrency: userSettingsStore.currency,
                payDayOfMonth: userSettingsStore.payDayOfMonth,
                // Beside the list, the goal just created is the one to look at.
                onCreate: onSelect.map { select in { select($0.id) } }
            )
        }
        .fullScreenCover(
            isPresented: $showIntro,
            onDismiss: {
                // Present the create form only after the cover has fully dismissed:
                // presenting a sheet while the cover animates out drops it on iOS.
                if pendingCreateAfterIntro {
                    pendingCreateAfterIntro = false
                    isCreatingGoal = true
                }
            },
            content: {
                SavingsGoalsIntroCover(currency: userSettingsStore.currency) { createGoal in
                    hasSeenIntro = true
                    pendingCreateAfterIntro = createGoal
                    showIntro = false
                }
            }
        )
        .onAppear {
            if SavingsGoalsIntroGate.shouldPresentIntro(hasSeen: hasSeenIntro) {
                showIntro = true
            }
        }
        .task { await store.loadIfNeeded() }
        .trackScreen(AnalyticsScreen.savingsGoalsList)
    }

    // MARK: - Empty state

    private var emptyState: some View {
        PulpeEmptyState(
            systemImage: "target",
            title: AppLocale.string("Fixe ton premier objectif"),
            message: AppLocale.string("Suis tes projets d'épargne long terme, sans recalculer à la main"),
            actionTitle: AppLocale.string("Créer un objectif")
        ) {
            isCreatingGoal = true
        }
    }

    // MARK: - List

    private var goalList: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
                SectionHeader(title: AppLocale.string("Objectifs"), count: store.goals.count)

                if let onSelect {
                    // Beside the projection the rows sit bare on the canvas and the one shown
                    // lifts, as the budgets list does; a card would swallow the lifted tile.
                    goalRows { goal in
                        SavingsGoalRow(goal: goal, currency: userSettingsStore.currency, isBesideDetail: true)
                            .selectsBesidePane(isSelected: goal.id == selectedGoalId) { onSelect(goal.id) }
                    }
                } else {
                    goalRows { goal in
                        NavigationLink(value: SavingsGoalDestination.detail(goal)) {
                            SavingsGoalRow(goal: goal, currency: userSettingsStore.currency)
                        }
                        .buttonStyle(.plain)
                    }
                    .padding(.horizontal, DesignTokens.Spacing.lg)
                    .pulpeCard()
                }
            }
            .padding(DesignTokens.Spacing.lg)
        }
        .refreshable { await store.forceRefresh() }
        .accessibilityIdentifier("savingsGoalsListRoot")
    }

    private func goalRows(@ViewBuilder row: @escaping (SavingsGoal) -> some View) -> some View {
        VStack(spacing: 0) {
            ForEach(store.goals) { goal in
                if goal.id != store.goals.first?.id {
                    Divider().padding(.leading, DesignTokens.ListRow.dividerInset)
                }
                row(goal)
                    .accessibilityIdentifier("savingsGoalRow-\(goal.id)")
            }
        }
    }
}

// MARK: - Row

/// One ledger row (The One Ledger Rule): nature disc, name and period, then the target
/// amount — or the status chip when the status carries information.
private struct SavingsGoalRow: View {
    let goal: SavingsGoal
    let currency: SupportedCurrency
    /// Beside the projection the row only picks the goal: no chevron promising a push, and
    /// no target, which the page beside already leads with and the narrow pane cannot spare.
    var isBesideDetail = false

    var body: some View {
        HStack(alignment: .top, spacing: DesignTokens.Spacing.sm) {
            RowIcon(systemName: "target", tint: .financialSavings)

            VStack(alignment: .leading, spacing: DesignTokens.Spacing.xxs) {
                Text(goal.name)
                    .font(PulpeTypography.listRowTitle)
                    .foregroundStyle(Color.textPrimary)
                if let periodLabel {
                    Text(periodLabel)
                        .font(PulpeTypography.listRowSubtitle)
                        .foregroundStyle(Color.textSecondary)
                }
            }

            Spacer(minLength: DesignTokens.Spacing.sm)

            trailing

            if !isBesideDetail {
                Image(systemName: "chevron.right")
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(Color.textTertiary)
                    .accessibilityHidden(true)
            }
        }
        .padding(.vertical, DesignTokens.Spacing.md)
        .frame(maxWidth: .infinity, minHeight: DesignTokens.ListRow.minHeight, alignment: .leading)
        .contentShape(Rectangle())
    }

    @ViewBuilder
    private var trailing: some View {
        if goal.status != .active {
            SavingsGoalStatusBadge(status: goal.status)
        } else if !isBesideDetail, let targetAmount = goal.targetAmount {
            Text(targetAmount.asCurrency(currency))
                .font(PulpeTypography.listRowTitle)
                .monospacedDigit()
                .foregroundStyle(Color.textPrimary)
                // The name wraps first: an amount split over two lines misreads.
                .lineLimit(1)
                .layoutPriority(1)
                .sensitiveAmount()
        }
    }

    private var periodLabel: String? {
        if let start = goal.startDateValue, let end = goal.targetDateValue {
            return "\(start.abbreviatedDateFormatted)"
                + " → \(end.abbreviatedDateFormatted)"
        }
        if let date = goal.targetDateValue {
            return AppLocale.string("Échéance \(date.abbreviatedDateFormatted)")
        }
        if let date = goal.startDateValue {
            return AppLocale.string("Depuis \(date.abbreviatedDateFormatted)")
        }
        return nil
    }
}
