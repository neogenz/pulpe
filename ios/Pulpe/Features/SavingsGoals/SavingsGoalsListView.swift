import SwiftUI

/// Navigation target for the savings goals, pushed from the dashboard Épargne
/// section onto `CurrentMonthTab`'s stack.
enum SavingsGoalDestination: Hashable {
    case list
}

/// What the form sheet is editing — a new goal or an existing one.
private enum SavingsGoalFormTarget: Identifiable {
    case create
    case edit(SavingsGoal)

    var id: String {
        switch self {
        case .create: "create"
        case .edit(let goal): goal.id
        }
    }

    var goal: SavingsGoal? {
        switch self {
        case .create: nil
        case .edit(let goal): goal
        }
    }
}

/// Lists the user's savings goals with create / edit / status / delete entry
/// points (PUL-12). Progression (bars, rythme) is PUL-8 — not shown here.
struct SavingsGoalsListView: View {
    @Environment(SavingsGoalStore.self) private var store
    @Environment(UserSettingsStore.self) private var userSettingsStore

    @State private var formTarget: SavingsGoalFormTarget?

    var body: some View {
        Group {
            if store.isLoading && store.goals.isEmpty {
                ProgressView()
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if store.hasError, let error = store.error {
                ErrorView(error: error) { await store.forceRefresh() }
            } else if store.goals.isEmpty {
                emptyState
            } else {
                goalList
            }
        }
        .navigationTitle("Objectifs d'épargne")
        .navigationBarTitleDisplayMode(.large)
        .pulpeBackground()
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button {
                    formTarget = .create
                } label: {
                    Image(systemName: "plus")
                }
                .accessibilityLabel("Ajouter un objectif")
            }
        }
        .sheet(item: $formTarget) { target in
            SavingsGoalFormSheet(goal: target.goal, userCurrency: userSettingsStore.currency)
        }
        .task { await store.loadIfNeeded() }
        .trackScreen("SavingsGoalsList")
    }

    // MARK: - Empty state

    private var emptyState: some View {
        VStack(spacing: DesignTokens.Spacing.lg) {
            Image(systemName: "target")
                .font(PulpeTypography.emojiDisplay)
                .foregroundStyle(Color.textTertiary)
                .symbolEffect(.pulse, options: .nonRepeating)
            Text("Fixe ton premier objectif")
                .font(PulpeTypography.stepTitle)
                .foregroundStyle(Color.textPrimary)
            Text("Suis tes projets d'épargne long terme, sans recalculer à la main")
                .font(PulpeTypography.bodyLarge)
                .foregroundStyle(Color.textTertiary)
                .multilineTextAlignment(.center)
            Button("Créer un objectif") {
                formTarget = .create
            }
            .primaryButtonStyle()
        }
        .padding(DesignTokens.Spacing.xxxl)
    }

    // MARK: - List

    private var goalList: some View {
        List {
            ForEach(store.goals) { goal in
                Button {
                    formTarget = .edit(goal)
                } label: {
                    SavingsGoalRow(goal: goal, currency: userSettingsStore.currency)
                }
                .buttonStyle(.plain)
                .listRowBackground(Color.clear)
                .listRowSeparator(.hidden)
            }
        }
        .listStyle(.plain)
        .scrollContentBackground(.hidden)
        .refreshable { await store.forceRefresh() }
    }
}

// MARK: - Row

private struct SavingsGoalRow: View {
    let goal: SavingsGoal
    let currency: SupportedCurrency

    var body: some View {
        HStack(alignment: .center, spacing: DesignTokens.Spacing.md) {
            VStack(alignment: .leading, spacing: DesignTokens.Spacing.xs) {
                Text(goal.name)
                    .font(PulpeTypography.listRowTitle)
                    .foregroundStyle(Color.textPrimary)
                HStack(spacing: DesignTokens.Spacing.sm) {
                    SavingsGoalStatusBadge(status: goal.status)
                    if let date = goal.targetDateValue {
                        Text("Échéance \(date.formatted(date: .abbreviated, time: .omitted))")
                            .font(PulpeTypography.listRowSubtitle)
                            .foregroundStyle(Color.textTertiary)
                    }
                }
            }
            Spacer()
            Text(goal.targetAmount.asCurrency(currency))
                .font(PulpeTypography.amountCard)
                .monospacedDigit()
                .foregroundStyle(Color.textPrimary)
        }
        .padding(DesignTokens.Spacing.lg)
        .frame(maxWidth: .infinity, alignment: .leading)
        .pulpeCard()
        .padding(.vertical, DesignTokens.Spacing.xs)
    }
}

// MARK: - Status badge

private struct SavingsGoalStatusBadge: View {
    let status: SavingsGoalStatus

    var body: some View {
        Text(status.label)
            .font(PulpeTypography.metricMini)
            .foregroundStyle(color)
            .padding(.horizontal, DesignTokens.Spacing.sm)
            .padding(.vertical, DesignTokens.Spacing.xxs)
            .background(color.opacity(DesignTokens.Opacity.badgeBackground), in: Capsule())
    }

    /// Neutral / primary only — savings is never an alert color (RG-002).
    private var color: Color {
        switch status {
        case .active: Color.pulpePrimary
        case .completed: TransactionKind.saving.color
        case .paused: Color.textTertiary
        }
    }
}
