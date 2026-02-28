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
    @Environment(UserSettingsStore.self) private var userSettingsStore
    @State private var activeSheet: SheetDestination?
    @State private var navigateToBudget = false
    @State private var hasAppeared = false
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    // Progressive disclosure state (collapsed by default for cleaner dashboard)
    @AppStorage("dashboard.trendsExpanded") private var trendsExpanded = false
    @AppStorage("dashboard.yearOverviewExpanded") private var yearOverviewExpanded = false

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
                        .foregroundStyle(Color.textTertiary)
                    Text("Pas de budget actif")
                        .font(PulpeTypography.stepTitle)
                        .foregroundStyle(Color.textPrimary)
                    Text("Créez un budget pour ce mois pour voir votre tableau de bord")
                        .font(PulpeTypography.bodyLarge)
                        .foregroundStyle(Color.textTertiary)
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
            dashboardStore.setPayDay(userSettingsStore.payDayOfMonth)
            async let loadDetails: Void = store.loadDetailsIfNeeded()
            async let loadDashboard: Void = dashboardStore.loadIfNeeded()
            _ = await (loadDetails, loadDashboard)
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
                // Clear path while Budgets tab is offscreen (user sees nothing)
                appState.budgetPath = NavigationPath()
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
            dashboardStore.invalidateCache()
            Task {
                async let storeLoad: Void = store.loadDetailsIfNeeded()
                async let dashLoad: Void = dashboardStore.loadIfNeeded()
                _ = await (storeLoad, dashLoad)
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
                    periodLabel: store.budget.flatMap { budget in
                        BudgetPeriodCalculator.formatPeriod(
                            month: budget.month,
                            year: budget.year,
                            payDayOfMonth: userSettingsStore.payDayOfMonth
                        )
                    },
                    onTapProgress: { activeSheet = .realizedBalance }
                )
                .opacity(hasAppeared ? 1 : 0)
                .animation(.easeOut(duration: DesignTokens.Animation.normal).delay(0.0), value: hasAppeared)

                // Forward-looking projection
                if let projection = store.projection {
                    VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
                        Text("Projection")
                            .pulpeSectionHeader()

                        ProjectionCard(projection: projection)
                    }
                    .opacity(hasAppeared ? 1 : 0)
                    .animation(.easeOut(duration: DesignTokens.Animation.normal).delay(0.05), value: hasAppeared)
                }

                // Insights: top spending + budget alerts
                VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
                    Text("Aperçu")
                        .pulpeSectionHeader()

                    InsightsCard(
                        topSpending: store.topSpending,
                        alerts: store.alertBudgetLines.map {
                            BudgetAlert(line: $0.line, consumption: $0.consumption)
                        },
                        onTap: { navigateToBudget = true }
                    )
                }
                .opacity(hasAppeared ? 1 : 0)
                .animation(.easeOut(duration: DesignTokens.Animation.normal).delay(0.1), value: hasAppeared)

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
                    .opacity(hasAppeared ? 1 : 0)
                    .animation(.easeOut(duration: DesignTokens.Animation.normal).delay(0.15), value: hasAppeared)
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
                .opacity(hasAppeared ? 1 : 0)
                .animation(.easeOut(duration: DesignTokens.Animation.normal).delay(0.2), value: hasAppeared)

                // Year overview (savings YTD + rollover) - collapsible for progressive disclosure
                CollapsibleSection(title: "Cette année", isExpanded: $yearOverviewExpanded) {
                    YearOverviewCard(
                        savingsYTD: dashboardStore.savingsYTD,
                        rollover: store.budget?.rollover ?? 0
                    )
                }
                .opacity(hasAppeared ? 1 : 0)
                .animation(.easeOut(duration: DesignTokens.Animation.normal).delay(0.25), value: hasAppeared)
            }
            .padding(.horizontal, DesignTokens.Spacing.lg)
            .padding(.vertical, DesignTokens.Spacing.lg)
        }
        .pulpeStatusBackground(emotionState: store.metrics.emotionState)
        .refreshable {
            async let refreshStore: Void = store.forceRefresh()
            async let refreshDashboard: Void = dashboardStore.forceRefresh()
            _ = await (refreshStore, refreshDashboard)
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

                // Projection section
                VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
                    SkeletonShape(width: 80, height: 14)
                    SkeletonShape(height: 80, cornerRadius: DesignTokens.CornerRadius.lg)
                }
                .frame(maxWidth: .infinity, alignment: .leading)

                // Insights section
                VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
                    SkeletonShape(width: 60, height: 14)
                    SkeletonShape(height: 120, cornerRadius: DesignTokens.CornerRadius.lg)
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
            }
            .padding(.horizontal, DesignTokens.Spacing.lg)
            .padding(.vertical, DesignTokens.Spacing.lg)
        }
        .shimmering()
        .pulpeBackground()
        .accessibilityLabel("Chargement du tableau de bord")
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
    .environment(UserSettingsStore())
}
