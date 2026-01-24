import SwiftUI

struct MainTabView: View {
    @Environment(AppState.self) private var appState
    @Environment(CurrentMonthStore.self) private var monthStore
    @State private var showAddTransaction = false
    @State private var pendingBudgetId: String?

    var body: some View {
        @Bindable var state = appState

        ZStack(alignment: .bottom) {
            TabView(selection: $state.selectedTab) {
                CurrentMonthTab()
                    .tabItem {
                        Label(Tab.currentMonth.title, systemImage: Tab.currentMonth.icon)
                    }
                    .tag(Tab.currentMonth)

                BudgetsTab()
                    .tabItem {
                        Label(Tab.budgets.title, systemImage: Tab.budgets.icon)
                    }
                    .tag(Tab.budgets)

                TemplatesTab()
                    .tabItem {
                        Label(Tab.templates.title, systemImage: Tab.templates.icon)
                    }
                    .tag(Tab.templates)
            }

            // Floating add transaction button (Liquid Glass style)
            if monthStore.budget != nil {
                HStack {
                    Spacer()
                    Button {
                        pendingBudgetId = monthStore.budget?.id
                        showAddTransaction = true
                    } label: {
                        floatingButtonLabel
                    }
                    .padding(.trailing, 16)
                    .padding(.bottom, 60)
                }
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

    @ViewBuilder
    private var floatingButtonLabel: some View {
        let icon = Image(systemName: "plus")
            .font(.title2.weight(.semibold))
            .foregroundStyle(Color.pulpePrimary)
            .frame(width: 48, height: 48)

        if #available(iOS 26.0, *) {
            icon.glassEffect(.regular.interactive())
        } else {
            icon
                .background(.ultraThinMaterial)
                .clipShape(Circle())
                .shadow(DesignTokens.Shadow.elevated)
        }
    }

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
