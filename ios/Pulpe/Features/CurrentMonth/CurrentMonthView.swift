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
                        .font(PulpeTypography.emojiDisplay)
                        .foregroundStyle(Color.textTertiary)
                        .symbolEffect(.pulse, options: .nonRepeating)
                    Text("Pas encore de budget ce mois-ci")
                        .font(PulpeTypography.stepTitle)
                        .foregroundStyle(Color.textPrimary)
                    Text("Crée-le pour voir ton tableau de bord")
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
        .navigationTitle("")
        .navigationBarTitleDisplayMode(.inline)
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
        ZStack(alignment: .top) {
            // Emotion zone gradient — DA.md §3.1
            emotionZoneGradient

            ScrollView {
                VStack(spacing: DesignTokens.Spacing.xxl) {
                    // 1. Greeting + motivational headline
                    DashboardGreeting(
                        emotionState: store.metrics.emotionState,
                        firstName: appState.currentUser?.firstName
                    )
                        .staggeredEntrance(isVisible: hasAppeared, index: 0)

                    // 2. Hero card — primary metric
                    HeroBalanceCard(
                        metrics: store.metrics,
                        timeElapsedPercentage: timeElapsedPercentage,
                        onTapProgress: { activeSheet = .realizedBalance }
                    )
                    .staggeredEntrance(isVisible: hasAppeared, index: 1)

                    // 3. Unchecked forecasts — tap to check
                    uncheckedForecastsSection
                        .staggeredEntrance(isVisible: hasAppeared, index: 2)

                    // 4. Recent transactions
                    if !store.recentTransactions.isEmpty {
                        VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
                            HStack(spacing: DesignTokens.Spacing.sm) {
                                Text("Transactions récentes")
                                    .pulpeSectionHeader()
                                Text("\(store.recentTransactions.count)")
                                    .font(PulpeTypography.caption2)
                                    .fontWeight(.semibold)
                                    .foregroundStyle(Color.pulpePrimary)
                                    .padding(.horizontal, DesignTokens.Spacing.sm)
                                    .padding(.vertical, DesignTokens.Spacing.xs)
                                    .background(Color.pulpePrimary.opacity(0.12), in: Capsule())
                            }

                            RecentTransactionsCard(
                                transactions: store.recentTransactions,
                                onViewAll: { navigateToBudget = true }
                            )
                        }
                        .staggeredEntrance(isVisible: hasAppeared, index: 3)
                    }

                    // 5. Savings progress
                    if store.savingsSummary.hasSavings {
                        VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
                            Text("Épargne")
                                .pulpeSectionHeader()

                            SavingsSummaryCard(summary: store.savingsSummary)
                        }
                        .staggeredEntrance(isVisible: hasAppeared, index: 4)
                    }
                }
                .padding(.horizontal, DesignTokens.Spacing.lg)
                .padding(.vertical, DesignTokens.Spacing.lg)
            }
            .refreshable {
                await store.forceRefresh()
            }
        }
        .background { Color.appBackground.ignoresSafeArea() }
    }

    @ViewBuilder
    private var emotionZoneGradient: some View {
        let gradientColor: Color = switch store.metrics.emotionState {
        case .comfortable: .dashboardGradientComfortable
        case .tight: .dashboardGradientTight
        case .deficit: .dashboardGradientDeficit
        }

        LinearGradient(
            colors: [gradientColor, Color.appBackground],
            startPoint: .top,
            endPoint: .bottom
        )
        .containerRelativeFrame(.vertical) { height, _ in height * 0.4 }
        .ignoresSafeArea()
        .animation(.easeInOut(duration: 0.8), value: store.metrics.emotionState)
    }

    // MARK: - Unchecked Forecasts Section

    @ViewBuilder
    private var uncheckedForecastsSection: some View {
        if !store.uncheckedItems.isEmpty {
            VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
                HStack(spacing: DesignTokens.Spacing.sm) {
                    Text("À pointer")
                        .pulpeSectionHeader()
                    Text("\(store.uncheckedItems.count)")
                        .font(PulpeTypography.caption2)
                        .fontWeight(.semibold)
                        .foregroundStyle(Color.pulpePrimary)
                        .padding(.horizontal, DesignTokens.Spacing.sm)
                        .padding(.vertical, DesignTokens.Spacing.xs)
                        .background(Color.pulpePrimary.opacity(0.12), in: Capsule())
                }

                UncheckedForecastsCard(
                    items: store.uncheckedItems,
                    syncingBudgetLineIds: store.syncingBudgetLineIds,
                    syncingTransactionIds: store.syncingTransactionIds,
                    onToggle: { item in
                        Task {
                            switch item {
                            case .transaction(let tx, _):
                                await store.toggleTransaction(tx)
                            case .budgetLine(let line, _):
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
        ZStack(alignment: .top) {
            LinearGradient(
                colors: [Color.dashboardGradientComfortable, Color.appBackground],
                startPoint: .top,
                endPoint: .bottom
            )
            .containerRelativeFrame(.vertical) { height, _ in height * 0.4 }
            .ignoresSafeArea()

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
        }
        .background { Color.appBackground.ignoresSafeArea() }
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
