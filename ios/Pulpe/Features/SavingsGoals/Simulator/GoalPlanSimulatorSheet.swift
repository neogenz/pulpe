import SwiftUI

/// « Ajuster mon plan » (PUL-12+, pilier C) — the full-height simulation sheet.
///
/// A local sandbox: the compact trajectory chart + editable timeline deform live
/// (< 16 ms, all client-side — loi de Doherty) while the user drags the global
/// slider, types a per-month amount, or taps « Réajuster la suite ». Nothing is
/// written until the recap is confirmed; sheet dismiss = revert (free). Savings
/// green + neutrals only (RG-002). `docs/SAVINGS.md` §10.1.
struct GoalPlanSimulatorSheet: View {
    let goal: SavingsGoal
    let progress: SavingsGoalProgress
    let currency: SupportedCurrency
    let plannedWithdrawals: [SavingsGoalPlannedWithdrawal]
    /// Invalidates caches and refreshes progression after a successful write.
    let onApplied: () async -> Void
    /// The parent dismisses this sheet before pushing the identified budget.
    let onOpenBudget: (String) -> Void
    /// Reloads the detail after the server rejects a stale simulation.
    let onPlanConflict: () async -> Void

    @Environment(UserSettingsStore.self) private var userSettingsStore
    @Environment(ToastManager.self) private var toastManager
    @Environment(\.dismiss) private var dismiss
    @Environment(BudgetListStore.self) var budgetListStore: BudgetListStore?

    @State var viewModel: GoalPlanSimulatorViewModel
    @State private var showRecap = false
    @State private var showDiscardConfirm = false
    @State var templateBalance: Decimal?

    init(
        goal: SavingsGoal,
        progress: SavingsGoalProgress,
        currency: SupportedCurrency,
        plannedWithdrawals: [SavingsGoalPlannedWithdrawal],
        onApplied: @escaping () async -> Void,
        onOpenBudget: @escaping (String) -> Void,
        onPlanConflict: @escaping () async -> Void
    ) {
        self.goal = goal
        self.progress = progress
        self.currency = currency
        self.plannedWithdrawals = plannedWithdrawals
        self.onApplied = onApplied
        self.onOpenBudget = onOpenBudget
        self.onPlanConflict = onPlanConflict
        _viewModel = State(initialValue: GoalPlanSimulatorViewModel(
            goal: goal,
            progress: progress,
            currency: currency,
            payDay: nil
        ))
    }

    private var globalBinding: Binding<Double> {
        Binding(
            get: { viewModel.sliderValue },
            set: { viewModel.setGlobalAmount(Decimal($0)) }
        )
    }

