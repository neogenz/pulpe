import SwiftUI

/// Navigation target for the savings goals, pushed onto `CurrentMonthTab`'s
/// stack: `.list` from the dashboard Épargne section, `.detail` from a list row.
enum SavingsGoalDestination: Hashable {
    case list
    case detail(SavingsGoal)
}

/// Lists the user's savings goals (PUL-12). Creating opens the form sheet from
/// here; a row now pushes the progression detail (PUL-8), which owns edit /
/// status / delete.
struct SavingsGoalsListView: View {
    @Environment(SavingsGoalStore.self) private var store
    @Environment(UserSettingsStore.self) private var userSettingsStore

    @State private var isCreatingGoal = false

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
                    isCreatingGoal = true
                } label: {
                    Image(systemName: "plus")
                }
                .accessibilityLabel("Ajouter un objectif")
            }
        }
        .sheet(isPresented: $isCreatingGoal) {
            SavingsGoalFormSheet(goal: nil, userCurrency: userSettingsStore.currency)
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
                isCreatingGoal = true
            }
            .primaryButtonStyle()
        }
        .padding(DesignTokens.Spacing.xxxl)
    }

    // MARK: - List

    private var goalList: some View {
        List {
            ForEach(store.goals) { goal in
                NavigationLink(value: SavingsGoalDestination.detail(goal)) {
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

    // Same muted PulpeChip as the detail header — one treatment per status
    // everywhere, neutral only (RG-002: savings is never an alert color).
    var body: some View {
        PulpeChip(label: status.label, style: .muted)
    }
}
