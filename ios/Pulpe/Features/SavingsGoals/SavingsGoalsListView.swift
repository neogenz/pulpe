import SwiftUI

/// Lists the user's savings goals (PUL-12). Creating opens the form sheet from
/// here; a row now pushes the progression detail (PUL-8), which owns edit /
/// status / delete.
struct SavingsGoalsListView: View {
    /// The goal shown beside the list on the open iPhone Duo.
    var selectedGoalId: String?
    /// Set when a goal opens beside the list rather than on top of it.
    var onSelect: ((String) -> Void)?

    @Environment(SavingsGoalStore.self) private var store
    @Environment(UserSettingsStore.self) private var userSettingsStore
    @Environment(CurrentMonthStore.self) private var currentMonthStore

    @State private var isCreatingGoal = false
    /// The « Pour commencer » preset the form opens with.
    @State private var presetName: String?

    // First-access intro (PUL-12): shown once, gated by `SavingsGoalsIntroGate`.
    @AppStorage(SavingsGoalsIntroGate.storageKey) private var hasSeenIntro = false
    @State private var showIntro = false
    @State private var pendingCreateAfterIntro = false

    var body: some View {
        Group {
            if store.isLoading && store.goals.isEmpty {
                SavingsGoalsListSkeletonView()
            } else if store.hasError, let error = store.error {
                ErrorView(error: error) { await store.forceRefresh() }
            } else if store.goals.isEmpty {
                emptyState
            } else {
                goalList
            }
        }
        .localizedNavigationTitle("Objectifs")
        .navigationBarTitleDisplayMode(.inline)
        // The page states its name in its own header.
        .toolbar(removing: .title)
        .pulpeBackground()
        .sheet(isPresented: $isCreatingGoal, onDismiss: clearPreset) {
            SavingsGoalFormSheet(
                goal: nil,
                userCurrency: userSettingsStore.currency,
                payDayOfMonth: userSettingsStore.payDayOfMonth,
                initialName: presetName,
                // Beside the list, the goal just created is the one to look at.
                onCreate: onSelect.map { select in { select($0.id) } }
            )
        }
        .fullScreenCover(
            isPresented: $showIntro,
            onDismiss: {
                // Present the create form only after the cover has fully dismissed:
                // presenting a sheet while the cover animates out drops it on iOS.
                if pendingCreateAfterIntro {
                    pendingCreateAfterIntro = false
                    isCreatingGoal = true
                }
            },
            content: {
                SavingsGoalsIntroCover(currency: userSettingsStore.currency) { createGoal in
                    hasSeenIntro = true
                    pendingCreateAfterIntro = createGoal
                    showIntro = false
                }
            }
        )
        .onAppear {
            if SavingsGoalsIntroGate.shouldPresentIntro(hasSeen: hasSeenIntro) {
                showIntro = true
            }
        }
        .task { await store.loadIfNeeded() }
        .task(id: store.goals) { await store.refreshProgress() }
        .onChange(of: store.budgetMutationVersion) {
            Task { await store.refreshProgress() }
        }
        .trackScreen(AnalyticsScreen.savingsGoalsList)
    }

    // MARK: - Empty state