    private var globalAmountBinding: Binding<Decimal?> {
        Binding(
            get: { viewModel.globalAmount },
            set: { amount in
                if let amount { viewModel.setGlobalAmount(amount) }
            }
        )
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: DesignTokens.Spacing.xl) {
                    infoBanner
                    GoalProjectionChart(series: viewModel.chartSeries, currency: currency)
                    verdict
                    globalControl
                    impactCard
                    redistributeButton
                    timeline
                }
                .padding(.horizontal, DesignTokens.Spacing.lg)
                .padding(.vertical, DesignTokens.Spacing.lg)
                .padding(.bottom, DesignTokens.Spacing.xxxl)
            }
            .scrollContentBackground(.hidden)
            .accessibilityIdentifier("goalPlanSimulatorRoot")
            .background(Color.sheetBackground)
            .localizedNavigationTitle("Ajuster mon plan")
            .navigationBarTitleDisplayMode(.inline)
            .safeAreaInset(edge: .bottom) { applyFooter }
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Annuler") { requestDismiss() }
                }
            }
        }
        .standardSheetPresentation(detents: [.large])
        .sensoryFeedback(.selection, trigger: Int(viewModel.sliderValue / 10))
        .task {
            viewModel.setPayDay(userSettingsStore.payDayOfMonth)
            templateBalance = await GoalMonthAvailability.loadTemplateBalance()
        }
        .sheet(isPresented: $showRecap) {
            GoalPlanApplyRecapSheet(
                changes: viewModel.planChanges,
                verdict: viewModel.verdictText,
                currency: currency,
                goalName: goal.name,
                targetAmount: progress.targetAmount,
                onConfirm: { destinations in
                    let applied = await viewModel.apply(withdrawalDestinations: destinations)
                    if viewModel.didEncounterPlanConflict {
                        await closeAfterPlanConflict()
                    }
                    return applied
                }
            )
        }
        .confirmationDialog(
            "Abandonner tes ajustements ?",
            isPresented: $showDiscardConfirm,
            titleVisibility: .visible
        ) {
            Button("Abandonner", role: .destructive) { dismiss() }
            Button("Continuer l'édition", role: .cancel) {}
        }
        .onChange(of: viewModel.didApplySucceed) { _, applied in
            guard applied else { return }
            Task {
                showRecap = false
                await onApplied()
                dismiss()
            }
        }
        .onChange(of: viewModel.applyErrorMessage) { _, message in
            if let message, !viewModel.didEncounterPlanConflict {
                toastManager.show(message, type: .error)
            }
        }
    }

    private var infoBanner: some View {
        InfoBanner(
            .neutral,
            systemImage: "info.circle",
            text: AppLocale.string("Rien n'est modifié tant que tu n'appliques pas.")
        )
    }

    private var verdict: some View {
        Text(viewModel.verdictText)
            .font(PulpeTypography.listRowTitle)
            .foregroundStyle(Color.textPrimary)
            .fixedSize(horizontal: false, vertical: true)
            .accessibilityAddTraits(.updatesFrequently)
    }

    private var globalControl: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
            Text(globalAmountLabel)
                .font(PulpeTypography.metricLabel)
                .foregroundStyle(Color.textSecondary)
                .fixedSize(horizontal: false, vertical: true)

            HStack(alignment: .firstTextBaseline, spacing: DesignTokens.Spacing.xs) {
                TextField(
                    "Montants variables",
                    value: globalAmountBinding,
                    format: .number.precision(.fractionLength(2))
                )
                // Variable months leave the field empty: its placeholder reads as a label, not a figure.
                .font(viewModel.hasVariableMonthlyAmounts ? PulpeTypography.title3 : PulpeTypography.bigAmount)
                .keyboardType(.decimalPad)
                .monospacedDigit()
                .fixedSize()
                .frame(minHeight: DesignTokens.TapTarget.minimum)
                .accessibilityLabel("Montant mensuel")
                .sensitiveAmount()
                if !viewModel.hasVariableMonthlyAmounts {
                    Text(currency.symbol)
                        .font(PulpeTypography.bigCurrencySuffix)
                        .foregroundStyle(Color.textSecondary)
                }
            }

            Slider(value: globalBinding, in: 0...viewModel.sliderMax, step: 10)
                .tint(Color.pulpePrimary)
                .accessibilityLabel("Montant mensuel pour chaque mois ouvert")
                .accessibilityValue(
                    viewModel.hasVariableMonthlyAmounts
                        ? AppLocale.string("Montants variables")
                        : Decimal(viewModel.sliderValue).asAdaptiveCurrency(currency)
                )

            quickAmountChips
        }
    }

    @ViewBuilder
    private var redistributeButton: some View {
        if viewModel.canRedistribute {
            Button {
                viewModel.redistribute()
            } label: {
                Label(
                    "Répartir le reste : \(viewModel.redistributePerMonth.asAdaptiveCurrency(currency)) par mois",
                    systemImage: "arrow.triangle.branch"
                )
                .font(PulpeTypography.labelLarge)
                .frame(maxWidth: .infinity)
                .padding(.vertical, DesignTokens.Spacing.md)
                .background(Color.pulpePrimary.opacity(DesignTokens.Opacity.badgeBackground))
                .foregroundStyle(Color.pulpePrimary)
                .clipShape(.rect(cornerRadius: DesignTokens.CornerRadius.button))
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Réajuster la suite")
        }
    }

    private var timeline: some View {
        GoalPlanSimulatorTimeline(
            viewModel: viewModel,
            currency: currency,
            plannedWithdrawals: plannedWithdrawals,
            onOpenBudget: { budgetId in
                dismiss()
                onOpenBudget(budgetId)
            }
        )
    }

    private var applyFooter: some View {
        Button {
            showRecap = true
        } label: {
            // Le compte n'apparaît qu'une fois qu'il y a quelque chose à
            // compter : « Appliquer (0 mois) » sur un bouton éteint est du bruit.
            if viewModel.planChanges.isEmpty {
                Text("Appliquer")
            } else {
                Text("Appliquer · \(viewModel.planChanges.count) mois")
            }
        }
        .primaryButtonStyle(isEnabled: viewModel.canApply)
        .disabled(!viewModel.canApply)
        .padding(.horizontal, DesignTokens.Spacing.lg)
        .padding(.vertical, DesignTokens.Spacing.md)
        .background(.bar)
    }

    private func requestDismiss() {
        if viewModel.isDirty {
            showDiscardConfirm = true
        } else {
            dismiss()
        }
    }

    private func closeAfterPlanConflict() async {
        showRecap = false
        await Task.yield()
        dismiss()
        await onPlanConflict()
    }
}
