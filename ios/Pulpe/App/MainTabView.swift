import SwiftUI

struct AddTransactionItem: Identifiable {
    let id: String
    var budgetId: String { id }
}

struct MainTabView: View {
    @Environment(AppState.self) private var appState
    @Environment(CurrentMonthStore.self) private var monthStore
    @State private var addTransactionBudgetId: AddTransactionItem?

    private let tabBarHeight = DesignTokens.FrameHeight.tabBar

    var body: some View {
        @Bindable var state = appState

        GeometryReader { geometry in
            let bottomInset = geometry.safeAreaInsets.bottom
            // Position capsule just above the home indicator, like a standard tab bar
            let tabBarBottom = bottomInset > 0 ? DesignTokens.Spacing.xl : DesignTokens.Spacing.xs
            let scrollMargin = tabBarBottom + tabBarHeight + DesignTokens.Spacing.md - bottomInset

            ZStack(alignment: .bottom) {
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
                .pulpeBackground()
                .contentMargins(.bottom, scrollMargin, for: .scrollContent)

                Group {
                    if #available(iOS 26.0, *) {
                        customTabBarView(selectedTab: $state.selectedTab)
                            .padding(.horizontal, DesignTokens.Spacing.lg)
                    } else {
                        customTabBarViewLegacy(selectedTab: $state.selectedTab)
                            .padding(.horizontal, DesignTokens.Spacing.lg)
                    }
                }
                .padding(.bottom, tabBarBottom)
            }
            .ignoresSafeArea(.container, edges: .bottom)
        }
        .onChange(of: appState.selectedTab) { _, newTab in
            AnalyticsService.shared.capture(.tabSwitched, properties: ["tab": newTab.rawValue])
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
                    let segmentInset = DesignTokens.Spacing.xs
                    CustomTabBar(
                        size: CGSize(
                            width: geometry.size.width - segmentInset * 2,
                            height: geometry.size.height - segmentInset * 2
                        ),
                        barTint: .gray.opacity(0.3),
                        activeTab: selectedTab
                    )
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .overlay { tabBarItems(selectedTab: selectedTab) }
                    .glassEffect(.regular.interactive(), in: .capsule)
                }

                tabBarActionButton(selectedTab: selectedTab)
            }
        }
        .frame(height: tabBarHeight)
        .animation(.smooth(duration: DesignTokens.Animation.quickSnap), value: selectedTab.wrappedValue)
    }

    @available(iOS 26.0, *)
    @ViewBuilder
    private func tabBarItems(selectedTab: Binding<Tab>) -> some View {
        HStack(spacing: 0) {
            ForEach(Tab.allCases) { tab in
                let isSelected = selectedTab.wrappedValue == tab
                VStack(spacing: 3) {
                    tabBarIcon(for: tab, isSelected: isSelected)
                    Text(tab.title).font(PulpeTypography.tabLabel)
                }
                .foregroundStyle(isSelected ? Color.pulpePrimary : Color(.label))
                .frame(maxWidth: .infinity)
            }
        }
        .animation(.easeInOut(duration: DesignTokens.Animation.quickSnap), value: selectedTab.wrappedValue)
    }

    @available(iOS 26.0, *)
    @ViewBuilder
    private func tabBarActionButton(selectedTab: Binding<Tab>) -> some View {
        if selectedTab.wrappedValue == .currentMonth, let budgetId = monthStore.budget?.id {
            Button {
                addTransactionBudgetId = AddTransactionItem(id: budgetId)
            } label: {
                Image(systemName: "plus")
                    .font(PulpeTypography.sectionIcon)
                    .foregroundStyle(Color.white)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
            .frame(width: tabBarHeight, height: tabBarHeight)
            .contentShape(Circle())
            .glassEffect(.regular.tint(Color.pulpePrimary).interactive(), in: .capsule)
            .transition(.scale.combined(with: .opacity))
        }
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
                        let isSelected = selectedTab.wrappedValue == tab

                        VStack(spacing: 3) {
                            tabBarIcon(for: tab, isSelected: isSelected)
                            Text(tab.title)
                                .font(PulpeTypography.tabLabel)
                        }
                        .foregroundStyle(isSelected ? Color.pulpePrimary : .primary)
                        .frame(maxWidth: .infinity)
                    }
                    .plainPressedButtonStyle()
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
                        .font(PulpeTypography.sectionIcon)
                        .foregroundStyle(Color.pulpePrimary)
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                }
                .plainPressedButtonStyle()
                .frame(width: tabBarHeight, height: tabBarHeight)
                .contentShape(Circle())
                .background(.ultraThinMaterial)
                .clipShape(Capsule())
                .transition(.scale.combined(with: .opacity))
            }
        }
        .frame(height: tabBarHeight)
        .animation(.smooth(duration: DesignTokens.Animation.quickSnap), value: selectedTab.wrappedValue)
    }

    // MARK: - Shared Helpers

    @ViewBuilder
    private func tabBarIcon(for tab: Tab, isSelected: Bool) -> some View {
        ZStack {
            Image(systemName: tab.icon).opacity(isSelected ? 0 : 1)
            Image(systemName: tab.icon).symbolVariant(.fill).opacity(isSelected ? 1 : 0)
        }
        .font(.title3)
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
