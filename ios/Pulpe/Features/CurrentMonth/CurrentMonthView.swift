import SwiftUI
import WidgetKit

private enum SheetDestination: Identifiable {
    case addTransaction
    case realizedBalance
    case account

    var id: Self { self }
}

struct CurrentMonthView: View {
    @Environment(AppState.self) private var appState
    @Environment(CurrentMonthStore.self) private var store
    @Environment(UserSettingsStore.self) private var userSettingsStore
    @State private var activeSheet: SheetDestination?
    @State private var navigateToBudget = false
    @State private var hasAppeared = false
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    private var timeElapsedPercentage: Double {
        guard let budget = store.budget else { return 0 }
        return BudgetPeriodCalculator.timeElapsedPercentage(
            month: budget.month,
            year: budget.year,
            payDayOfMonth: userSettingsStore.payDayOfMonth
        )
    }

    var body: some View {
        ZStack {
            if store.isLoading && store.budget == nil {
                CurrentMonthSkeletonView()
                    .transition(.opacity)
            } else if let error = store.error, store.budget == nil {
                ErrorView(error: error) {
                    await store.forceRefresh()
                }
                .transition(.opacity)
            } else if store.budget == nil {
                VStack(spacing: DesignTokens.Spacing.lg) {
                    Image(systemName: "calendar.badge.plus")
                        .font(.system(size: 48))
                        .foregroundStyle(Color.pulpeTextTertiary)
                    Text("Pas encore de budget ce mois-ci")
                        .font(PulpeTypography.stepTitle)
                        .foregroundStyle(Color.textPrimary)
                    Text("Crée-le pour voir ton tableau de bord")
                        .font(PulpeTypography.bodyLarge)
                        .foregroundStyle(Color.pulpeTextTertiary)
                        .multilineTextAlignment(.center)
                }
                .padding(DesignTokens.Spacing.xxxl)
                .transition(.opacity)
            } else {
                dashboardContent
                    .transition(.opacity)
            }
        }
        .trackScreen("Dashboard")
        .animation(DesignTokens.Animation.smoothEaseOut, value: store.isLoading)
        .navigationTitle("Accueil")
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button {
                    activeSheet = .account
                } label: {
                    Image(systemName: "person.circle")
                }
                .accessibilityLabel("Mon compte")
            }
        }
        .sheet(item: $activeSheet) { sheet in
            switch sheet {
            case .addTransaction:
                if let budgetId = store.budget?.id {
                    AddTransactionSheet(budgetId: budgetId) { transaction in
                        store.addTransaction(transaction)
                    }
                }
            case .realizedBalance:
                RealizedBalanceSheet(
                    metrics: store.metrics,
                    realizedMetrics: store.realizedMetrics
                )
            case .account:
                AccountView()
            }
        }
        .task {
            await store.loadDetailsIfNeeded()
            if reduceMotion {
                hasAppeared = true
            } else {
                withAnimation(.easeOut(duration: DesignTokens.Animation.normal)) {
                    hasAppeared = true
                }
            }
        }
        .onChange(of: navigateToBudget) { _, shouldNavigate in
            if shouldNavigate, let budgetId = store.budget?.id {
                navigateToBudget = false
                // Clear path without animation while Budgets tab is offscreen
                var transaction = SwiftUI.Transaction()
                transaction.disablesAnimations = true
                withTransaction(transaction) {
                    appState.budgetPath = NavigationPath()
                }
                // Next run loop: old view is destroyed, push fresh + switch tab
                Task { @MainActor in
                    appState.budgetPath.append(BudgetDestination.details(budgetId: budgetId))
                    appState.selectedTab = .budgets
                }
            }
        }
        .onChange(of: appState.selectedTab) { oldTab, newTab in
            guard newTab == .currentMonth, oldTab != .currentMonth else { return }
            store.invalidateCache()
            Task {
                await store.loadDetailsIfNeeded()
            }
        }
        .onChange(of: activeSheet) { _, sheet in
            ProductTips.isSheetPresented = sheet != nil
        }
    }

    // MARK: - Dashboard Content

    private var dashboardContent: some View {
        ScrollView {
            VStack(spacing: DesignTokens.Spacing.xxl) {
                // 1. Hero card — primary metric
                HeroBalanceCard(
                    metrics: store.metrics,
                    timeElapsedPercentage: timeElapsedPercentage,
                    onTapProgress: { activeSheet = .realizedBalance }
                )
                .staggeredEntrance(isVisible: hasAppeared, index: 0)

                // 2. Unchecked forecasts — tap to check
                uncheckedForecastsSection
                    .staggeredEntrance(isVisible: hasAppeared, index: 1)

                // 3. Recent transactions
                if !store.recentTransactions.isEmpty {
                    VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
                        Text("Transactions récentes")
                            .pulpeSectionHeader()

                        RecentTransactionsCard(
                            transactions: store.recentTransactions,
                            onViewAll: { navigateToBudget = true }
                        )
                    }
                    .staggeredEntrance(isVisible: hasAppeared, index: 2)
                }

                // 4. Savings progress
                if store.savingsSummary.hasSavings {
                    VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
                        Text("Épargne")
                            .pulpeSectionHeader()

                        SavingsSummaryCard(summary: store.savingsSummary)
                    }
                    .staggeredEntrance(isVisible: hasAppeared, index: 3)
                }
            }
            .padding(.horizontal, DesignTokens.Spacing.lg)
            .padding(.vertical, DesignTokens.Spacing.lg)
        }
        .pulpeBackground()
        .refreshable {
            await store.forceRefresh()
        }
    }

    // MARK: - Unchecked Forecasts Section

    @ViewBuilder
    private var uncheckedForecastsSection: some View {
        if !store.uncheckedItems.isEmpty {
            VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
                Text("À pointer")
                    .pulpeSectionHeader()

                UncheckedForecastsCard(
                    items: store.uncheckedItems,
                    transactions: store.transactions,
                    syncingBudgetLineIds: store.syncingBudgetLineIds,
                    syncingTransactionIds: store.syncingTransactionIds,
                    onToggle: { item in
                        Task {
                            switch item {
                            case .transaction(let tx):
                                await store.toggleTransaction(tx)
                            case .budgetLine(let line):
                                await store.toggleBudgetLine(line)
                            }
                        }
                    },
                    onViewAll: { navigateToBudget = true }
                )
            }
        } else if !store.budgetLines.isEmpty || !store.transactions.isEmpty {
            UncheckedForecastsEmptyState()
        }
    }
}

