import SwiftUI

struct AddTransactionItem: Identifiable {
    let id: String
    var budgetId: String { id }
}

struct MainTabView: View {
    @Environment(AppState.self) private var appState
    @Environment(CurrentMonthStore.self) private var monthStore
    @State private var addTransactionBudgetId: AddTransactionItem?
    @State private var keyboardVisible = false
    @State private var pageRequestsHide = false
    @Namespace private var tabSelectionNamespace

    /// Vertical space the floating tab bar visually occupies above the system
    /// bottom safe area. Pushed pages read this via `\.tabBarClearance` because
    /// iOS 26 does not cascade `safeAreaInset` from a TabView through nested
    /// `NavigationStack` destinations — they must re-reserve the bar's
    /// height themselves. Collapses to 0 when the bar is hidden.
    private static let tabBarClearanceHeight: CGFloat =
        DesignTokens.FrameHeight.tabBar
        + DesignTokens.Spacing.md
        + DesignTokens.Spacing.xs

    var body: some View {
        @Bindable var state = appState
        let barHidden = keyboardVisible || pageRequestsHide
        let clearance: CGFloat = barHidden ? 0 : Self.tabBarClearanceHeight

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
        // Publish the floating-bar reservation through the environment so each
        // tab's `NavigationStack` can re-apply the canonical safe-area pattern
        // locally — see `clearsFloatingTabBar()` below. iOS 26 does not cascade
        // `safeAreaInset` / `safeAreaPadding` from this TabView through nested
        // `NavigationStack` destinations (verified WWDC25 + community 2026).
        .environment(\.tabBarClearance, clearance)
        .safeAreaInset(edge: .bottom, spacing: 0) {
            floatingTabBar(selectedTab: $state.selectedTab)
                .padding(.horizontal, DesignTokens.Spacing.lg)
                .padding(.bottom, DesignTokens.Spacing.xs)
                .opacity(barHidden ? 0 : 1)
                .frame(height: barHidden ? 0 : nil)
                .allowsHitTesting(!barHidden)
        }
        .animation(DesignTokens.Animation.quickEaseInOut, value: barHidden)
        .onPreferenceChange(HidesFloatingTabBarKey.self) { hide in
            pageRequestsHide = hide
        }
        .onChange(of: appState.selectedTab) { _, newTab in
            AnalyticsService.shared.capture(.tabSwitched, properties: ["tab": newTab.rawValue])
        }
        .onReceive(NotificationCenter.default.publisher(for: UIResponder.keyboardWillShowNotification)) { _ in
            keyboardVisible = true
        }
        .onReceive(NotificationCenter.default.publisher(for: UIResponder.keyboardWillHideNotification)) { _ in
            keyboardVisible = false
        }
        .sheet(item: $addTransactionBudgetId) { item in
            AddTransactionSheet(budgetId: item.budgetId) { transaction in
                monthStore.addTransaction(transaction)
            }
        }
    }

    // MARK: - Floating Tab Bar

