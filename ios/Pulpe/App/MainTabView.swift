import SwiftUI

struct MainTabView: View {
    @Environment(AppState.self) private var appState
    @Environment(CurrentMonthStore.self) private var monthStore
    @State private var showAddTransaction = false
    @State private var pendingBudgetId: String?

    private let tabBarHeight: CGFloat = 55

    var body: some View {
        @Bindable var state = appState

        Group {
            if #available(iOS 18.0, *) {
                tabViewModern(selectedTab: $state.selectedTab)
            } else {
                tabViewLegacy(selectedTab: $state.selectedTab)
            }
        }
        .sheet(isPresented: $showAddTransaction) {
            if let budgetId = pendingBudgetId {
                AddTransactionSheet(budgetId: budgetId) { transaction in
                    monthStore.addTransaction(transaction)
                }
            } else {
                unavailableView
            }
        }
    }

    // MARK: - iOS 18+ TabView (Modern)

    @available(iOS 18.0, *)
    @ViewBuilder
    private func tabViewModern(selectedTab: Binding<Tab>) -> some View {
        TabView(selection: selectedTab) {
            SwiftUI.Tab(value: Tab.currentMonth) {
                CurrentMonthTab()
                    .toolbarVisibility(.hidden, for: .tabBar)
            }

            SwiftUI.Tab(value: Tab.budgets) {
                BudgetsTab()
                    .toolbarVisibility(.hidden, for: .tabBar)
            }

            SwiftUI.Tab(value: Tab.templates) {
                TemplatesTab()
                    .toolbarVisibility(.hidden, for: .tabBar)
            }
        }
        .safeAreaInset(edge: .bottom, spacing: 0) {
            if #available(iOS 26.0, *) {
                tabBarWithButton(selectedTab: selectedTab)
                    .padding(.horizontal, DesignTokens.Spacing.lg)
            } else {
                tabBarWithButtonLegacy(selectedTab: selectedTab)
                    .padding(.horizontal, DesignTokens.Spacing.lg)
            }
        }
    }

    // MARK: - iOS 17 TabView (Legacy)

    @ViewBuilder
    private func tabViewLegacy(selectedTab: Binding<Tab>) -> some View {
        TabView(selection: selectedTab) {
            CurrentMonthTab()
                .tag(Tab.currentMonth)

            BudgetsTab()
                .tag(Tab.budgets)

            TemplatesTab()
                .tag(Tab.templates)
        }
        .tabViewStyle(.page(indexDisplayMode: .never))
        .safeAreaInset(edge: .bottom, spacing: 0) {
            tabBarWithButtonLegacy(selectedTab: selectedTab)
                .padding(.horizontal, DesignTokens.Spacing.lg)
        }
    }

    // MARK: - iOS 26+ Tab Bar

    @available(iOS 26.0, *)
    @ViewBuilder
    private func tabBarWithButton(selectedTab: Binding<Tab>) -> some View {
        GlassEffectContainer(spacing: 10) {
            HStack(spacing: 10) {
                GeometryReader { geometry in
                    CustomTabBar(size: geometry.size, barTint: .gray.opacity(0.3), activeTab: selectedTab) { tab in
                        VStack(spacing: 3) {
                            Image(systemName: tab.icon)
                                .font(.title3)
                            Text(tab.title)
                                .font(.system(size: 10))
                                .fontWeight(.medium)
                        }
                        .symbolVariant(.fill)
                        .foregroundStyle(selectedTab.wrappedValue == tab ? Color.pulpePrimary : .primary)
                        .frame(maxWidth: .infinity)
                    }
                    .glassEffect(.regular.interactive(), in: .capsule)
                }

                // Action button
                if monthStore.budget != nil {
                    Button {
                        pendingBudgetId = monthStore.budget?.id
                        showAddTransaction = true
                    } label: {
                        Image(systemName: "plus")
                            .font(.system(size: 22, weight: .medium))
                            .foregroundStyle(Color.pulpePrimary)
                    }
                    .frame(width: tabBarHeight, height: tabBarHeight)
                    .glassEffect(.regular.interactive(), in: .capsule)
                }
            }
        }
        .frame(height: tabBarHeight)
    }

    // MARK: - iOS < 26 Tab Bar (Legacy)

    @ViewBuilder
    private func tabBarWithButtonLegacy(selectedTab: Binding<Tab>) -> some View {
        HStack(spacing: 10) {
            // Tab items in a pill
            HStack(spacing: 0) {
                ForEach(Tab.allCases) { tab in
                    Button {
                        withAnimation(.smooth) {
                            selectedTab.wrappedValue = tab
                        }
                    } label: {
                        VStack(spacing: 3) {
                            Image(systemName: tab.icon)
                                .font(.title3)
                            Text(tab.title)
                                .font(.system(size: 10))
                                .fontWeight(.medium)
                        }
                        .symbolVariant(.fill)
                        .foregroundStyle(selectedTab.wrappedValue == tab ? Color.pulpePrimary : .primary)
                        .frame(maxWidth: .infinity)
                    }
                }
            }
            .frame(maxWidth: .infinity)
            .frame(height: tabBarHeight)
            .background(.ultraThinMaterial)
            .clipShape(Capsule())

            // Action button
            if monthStore.budget != nil {
                Button {
                    pendingBudgetId = monthStore.budget?.id
                    showAddTransaction = true
                } label: {
                    Image(systemName: "plus")
                        .font(.system(size: 22, weight: .medium))
                        .foregroundStyle(Color.pulpePrimary)
                }
                .frame(width: tabBarHeight, height: tabBarHeight)
                .background(.ultraThinMaterial)
                .clipShape(Capsule())
            }
        }
        .frame(height: tabBarHeight)
    }

    // MARK: - Unavailable View

    private var unavailableView: some View {
        VStack(spacing: 16) {
            Image(systemName: "calendar.badge.exclamationmark")
                .font(.largeTitle)
                .foregroundStyle(.secondary)
            Text("Budget non disponible")
                .font(.headline)
            Text("Le budget n'est plus accessible")
                .font(.subheadline)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .presentationDetents([.medium])
    }
}

// MARK: - Current Month Tab

struct CurrentMonthTab: View {
    var body: some View {
        NavigationStack {
            CurrentMonthView()
        }
    }
}

// MARK: - Budgets Tab

struct BudgetsTab: View {
    @Environment(AppState.self) private var appState

    var body: some View {
        @Bindable var state = appState

        NavigationStack(path: $state.budgetPath) {
            BudgetListView()
                .navigationDestination(for: BudgetDestination.self) { destination in
                    switch destination {
                    case .details(let budgetId):
                        BudgetDetailsView(budgetId: budgetId)
                    }
                }
        }
    }
}

// MARK: - Templates Tab

struct TemplatesTab: View {
    @Environment(AppState.self) private var appState

    var body: some View {
        @Bindable var state = appState

        NavigationStack(path: $state.templatePath) {
            TemplateListView()
                .navigationDestination(for: TemplateDestination.self) { destination in
                    switch destination {
                    case .details(let templateId):
                        TemplateDetailsView(templateId: templateId)
                    }
                }
        }
    }
}
