import SwiftUI

/// « Ajuster mon plan » (PUL-12+, pilier C) — the full-height simulation sheet.
///
/// A local sandbox: the compact trajectory chart + editable timeline deform live
/// (< 16 ms, all client-side — loi de Doherty) while the user drags the global
/// slider, types a per-month amount, or taps « Réajuster la suite ». Nothing is
/// written until the recap is confirmed; sheet dismiss = revert (free). Savings
/// green + neutrals only (RG-002). `docs/SAVINGS_PLAN.md` §2 pilier C.
struct GoalPlanSimulatorSheet: View {
    let goal: SavingsGoal
    let progress: SavingsGoalProgress
    let currency: SupportedCurrency
    /// Fired once the plan is written — the detail view invalidates caches, refetches
    /// progression and toasts « Ton plan est à jour ».
    let onApplied: () async -> Void

    @Environment(UserSettingsStore.self) private var userSettingsStore
    @Environment(ToastManager.self) private var toastManager
    @Environment(\.dismiss) private var dismiss

    @State private var viewModel: GoalPlanSimulatorViewModel
    @State private var showRecap = false
    @State private var showDiscardConfirm = false

    init(
        goal: SavingsGoal,
        progress: SavingsGoalProgress,
        currency: SupportedCurrency,
        onApplied: @escaping () async -> Void
    ) {
        self.goal = goal
        self.progress = progress
        self.currency = currency
        self.onApplied = onApplied
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

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: DesignTokens.Spacing.xl) {
                    infoBanner
                    GoalProjectionChart(series: viewModel.chartSeries, currency: currency, height: 160)
                    verdict
                    globalControl
                    redistributeButton
                    timeline
                }
                .padding(.horizontal, DesignTokens.Spacing.lg)
                .padding(.vertical, DesignTokens.Spacing.lg)
                .padding(.bottom, DesignTokens.Spacing.xxxl)
            }
            .scrollContentBackground(.hidden)
            .background(Color.sheetBackground)
            .navigationTitle("Ajuster mon plan")
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
        .task { viewModel.setPayDay(userSettingsStore.payDayOfMonth) }
        .sheet(isPresented: $showRecap) {
            GoalPlanApplyRecapSheet(
                changes: viewModel.planChanges,
                verdict: viewModel.verdictText,
                currency: currency,
                showTemplateToggle: viewModel.hasTemplateChanges,
                onConfirm: { updateTemplate in await viewModel.apply(updateTemplate: updateTemplate) }
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
            if let message { toastManager.show(message, type: .error) }
        }
    }

    // MARK: - Sections

    private var infoBanner: some View {
        HStack(spacing: DesignTokens.Spacing.md) {
            Image(systemName: "info.circle")
                .foregroundStyle(Color.pulpePrimary)
            Text("Rien n'est modifié tant que tu n'appliques pas")
                .font(PulpeTypography.subheadline)
                .foregroundStyle(Color.textSecondary)
                .fixedSize(horizontal: false, vertical: true)
            Spacer(minLength: 0)
        }
        .padding(DesignTokens.Spacing.md)
        .frame(maxWidth: .infinity, alignment: .leading)
        .pulpeCardBackground()
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
            HStack {
                Text("Chaque mois, je mets")
                    .font(PulpeTypography.inputLabel)
                    .foregroundStyle(Color.textSecondary)
                Spacer()
                TextField("", value: globalBinding, format: .number.precision(.fractionLength(0...2)))
                    .keyboardType(.decimalPad)
                    .multilineTextAlignment(.trailing)
                    .monospacedDigit()
                    .frame(width: 96)
                    .accessibilityLabel("Montant mensuel")
                Text(currency.symbol)
                    .font(PulpeTypography.metricLabel)
                    .foregroundStyle(Color.textSecondary)
            }

            Slider(value: globalBinding, in: 0...viewModel.sliderMax, step: 10)
                .tint(Color.pulpePrimary)
                .accessibilityLabel("Montant mensuel pour chaque mois ouvert")
                .accessibilityValue(Decimal(viewModel.sliderValue).asCurrency(currency))
        }
        .padding(DesignTokens.Spacing.lg)
        .pulpeCardBackground()
    }

    @ViewBuilder
    private var redistributeButton: some View {
        if viewModel.canRedistribute {
            Button {
                viewModel.redistribute()
            } label: {
                Label(
                    "Répartir ce qu'il reste — \(viewModel.redistributePerMonth.asCompactCurrency(currency))/mois",
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
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
            HStack {
                Text("Ton plan, mois par mois")
                    .font(PulpeTypography.headline)
                Spacer()
                Button("Repartir du plan actuel") { viewModel.revert() }
                    .textLinkButtonStyle()
                    .disabled(!viewModel.isDirty)
            }

            LazyVStack(spacing: 0) {
                ForEach(Array(viewModel.draft.months.enumerated()), id: \.element.id) { index, simMonth in
                    if index > 0 {
                        Divider().foregroundStyle(Color.textTertiary.opacity(DesignTokens.Opacity.secondary))
                    }
                    row(for: simMonth)
                }
            }
            .padding(DesignTokens.Spacing.lg)
            .pulpeCard()
        }
    }

    @ViewBuilder
    private func row(for simMonth: SavingsPlanCalculator.SimulatedMonth) -> some View {
        if SavingsPlanCalculator.isOpenPlanMonth(simMonth.month) {
            GoalPlanSimEditRow(
                simMonth: simMonth,
                currency: currency,
                amount: Binding(
                    get: { viewModel.simulatedAmount(forKey: simMonth.id) },
                    set: { viewModel.setMonth(key: simMonth.id, amount: $0) }
                )
            )
        } else {
            GoalPlanMonthRow(
                month: simMonth.month,
                amount: simMonth.simulatedAmount,
                cumulative: simMonth.simulatedCumulative,
                currency: currency
            )
        }
    }

    private var applyFooter: some View {
        Button {
            showRecap = true
        } label: {
            Text("Appliquer (\(viewModel.planChanges.count) mois)")
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
}

// MARK: - ViewModel

/// Sandbox for the plan simulator. Holds the immutable `baseline` (server months),
/// the user's `overrides` / `globalAmount`, and the live `draft` recomputed via
/// `SavingsPlanCalculator`. All figures are client-side; the server stays
/// authoritative at write time (`apply`).
@Observable @MainActor
final class GoalPlanSimulatorViewModel {
    private let goalId: String
    private let currency: SupportedCurrency
    private let baseline: [SavingsGoalPlanMonth]
    private let targetAmount: Decimal
    private let service: any SavingsGoalServicing

    /// Deadline period for the early/on-time verdict — refined once payDay lands.
    private var deadlineDate: Date
    private var deadlinePeriod: BudgetPeriod

    private(set) var overrides: [Int: Decimal] = [:]
    private(set) var globalAmount: Decimal?
    private(set) var sliderValue: Double = 0
    private(set) var draft: SavingsPlanCalculator.SimulationResult
    private(set) var isDirty = false
    private(set) var isApplying = false
    private(set) var didApplySucceed = false
    private(set) var applyErrorMessage: String?

    let sliderMax: Double

    init(
        goal: SavingsGoal,
        progress: SavingsGoalProgress,
        currency: SupportedCurrency,
        payDay: Int?,
        service: any SavingsGoalServicing = SavingsGoalService.shared
    ) {
        goalId = goal.id
        self.currency = currency
        self.service = service
        baseline = progress.months
        targetAmount = progress.targetAmount

        let resolvedDeadline = goal.targetDateValue ?? Date()
        deadlineDate = resolvedDeadline
        deadlinePeriod = BudgetPeriodCalculator.periodForDate(resolvedDeadline, payDayOfMonth: payDay)

        let openPlannedMax = progress.months
            .filter { SavingsPlanCalculator.isOpenPlanMonth($0) }
            .map(\.plannedAmount)
            .max() ?? 0
        let ceilingBase = max(progress.required ?? 0, progress.pace, openPlannedMax)
        let doubled = NSDecimalNumber(decimal: ceilingBase * 2).doubleValue
        sliderMax = max(100, (doubled / 100).rounded(.up) * 100)

        // Anchor: open pre-filled with `required` (the amount that holds the deadline).
        let redistribute = SavingsPlanCalculator.redistributeRemainingEffort(
            timeline: progress.months,
            targetAmount: progress.targetAmount
        )
        let anchor = progress.required ?? redistribute.perRemainingMonth
        globalAmount = anchor > 0 ? anchor : nil
        sliderValue = NSDecimalNumber(decimal: anchor).doubleValue

        draft = (try? SavingsPlanCalculator.simulate(
            timeline: progress.months,
            targetAmount: progress.targetAmount,
            globalMonthlyAmount: anchor > 0 ? anchor : nil
        )) ?? SavingsPlanCalculator.SimulationResult(
            months: [],
            simulatedFinal: 0,
            gapToTarget: progress.targetAmount,
            isTargetMet: false,
            attainedPeriod: nil
        )
    }

    // MARK: - Derived

    var chartSeries: GoalProjectionSeries {
        .simulation(from: draft, targetAmount: targetAmount)
    }

    /// The adjusted, open months — the write footprint and the recap rows.
    var planChanges: [SavingsPlanCalculator.SimulatedMonth] {
        draft.months.filter { SavingsPlanCalculator.isOpenPlanMonth($0.month) && $0.isAdjusted }
    }

    /// No template-horizon months are surfaced by the current contract, so the
    /// Mois Type leg is always empty (see the report note).
    var hasTemplateChanges: Bool { false }

    var canApply: Bool { !planChanges.isEmpty && !isApplying }

    private var redistributePreview: SavingsPlanCalculator.RedistributeResult {
        SavingsPlanCalculator.redistributeRemainingEffort(timeline: baseline, targetAmount: targetAmount)
    }

    var canRedistribute: Bool { redistributePreview.isDistributable }
    var redistributePerMonth: Decimal { redistributePreview.perRemainingMonth }

    var verdictText: String {
        guard let attained = draft.attainedPeriod else {
            return "Avec ce plan, il te manque \(draft.gapToTarget.asCompactCurrency(currency)) pour ta cible."
        }
        let label = "\(Formatters.monthName(for: attained.month)) \(attained.year)"
        if BudgetPeriodCalculator.comparePeriods(attained, deadlinePeriod) < 0 {
            return "Avec ce plan, tu atteins ta cible dès \(label), en avance."
        }
        return "Avec ce plan, tu atteins ta cible en \(label)."
    }

    func simulatedAmount(forKey key: Int) -> Decimal {
        draft.months.first { $0.id == key }?.simulatedAmount ?? 0
    }

    // MARK: - Mutations

    func setPayDay(_ payDay: Int?) {
        deadlinePeriod = BudgetPeriodCalculator.periodForDate(deadlineDate, payDayOfMonth: payDay)
    }

    /// Slider / twin field — sets a uniform amount and wipes per-month overrides.
    func setGlobalAmount(_ amount: Decimal) {
        let clamped = max(0, amount)
        globalAmount = clamped
        overrides = [:]
        sliderValue = min(NSDecimalNumber(decimal: clamped).doubleValue, sliderMax)
        isDirty = true
        recompute()
    }

    /// Per-month inline edit — overrides that month, keeps the rest.
    func setMonth(key: Int, amount: Decimal) {
        overrides[key] = max(0, amount)
        isDirty = true
        recompute()
    }

    /// « Réajuster la suite » — fills every open month with the redistributed share.
    func redistribute() {
        let result = redistributePreview
        guard result.isDistributable else { return }
        overrides = Dictionary(uniqueKeysWithValues: result.adjustments.map { adjustment in
            (adjustment.year * 12 + adjustment.month, adjustment.amount)
        })
        globalAmount = nil
        sliderValue = min(NSDecimalNumber(decimal: result.perRemainingMonth).doubleValue, sliderMax)
        isDirty = true
        recompute()
    }

    /// « Repartir du plan actuel » — clears every edit back to the current plan.
    func revert() {
        overrides = [:]
        globalAmount = nil
        isDirty = true
        recompute()
    }

    func apply(updateTemplate: Bool) async -> Bool {
        isApplying = true
        applyErrorMessage = nil
        defer { isApplying = false }

        let monthAdjustments = planChanges.flatMap { simMonth -> [SavingsGoalPlanApply.MonthAdjustment] in
            let lines = simMonth.month.lines.map {
                SavingsPlanCalculator.AllocatableLine(
                    budgetLineId: $0.budgetLineId,
                    amount: $0.amount,
                    checkedAt: $0.checkedAt
                )
            }
            return SavingsPlanCalculator.allocateMonthAmountToLines(lines, newMonthAmount: simMonth.simulatedAmount)
                .map { SavingsGoalPlanApply.MonthAdjustment(budgetLineId: $0.budgetLineId, amount: $0.amount) }
        }

        guard !monthAdjustments.isEmpty else { return false }

        let payload = SavingsGoalPlanApply(monthAdjustments: monthAdjustments, templateAdjustments: [])
        do {
            _ = try await service.applyPlan(id: goalId, payload)
            didApplySucceed = true
            return true
        } catch {
            applyErrorMessage = DomainErrorLocalizer.localize(error)
            return false
        }
    }

    // MARK: - Private

    private func recompute() {
        let byKey = Dictionary(uniqueKeysWithValues: baseline.map { ($0.id, $0) })
        let adjustments = overrides.compactMap { key, amount -> SavingsPlanCalculator.Adjustment? in
            guard let month = byKey[key] else { return nil }
            return .init(month: month.month, year: month.year, amount: amount)
        }
        if let next = try? SavingsPlanCalculator.simulate(
            timeline: baseline,
            targetAmount: targetAmount,
            adjustments: adjustments,
            globalMonthlyAmount: globalAmount
        ) {
            draft = next
        }
    }
}
