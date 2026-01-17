import SwiftUI
import WidgetKit

struct CurrentMonthView: View {
    @Environment(AppState.self) private var appState
    @Environment(CurrentMonthStore.self) private var store
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
                    title: "Pas encore de budget ce mois-ci",
                    description: "Crée ton budget dans l'onglet Budgets pour commencer",
                    systemImage: "calendar.badge.plus"
                )
            } else {
                dashboardContent
            }
        }
        .navigationTitle("Ce mois-ci")
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
            await store.loadIfNeeded()
        }
        .onChange(of: navigateToBudget) { _, shouldNavigate in
            if shouldNavigate, let budgetId = store.budget?.id {
                // Navigate to budget details: switch tab + push destination
                appState.budgetPath.append(BudgetDestination.details(budgetId: budgetId))
                appState.selectedTab = .budgets
                navigateToBudget = false
            }
        }
    }

    // MARK: - Dashboard Content

    private var dashboardContent: some View {
        List {
            // Hero balance card with daily insight
            Section {
                HeroBalanceCard(
                    metrics: store.metrics,
                    daysRemaining: store.daysRemaining,
                    dailyBudget: store.dailyBudget,
                    onTapProgress: { showRealizedBalanceSheet = true }
                )
            }
            .listRowInsets(EdgeInsets())
            .listRowBackground(Color.clear)

            // Quick actions bar
            Section {
                QuickActionsBar(
                    onAddTransaction: { showAddTransaction = true },
                    onShowStats: { showRealizedBalanceSheet = true },
                    onShowBudget: { navigateToBudget = true }
                )
            }
            .listRowInsets(EdgeInsets())
            .listRowBackground(Color.clear)

            // Alerts section (categories at 80%+)
            AlertsSection(
                alerts: store.alertBudgetLines,
                onTapViewBudget: { navigateToBudget = true }
            )

            // Recent transactions (read-only)
            RecentTransactionsSection(
                transactions: store.recentTransactions,
                onTapViewAll: { navigateToBudget = true }
            )

            // Unchecked transactions (not yet pointed)
            UncheckedTransactionsSection(
                transactions: store.uncheckedTransactions,
                onTapViewBudget: { navigateToBudget = true }
            )
        }
        .listStyle(.insetGrouped)
        .listSectionSpacing(16)
        .scrollContentBackground(.hidden)
        .background(Color(.systemGroupedBackground))
        .applyScrollEdgeEffect()
        .refreshable {
            await store.forceRefresh()
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
}