    @ViewBuilder
    private func floatingTabBar(selectedTab: Binding<Tab>) -> some View {
        if #available(iOS 26.0, *) {
            iOS26TabBar(selectedTab: selectedTab)
        } else {
            legacyTabBar(selectedTab: selectedTab)
        }
    }

    @available(iOS 26.0, *)
    @ViewBuilder
    private func iOS26TabBar(selectedTab: Binding<Tab>) -> some View {
        GlassEffectContainer(spacing: DesignTokens.Spacing.compactGap) {
            HStack(spacing: DesignTokens.Spacing.compactGap) {
                tabSegment(selectedTab: selectedTab)
                    .glassEffect(.regular.interactive(), in: .capsule)
                actionFAB(selectedTab: selectedTab)
            }
        }
        .frame(height: DesignTokens.FrameHeight.tabBar)
        .animation(.smooth(duration: DesignTokens.Animation.quickSnap), value: selectedTab.wrappedValue)
    }

    @ViewBuilder
    private func legacyTabBar(selectedTab: Binding<Tab>) -> some View {
        HStack(spacing: DesignTokens.Spacing.compactGap) {
            tabSegment(selectedTab: selectedTab)
                .background(.ultraThinMaterial)
                .clipShape(Capsule())
            actionFAB(selectedTab: selectedTab)
        }
        .frame(height: DesignTokens.FrameHeight.tabBar)
        .animation(.smooth(duration: DesignTokens.Animation.quickSnap), value: selectedTab.wrappedValue)
    }

    @ViewBuilder
    private func tabSegment(selectedTab: Binding<Tab>) -> some View {
        HStack(spacing: DesignTokens.Spacing.none) {
            ForEach(Tab.allCases) { tab in
                Button {
                    withAnimation(.smooth(duration: DesignTokens.Animation.quickSnap)) {
                        selectedTab.wrappedValue = tab
                    }
                } label: {
                    let isSelected = selectedTab.wrappedValue == tab
                    VStack(spacing: DesignTokens.Spacing.dividerGap) {
                        tabBarIcon(for: tab, isSelected: isSelected)
                        Text(tab.title).font(PulpeTypography.tabLabel)
                    }
                    .foregroundStyle(isSelected ? Color.pulpePrimary : Color(.label))
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background {
                        if isSelected {
                            // Translucent neutral overlay (not a Pulpe surface
                            // token) — the segment pill must blend into the
                            // outer capsule's rounded edge. An opaque warm
                            // surface (e.g. surfaceContainerHigh) reveals the
                            // capsule-in-capsule clip artefact at the bar's
                            // rounded ends; the 30% gray hides it.
                            Color.gray.opacity(DesignTokens.Opacity.strong)
                                .clipShape(Capsule())
                                .matchedGeometryEffect(id: "selectedTabPill", in: tabSelectionNamespace)
                                .padding(.vertical, DesignTokens.Spacing.xs)
                        }
                    }
                    .contentShape(Rectangle())
                }
                .plainPressedButtonStyle()
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    @ViewBuilder
    private func actionFAB(selectedTab: Binding<Tab>) -> some View {
        if selectedTab.wrappedValue == .currentMonth, let budgetId = monthStore.budget?.id {
            Button {
                addTransactionBudgetId = AddTransactionItem(id: budgetId)
            } label: {
                Image(systemName: "plus")
                    .font(PulpeTypography.sectionIcon)
                    .foregroundStyle(actionFABForeground)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
            .frame(width: DesignTokens.FrameHeight.tabBar, height: DesignTokens.FrameHeight.tabBar)
            .contentShape(Circle())
            .modifier(ActionFABBackgroundModifier())
            .transition(.asymmetric(
                insertion: .scale(scale: 0.5).combined(with: .opacity),
                removal: .scale.combined(with: .opacity)
            ))
        }
    }

    private var actionFABForeground: Color {
        if #available(iOS 26.0, *) {
            return Color.textOnPrimary
        } else {
            return Color.pulpePrimary
        }
    }

    @ViewBuilder
    private func tabBarIcon(for tab: Tab, isSelected: Bool) -> some View {
        ZStack {
            Image(systemName: tab.icon).opacity(isSelected ? 0 : 1)
            Image(systemName: tab.icon).symbolVariant(.fill).opacity(isSelected ? 1 : 0)
        }
        .font(.title3)
    }
}

// MARK: - Action FAB Background

/// Liquid Glass tint on iOS 26+; pre-iOS 26 falls back to a solid pulpePrimary
/// capsule.
private struct ActionFABBackgroundModifier: ViewModifier {
    func body(content: Content) -> some View {
        if #available(iOS 26.0, *) {
            content.glassEffect(.regular.tint(Color.pulpePrimary).interactive(), in: .capsule)
        } else {
            content
                .background(.ultraThinMaterial)
                .clipShape(Capsule())
        }
    }
}

// MARK: - Floating-tab-bar clearance

/// Reserve a transparent inset at the bottom of the tab's `NavigationStack`
/// matching the floating tab bar's visual height. Applied here — INSIDE the
/// stack — because iOS 26 does not propagate `safeAreaInset` / `safeAreaPadding`
/// applied on a parent `TabView` through `NavigationStack` destinations. With
/// the inset on the stack itself, every pushed page (and its nested
/// ScrollViews / `safeAreaInset` CTAs) inherits the extension and renders
/// content cleanly above the floating bar.
private struct FloatingTabBarSafeAreaModifier: ViewModifier {
    @Environment(\.tabBarClearance) private var tabBarClearance

    func body(content: Content) -> some View {
        content.safeAreaInset(edge: .bottom, spacing: 0) {
            Color.clear.frame(height: tabBarClearance)
        }
    }
}

private extension View {
    func clearsFloatingTabBar() -> some View {
        modifier(FloatingTabBarSafeAreaModifier())
    }
}

// MARK: - Current Month Tab

struct CurrentMonthTab: View {
    var body: some View {
        NavigationStack {
            CurrentMonthView()
        }
        .clearsFloatingTabBar()
    }
}

// MARK: - Budgets Tab

struct BudgetsTab: View {
    @Environment(AppState.self) private var appState
    /// Tab-scoped router instance. Owns sheet state and provides the typed
    /// push API used inside the BudgetDetails feature; `appState.budgetPath`
    /// remains the underlying NavigationPath surface for cross-feature
    /// entries (deep link, BudgetList CTA, CurrentMonth CTA).
    @State private var router = BudgetDetailsRouter()

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
        .environment(router)
        .task { router.bind(to: appState) }
        .clearsFloatingTabBar()
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
        .clearsFloatingTabBar()
    }
}
