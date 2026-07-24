import SwiftUI

/// Lists the user's savings goals (PUL-12). Creating opens the form sheet from
/// here; a row now pushes the progression detail (PUL-8), which owns edit /
/// status / delete.
struct SavingsGoalsListView: View {
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
            SavingsGoalFormSheet(
                goal: nil,
                userCurrency: userSettingsStore.currency,
                payDayOfMonth: userSettingsStore.payDayOfMonth
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
                .accessibilityIdentifier("savingsGoalRow-\(goal.id)")
            }
        }
        .listStyle(.plain)
        .scrollContentBackground(.hidden)
        .refreshable { await store.forceRefresh() }
        .accessibilityIdentifier("savingsGoalsListRoot")
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
                .sensitiveAmount()
        }
        .padding(DesignTokens.Spacing.lg)
        .frame(maxWidth: .infinity, alignment: .leading)
        .pulpeCard()
        .padding(.vertical, DesignTokens.Spacing.xs)
    }
}
