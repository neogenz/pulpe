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
        PulpeEmptyState(
            systemImage: "target",
            title: "Fixe ton premier objectif",
            message: "Suis tes projets d'épargne long terme, sans recalculer à la main",
            actionTitle: "Créer un objectif"
        ) {
            isCreatingGoal = true
        }
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

    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    var body: some View {
        Group {
            // Aux tailles d'accessibilité, le nom, le badge et le montant ne
            // tiennent plus côte à côte : la rangée passe en colonne au lieu
            // d'écraser le montant contre le bord de la carte.
            if dynamicTypeSize.isAccessibilitySize {
                VStack(alignment: .leading, spacing: DesignTokens.Spacing.md) {
                    infoColumn
                    amountText
                }
            } else {
                HStack(alignment: .center, spacing: DesignTokens.Spacing.md) {
                    infoColumn
                    Spacer()
                    amountText
                }
            }
        }
        .padding(DesignTokens.Spacing.lg)
        .frame(maxWidth: .infinity, alignment: .leading)
        .pulpeCard()
        .padding(.vertical, DesignTokens.Spacing.xs)
    }

    private var infoColumn: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.xs) {
            Text(goal.name)
                .font(PulpeTypography.listRowTitle)
                .foregroundStyle(Color.textPrimary)
            statusLine
        }
    }

    @ViewBuilder
    private var statusLine: some View {
        if dynamicTypeSize.isAccessibilitySize {
            VStack(alignment: .leading, spacing: DesignTokens.Spacing.xs) {
                SavingsGoalStatusBadge(status: goal.status)
                periodText
            }
        } else {
            HStack(spacing: DesignTokens.Spacing.sm) {
                SavingsGoalStatusBadge(status: goal.status)
                periodText
            }
        }
    }

    @ViewBuilder
    private var periodText: some View {
        if let periodLabel = periodLabel {
            Text(periodLabel)
                .font(PulpeTypography.listRowSubtitle)
                .foregroundStyle(Color.textTertiary)
        }
    }

    @ViewBuilder
    private var amountText: some View {
        if let targetAmount = goal.targetAmount {
            Text(targetAmount.asCurrency(currency))
                .font(PulpeTypography.amountCard)
                .monospacedDigit()
                .foregroundStyle(Color.textPrimary)
                .sensitiveAmount()
        }
    }

    private var periodLabel: String? {
        if let start = goal.startDateValue, let end = goal.targetDateValue {
            return "\(start.formatted(date: .abbreviated, time: .omitted))"
                + " → \(end.formatted(date: .abbreviated, time: .omitted))"
        }
        if let date = goal.targetDateValue {
            return "Échéance \(date.formatted(date: .abbreviated, time: .omitted))"
        }
        if let date = goal.startDateValue {
            return "Depuis \(date.formatted(date: .abbreviated, time: .omitted))"
        }
        return nil
    }
}
