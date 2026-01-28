import SwiftUI
import WidgetKit

struct CurrentMonthView: View {
    @Environment(AppState.self) private var appState
    @Environment(CurrentMonthStore.self) private var store
    @Environment(DashboardStore.self) private var dashboardStore
    @State private var showAddTransaction = false
    @State private var showRealizedBalanceSheet = false
    @State private var showAccount = false
    @State private var navigateToBudget = false

    var body: some View {
        ZStack {
            if store.isLoading && store.budget == nil {
                LoadingView(message: "Préparation de ton tableau de bord...")
            } else if let error = store.error, store.budget == nil {
                ErrorView(error: error) {
                    await store.forceRefresh()
                }
            } else if store.budget == nil {
                EmptyStateView(
                    title: "Crée ton premier budget pour voir ton dashboard",
                    description: "Ajoute un budget dans l'onglet Budgets",
                    systemImage: "chart.pie"
                )
            } else {
                dashboardContent
            }
        }
        .navigationTitle("Accueil")
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button {
                    showAccount = true
                } label: {
                    Image(systemName: "person.circle")
                }
                .accessibilityLabel("Mon compte")
            }
        }
        .sheet(isPresented: $showAddTransaction) {
            if let budgetId = store.budget?.id {
                AddTransactionSheet(budgetId: budgetId) { transaction in
                    store.addTransaction(transaction)
                }
            }
        }
        .sheet(isPresented: $showRealizedBalanceSheet) {
            RealizedBalanceSheet(
                metrics: store.metrics,
                realizedMetrics: store.realizedMetrics
            )
        }
        .sheet(isPresented: $showAccount) {
            AccountView()
        }
        .task {
            await store.loadDetailsIfNeeded()
            await dashboardStore.loadIfNeeded()
        }
        .onChange(of: navigateToBudget) { _, shouldNavigate in
            if shouldNavigate, let budgetId = store.budget?.id {
                // Navigate to budget details: switch tab + push destination
                appState.budgetPath.append(BudgetDestination.details(budgetId: budgetId))
                appState.selectedTab = .budgets
                navigateToBudget = false
            }
        }
        .onChange(of: showAddTransaction) { _, isPresented in
            ProductTips.isSheetPresented = isPresented
        }
        .onChange(of: showRealizedBalanceSheet) { _, isPresented in
            ProductTips.isSheetPresented = isPresented
        }
        .onChange(of: showAccount) { _, isPresented in
            ProductTips.isSheetPresented = isPresented
        }
    }

    // MARK: - Dashboard Content

    private var dashboardContent: some View {
        ScrollView {
            VStack(spacing: DesignTokens.Spacing.xxl) {
                // Hero card with available balance and circular progress
                HeroBalanceCard(
                    metrics: store.metrics,
                    daysRemaining: store.daysRemaining,
                    dailyBudget: store.dailyBudget,
                    onTapProgress: { showRealizedBalanceSheet = true }
                )

                // Insights: top spending + budget alerts
                VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
                    Text("Aperçu")
                        .pulpeSectionHeader()

                    InsightsCard(
                        topSpending: store.topSpendingCategory.map {
                            (name: $0.line.name, amount: $0.consumption.allocated, totalExpenses: store.metrics.totalExpenses)
                        },
                        alerts: store.alertBudgetLines,
                        onTap: { navigateToBudget = true }
                    )
                }

                // Recent transactions with external section header
                if !store.recentTransactions.isEmpty {
                    VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
                        Text("Transactions récentes")
                            .pulpeSectionHeader()

                        RecentTransactionsCard(
                            transactions: store.recentTransactions,
                            onViewAll: { navigateToBudget = true }
                        )
                    }
                }

                // Trends (expenses over last 3 months) with external section header
                VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
                    Text("Dépenses")
                        .pulpeSectionHeader()

                    if dashboardStore.hasEnoughHistoryForTrends {
                        TrendsCard(
                            expenses: dashboardStore.historicalExpenses,
                            variation: dashboardStore.expenseVariation,
                            currentMonthTotal: store.metrics.totalExpenses
                        )
                    } else {
                        TrendsEmptyState()
                    }
                }

                // Year overview (savings YTD + rollover)
                VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
                    Text("Cette année")
                        .pulpeSectionHeader()

                    YearOverviewCard(
                        savingsYTD: dashboardStore.savingsYTD,
                        rollover: store.budget?.rollover ?? 0
                    )
                }
            }
            .padding(.horizontal, DesignTokens.Spacing.lg)
            .padding(.vertical, DesignTokens.Spacing.lg)
        }
        .pulpeBackground()
        .refreshable {
            await store.forceRefresh()
            await dashboardStore.forceRefresh()
        }
    }
}

#Preview {
    NavigationStack {
        CurrentMonthView()
    }
    .environment(AppState())
    .environment(CurrentMonthStore())
    .environment(BudgetListStore())
    .environment(DashboardStore())
}
