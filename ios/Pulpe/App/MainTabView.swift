import SwiftUI

struct AddTransactionItem: Identifiable {
    let id: String
    var budgetId: String { id }
}

struct MainTabView: View {
    @Environment(AppState.self) private var appState
    @Environment(CurrentMonthStore.self) private var monthStore
    @State private var addTransactionBudgetId: AddTransactionItem?

    private let tabBarHeight: CGFloat = 55

    var body: some View {
        @Bindable var state = appState

        TabView(selection: $state.selectedTab) {
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
        .contentMargins(.bottom, tabBarHeight + DesignTokens.Spacing.md, for: .scrollContent)
        .safeAreaInset(edge: .bottom, spacing: 0) {
            if #available(iOS 26.0, *) {
                customTabBarView(selectedTab: $state.selectedTab)
                    .padding(.horizontal, DesignTokens.Spacing.lg)
            } else {
                customTabBarViewLegacy(selectedTab: $state.selectedTab)
                    .padding(.horizontal, DesignTokens.Spacing.lg)
            }
        }
        .sheet(item: $addTransactionBudgetId) { item in
            AddTransactionSheet(budgetId: item.budgetId) { transaction in
                monthStore.addTransaction(transaction)
            }
        }
    }

    // MARK: - Custom Tab Bar (iOS 26+ with Glass Effect)

    @available(iOS 26.0, *)
    @ViewBuilder
    private func customTabBarView(selectedTab: Binding<Tab>) -> some View {
        GlassEffectContainer(spacing: 10) {
            HStack(spacing: 10) {
                GeometryReader { geometry in
                    CustomTabBar(size: geometry.size, barTint: .gray.opacity(0.3), activeTab: selectedTab)
                        .overlay {
                            HStack(spacing: 0) {
                                ForEach(Tab.allCases) { tab in
                                    VStack(spacing: 3) {
                                        Image(systemName: tab.icon)
                                            .font(.title3)

                                        Text(tab.title)
                                            .font(.system(size: 10))
                                            .fontWeight(.medium)
                                    }
                                    .symbolVariant(.fill)
                                    .foregroundStyle(selectedTab.wrappedValue == tab ? Color.pulpePrimary : Color(.label))
                                    .frame(maxWidth: .infinity)
                                }
                            }
                            .animation(.easeInOut(duration: 0.25), value: selectedTab.wrappedValue)
                        }
                        .glassEffect(.regular, in: .capsule)
                }

                // Action button (only visible on current month tab)
                if selectedTab.wrappedValue == .currentMonth, let budgetId = monthStore.budget?.id {
                    Button {
                        addTransactionBudgetId = AddTransactionItem(id: budgetId)
                    } label: {
                        Image(systemName: "plus")
                            .font(.system(size: 22, weight: .medium))
                            .foregroundStyle(Color.white)
                            .frame(maxWidth: .infinity, maxHeight: .infinity)
                    }
                    .frame(width: tabBarHeight, height: tabBarHeight)
                    .contentShape(Circle())
                    .glassEffect(.regular.tint(Color.pulpePrimary).interactive(), in: .capsule)
                    .transition(.scale.combined(with: .opacity))
                }
            }
        }
        .frame(height: tabBarHeight)
        .animation(.smooth(duration: 0.25), value: selectedTab.wrappedValue)
    }

    // MARK: - Custom Tab Bar (iOS 18-25 Legacy)

    @ViewBuilder
    private func customTabBarViewLegacy(selectedTab: Binding<Tab>) -> some View {
        HStack(spacing: 10) {
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

            // Action button (only visible on current month tab)
            if selectedTab.wrappedValue == .currentMonth, let budgetId = monthStore.budget?.id {
                Button {
                    addTransactionBudgetId = AddTransactionItem(id: budgetId)
                } label: {
                    Image(systemName: "plus")
                        .font(.system(size: 22, weight: .medium))
                        .foregroundStyle(Color.pulpePrimary)
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                }
                .frame(width: tabBarHeight, height: tabBarHeight)
                .contentShape(Circle())
                .background(.ultraThinMaterial)
                .clipShape(Capsule())
                .transition(.scale.combined(with: .opacity))
            }
        }
        .frame(height: tabBarHeight)
        .animation(.smooth(duration: 0.25), value: selectedTab.wrappedValue)
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