// MARK: - Skeleton

private struct CurrentMonthSkeletonView: View {
    var body: some View {
        ScrollView {
            VStack(spacing: DesignTokens.Spacing.xxl) {
                // Hero card placeholder
                SkeletonShape(height: 200, cornerRadius: DesignTokens.CornerRadius.xl)

                // Unchecked forecasts section
                VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
                    SkeletonShape(width: 80, height: 14)
                    VStack(spacing: DesignTokens.Spacing.sm) {
                        ForEach(0..<3, id: \.self) { _ in
                            SkeletonRow()
                        }
                    }
                    .padding(DesignTokens.Spacing.lg)
                    .pulpeCardBackground()
                }
                .frame(maxWidth: .infinity, alignment: .leading)

                // Recent transactions section
                VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
                    SkeletonShape(width: 160, height: 14)
                    VStack(spacing: DesignTokens.Spacing.sm) {
                        ForEach(0..<3, id: \.self) { _ in
                            SkeletonRow()
                        }
                    }
                    .padding(DesignTokens.Spacing.lg)
                    .pulpeCardBackground()
                }
                .frame(maxWidth: .infinity, alignment: .leading)

                // Savings section
                VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
                    SkeletonShape(width: 70, height: 14)
                    SkeletonShape(height: 80, cornerRadius: DesignTokens.CornerRadius.lg)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .padding(.horizontal, DesignTokens.Spacing.lg)
            .padding(.vertical, DesignTokens.Spacing.lg)
        }
        .shimmering()
        .pulpeBackground()
        .accessibilityLabel("Préparation de ton tableau de bord")
    }
}

#Preview {
    NavigationStack {
        CurrentMonthView()
    }
    .environment(AppState())
    .environment(CurrentMonthStore())
    .environment(BudgetListStore())
    .environment(UserSettingsStore())
}
