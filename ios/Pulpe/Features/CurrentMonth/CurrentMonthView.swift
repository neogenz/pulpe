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
    @Environment(DashboardStore.self) private var dashboardStore
    @State private var activeSheet: SheetDestination?
    @State private var navigateToBudget = false
    
    // Progressive disclosure state (collapsed by default for cleaner dashboard)
    @AppStorage("dashboard.trendsExpanded") private var trendsExpanded = false
    @AppStorage("dashboard.yearOverviewExpanded") private var yearOverviewExpanded = false

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
            async let loadDetails: Void = store.loadDetailsIfNeeded()
            async let loadDashboard: Void = dashboardStore.loadIfNeeded()
            _ = await (loadDetails, loadDashboard)
        }
        .onChange(of: navigateToBudget) { _, shouldNavigate in
            if shouldNavigate, let budgetId = store.budget?.id {
                navigateToBudget = false
                // Clear path while Budgets tab is offscreen (user sees nothing)
                appState.budgetPath = NavigationPath()
                // Next run loop: old view is destroyed, push fresh + switch tab
                Task { @MainActor in
                    appState.budgetPath.append(BudgetDestination.details(budgetId: budgetId))
                    appState.selectedTab = .budgets
                }
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
                // Hero card with available balance and circular progress
                HeroBalanceCard(
                    metrics: store.metrics,
                    onTapProgress: { activeSheet = .realizedBalance }
                )

                // Forward-looking projection
                if let projection = store.projection {
                    VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
                        Text("Projection")
                            .pulpeSectionHeader()

                        ProjectionCard(projection: projection)
                    }
                }

                // Insights: top spending + budget alerts
                VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
                    Text("Aperçu")
                        .pulpeSectionHeader()

                    InsightsCard(
                        topSpending: store.topSpending,
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

                // Trends (expenses over last 3 months) - collapsible for progressive disclosure
                CollapsibleSection(title: "Dépenses", isExpanded: $trendsExpanded) {
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

                // Year overview (savings YTD + rollover) - collapsible for progressive disclosure
                CollapsibleSection(title: "Cette année", isExpanded: $yearOverviewExpanded) {
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
            async let refreshStore: Void = store.forceRefresh()
            async let refreshDashboard: Void = dashboardStore.forceRefresh()
            _ = await (refreshStore, refreshDashboard)
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
