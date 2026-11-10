import SwiftUI

/// « Historique » of a savings goal, pushed from its detail: the account that explains the
/// saved figure, then what moved month by month, newest first.
struct GoalHistoryView: View {
    let goal: SavingsGoal

    @Environment(AppState.self) private var appState
    @Environment(UserSettingsStore.self) private var userSettingsStore
    @Environment(SavingsGoalStore.self) private var store
    @State private var viewModel: SavingsGoalDetailViewModel

    init(goal: SavingsGoal, service: any SavingsGoalServicing = SavingsGoalService.shared) {
        self.goal = goal
        _viewModel = State(initialValue: SavingsGoalDetailViewModel(goalId: goal.id, service: service))
    }

    private var currency: SupportedCurrency { userSettingsStore.currency }

    var body: some View {
        Group {
            if let progress = viewModel.progress {
                content(GoalHistoryPresentation(
                    progress: progress,
                    withdrawals: viewModel.withdrawals,
                    payDayOfMonth: userSettingsStore.payDayOfMonth
                ))
            } else if let error = viewModel.error {
                ErrorView(error: error) { await viewModel.load() }
            } else {
                ProgressView()
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
        }
        .navigationTitle(AppLocale.string("Historique"))
        .navigationBarTitleDisplayMode(.inline)
        .toolbar(removing: .title)
        .background { Color.appBackground.ignoresSafeArea() }
        .task { await viewModel.load() }
        .onChange(of: store.budgetMutationVersion) {
            Task { await viewModel.load() }
        }
        .trackScreen("SavingsGoalHistory")
    }

    private func content(_ history: GoalHistoryPresentation) -> some View {
        ScrollView {
            VStack(alignment: .leading, spacing: DesignTokens.Spacing.none) {
                PageHeader(title: AppLocale.string("Historique"), subtitle: goal.name)
                    .padding(.top, DesignTokens.Spacing.sm)
                    .padding(.bottom, DesignTokens.Spacing.md)

                VStack(alignment: .leading, spacing: DesignTokens.Spacing.xxl) {
                    account(history)
                    ForEach(history.months) { month in
                        monthGroup(month)
                    }
                }
                .padding(.horizontal, DesignTokens.Spacing.lg)
                .padding(.bottom, DesignTokens.Spacing.lg)
            }
        }
        .scrollContentBackground(.hidden)
        .pulpeRootBottomInset()
        .refreshable { await viewModel.load() }
        .accessibilityIdentifier("savingsGoalHistoryRoot")
    }

    /// Départ + versé − retiré = mis de côté: the detail's figure, checked at a glance.
    private func account(_ history: GoalHistoryPresentation) -> some View {
        VStack(spacing: DesignTokens.Spacing.sm) {
            if history.initialAmount > 0 {
                accountLine(AppLocale.string("Départ"), history.initialAmount.asAmount(for: currency))
            }
            accountLine(
                history.pointedMonthCount == 1
                    ? AppLocale.string("Versé, 1 mois pointé")
                    : AppLocale.string("Versé, \(history.pointedMonthCount) mois pointés"),
                "+" + history.contributed.asAmount(for: currency)
            )
            if history.withdrawn > 0 {
                accountLine(AppLocale.string("Retiré"), (-history.withdrawn).asAmount(for: currency))
            }
            Divider().overlay(Color.outlineVariant)
            HStack(alignment: .firstTextBaseline) {
                Text("Mis de côté")
                    .font(PulpeTypography.subheadline.weight(.semibold))
                Spacer(minLength: DesignTokens.Spacing.sm)
                Text(history.saved.asCurrency(currency))
                    .font(PulpeTypography.totalAmount)
                    .monospacedDigit()
                    .sensitiveAmount()
            }
            .foregroundStyle(Color.textPrimary)
            .accessibilityElement(children: .combine)
        }
        .padding(DesignTokens.Spacing.lg)
        .pulpeSurfaceCard()
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("savingsGoalHistoryAccount")
    }

    private func accountLine(_ label: String, _ amount: String) -> some View {
        HStack(alignment: .firstTextBaseline) {
            Text(label)
                .foregroundStyle(Color.textSecondary)
            Spacer(minLength: DesignTokens.Spacing.sm)
            Text(amount)
                .foregroundStyle(Color.textPrimary)
                .monospacedDigit()
                .sensitiveAmount()
        }
        .font(PulpeTypography.subheadline)
        .accessibilityElement(children: .combine)
    }

    private func monthGroup(_ month: GoalHistoryPresentation.Month) -> some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.md) {
            SectionHeader(
                title: GoalHeroPresentation.monthYear(
                    month: month.period.month,
                    year: month.period.year,
                    capitalized: true
                ),
                trailingAmount: month.endBalance.map {
                    AppLocale.string("\($0.asAmount(for: currency)) à la fin du mois")
                }
            )
            VStack(spacing: DesignTokens.Spacing.none) {
                if let contribution = month.contribution {
                    contributionRow(contribution)
                }
                ForEach(month.withdrawals) { withdrawal in
                    Divider().overlay(Color.outlineVariant)
                    GoalRealizedWithdrawalRow(withdrawal: withdrawal, currency: currency) { budgetId in
                        appState.pushOnActiveStack(BudgetDestination.details(budgetId: budgetId))
                    }
                }
                if let initial = month.initialAmount {
                    if month.contribution != nil || !month.withdrawals.isEmpty {
                        Divider().overlay(Color.outlineVariant)
                    }
                    PulpeListRow(
                        title: AppLocale.string("Montant de départ"),
                        subtitle: AppLocale.string("Déjà de côté à la création"),
                        showsChevron: false
                    ) {
                        Text(initial.asAmount(for: currency))
                            .monospacedDigit()
                            .sensitiveAmount()
                    }
                    .accessibilityElement(children: .combine)
                }
            }
            .padding(.horizontal, DesignTokens.Spacing.lg)
            .pulpeSurfaceCard()
        }
    }

    /// The gauge says how much of the month's plan was met without a word to read: full is
    /// everything planned, the length tells the rest. The exact figure stays on the right.
    /// The circle reads « déjà pointé » and stays disabled: dépointer happens in the budget.
    private func contributionRow(_ contribution: GoalHistoryPresentation.Contribution) -> some View {
        HStack(spacing: DesignTokens.Spacing.md) {
            PointCircle(isPointed: true, isSyncing: false) {}
                .disabled(true)
                .opacity(DesignTokens.Opacity.disabled)
            VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
                Text("Versement")
                    .font(PulpeTypography.rowTitle)
                    .foregroundStyle(Color.textPrimary)
                GoalProgressTrack(fraction: contribution.fraction)
                    .frame(height: DesignTokens.ProgressBar.height)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            Text("+" + contribution.amount.asAmount(for: currency))
                .font(PulpeTypography.rowAmount)
                .foregroundStyle(Color.textPrimary)
                .monospacedDigit()
                .sensitiveAmount()
        }
        .padding(.vertical, DesignTokens.ListRow.verticalPadding + DesignTokens.Spacing.xxs)
        .frame(minHeight: DesignTokens.ListRow.minHeight)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(AppLocale.string(
            "Versement \(contribution.amount.asAmount(for: currency)), \(contribution.percent) du prévu"
        ))
    }
}