    private var emptyState: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: DesignTokens.Spacing.xxl) {
                header
                EmptyStateCard(
                    systemImage: "target",
                    title: AppLocale.string("Fixe ton premier objectif"),
                    message: AppLocale.string("Suis tes projets d'épargne long terme, sans recalculer à la main."),
                    actionTitle: AppLocale.string("Créer un objectif")
                ) { createGoal() }
                .padding(.horizontal, DesignTokens.Spacing.lg)

                presets
            }
        }
        .pulpeRootBottomInset()
    }

    private var header: some View {
        PageHeader(
            title: AppLocale.string("Objectifs"),
            subtitle: AppLocale.string("Tes projets d'épargne, mois après mois")
        )
            .padding(.top, DesignTokens.Spacing.sm)
    }

    /// « Pour commencer »: three starting points; each opens the form with its name.
    private var presets: some View {
        let presets: [(name: String, hint: String)] = [
            (AppLocale.string("Coussin de sécurité"), AppLocale.string("Trois mois de charges, sans échéance")),
            (AppLocale.string("Voyage"), AppLocale.string("Un montant et une date de départ")),
            (AppLocale.string("Gros achat"), AppLocale.string("Voiture, canapé, ordinateur")),
        ]
        return VStack(alignment: .leading, spacing: DesignTokens.Spacing.md) {
            SectionHeader(title: AppLocale.string("Pour commencer"))
            VStack(spacing: DesignTokens.Spacing.none) {
                ForEach(Array(presets.enumerated()), id: \.offset) { index, preset in
                    if index > 0 { Divider().overlay(Color.outlineVariant) }
                    Button { createGoal(named: preset.name) } label: {
                        PulpeListRow(title: preset.name, subtitle: preset.hint) { EmptyView() }
                    }
                    .plainPressedButtonStyle()
                    .contentShape(Rectangle())
                }
            }
            .padding(.horizontal, DesignTokens.Spacing.lg)
            .pulpeSurfaceCard()
            Text("Je pré-remplis le nom, tu choisis le montant et la date.")
                .font(PulpeTypography.caption)
                .foregroundStyle(Color.textSecondary)
        }
        .padding(.horizontal, DesignTokens.Spacing.lg)
    }

    private func clearPreset() { presetName = nil }

    private func createGoal(named name: String? = nil) {
        presetName = name
        isCreatingGoal = true
    }

    // MARK: - List

    private var goalList: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: DesignTokens.Spacing.xxl) {
                if onSelect == nil {
                    header
                    SavingsGoalsTotalCard(
                        goals: store.goals,
                        progressById: store.progressById,
                        currentMonthLines: currentMonthStore.budgetLines,
                        currentMonth: currentMonthStore.budget?.month,
                        currency: userSettingsStore.currency
                    )
                    .padding(.horizontal, DesignTokens.Spacing.lg)
                }
                ForEach(SavingsGoalStatus.listOrder, id: \.self) { status in
                    let goals = store.goals.filter { $0.status == status }
                    if !goals.isEmpty {
                        VStack(alignment: .leading, spacing: DesignTokens.Spacing.md) {
                            SectionHeader(title: status.sectionTitle)
                            goalRows(goals)
                        }
                        .padding(.horizontal, DesignTokens.Spacing.lg)
                    }
                }
                Button { createGoal() } label: {
                    Label("Nouvel objectif", systemImage: "plus").frame(maxWidth: .infinity)
                }
                .secondaryButtonStyle()
                .accessibilityIdentifier("savingsGoalsAddButton")
                .padding(.horizontal, DesignTokens.Spacing.lg)
            }
            .padding(.vertical, DesignTokens.Spacing.sm)
        }
        .pulpeRootBottomInset()
        .refreshable { await store.forceRefresh() }
        .accessibilityIdentifier("savingsGoalsListRoot")
    }

    @ViewBuilder
    private func goalRows(_ goals: [SavingsGoal]) -> some View {
        let rows = VStack(spacing: DesignTokens.Spacing.none) {
            ForEach(goals) { goal in
                if goal.id != goals.first?.id { Divider().overlay(Color.outlineVariant) }
                row(goal).accessibilityIdentifier("savingsGoalRow-\(goal.id)")
            }
        }
        if onSelect != nil {
            // Beside the projection the rows sit bare on the canvas and the one shown
            // lifts, as the budgets list does; a card would swallow the lifted tile.
            rows
        } else {
            rows.padding(.horizontal, DesignTokens.Spacing.lg).pulpeSurfaceCard()
        }
    }

    @ViewBuilder
    private func row(_ goal: SavingsGoal) -> some View {
        let content = SavingsGoalRow(
            goal: goal,
            progress: store.progressById[goal.id],
            currency: userSettingsStore.currency,
            isBesideDetail: onSelect != nil
        )
        if let onSelect {
            content.selectsBesidePane(isSelected: goal.id == selectedGoalId) { onSelect(goal.id) }
        } else {
            NavigationLink(value: SavingsGoalDestination.detail(goal)) { content }
                .buttonStyle(.plain)
        }
    }
}
