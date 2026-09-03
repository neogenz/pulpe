import SwiftUI

struct PlanBudgetsView: View {
    let onSuccess: (BudgetGenerateResponse) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var viewModel: PlanBudgetsViewModel
    @State private var activePicker: PeriodPicker?

    private enum PeriodPicker: Identifiable, Equatable {
        case start
        case end

        var id: Self { self }
    }

    init(payDayOfMonth: Int?, onSuccess: @escaping (BudgetGenerateResponse) -> Void) {
        self.init(viewModel: PlanBudgetsViewModel(payDayOfMonth: payDayOfMonth), onSuccess: onSuccess)
    }

    init(viewModel: PlanBudgetsViewModel, onSuccess: @escaping (BudgetGenerateResponse) -> Void) {
        self.onSuccess = onSuccess
        self._viewModel = State(initialValue: viewModel)
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: DesignTokens.Spacing.xxl) {
                    periodSection
                    templateSection

                    Text("Les budgets existants ne seront pas modifiés.")
                        .font(PulpeTypography.caption)
                        .foregroundStyle(Color.textSecondary)

                    if let error = viewModel.error {
                        ErrorBanner(message: DomainErrorLocalizer.localize(error)) {
                            viewModel.error = nil
                        }
                    }
                }
                .padding(.horizontal, DesignTokens.Spacing.xl)
                .padding(.vertical, DesignTokens.Spacing.lg)
            }
            .scrollIndicators(.hidden)
            .background(Color.sheetBackground)
            .localizedNavigationTitle("Planifier des budgets")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    SheetCloseButton()
                        .disabled(viewModel.isGenerating)
                        .accessibilityIdentifier("planBudgetsClose")
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Planifier") {
                        Task { await generate() }
                    }
                    .fontWeight(.semibold)
                    .disabled(!viewModel.canGenerate)
                    .accessibilityIdentifier("planBudgetsSubmit")
                }
            }
            .loadingOverlay(viewModel.isGenerating, message: AppLocale.string("Planification..."))
            .task { await viewModel.loadTemplates() }
        }
        .standardSheetPresentation()
        .interactiveDismissDisabled(viewModel.isGenerating)
        .sheet(item: $activePicker) { picker in
            MonthYearPickerSheet(
                title: picker == .start ? AppLocale.string("Premier mois") : AppLocale.string("Dernier mois"),
                initial: picker == .start ? viewModel.start : viewModel.end,
                yearRange: viewModel.yearRange
            ) { period in
                if picker == .start {
                    viewModel.start = period
                } else {
                    viewModel.end = period
                }
            }
        }
    }

    private var periodSection: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.md) {
            Text("Période")
                .font(PulpeTypography.buttonPrimary)

            HStack(spacing: DesignTokens.Spacing.md) {
                periodButton(label: AppLocale.string("De"), period: viewModel.start) {
                    activePicker = .start
                }
                periodButton(label: AppLocale.string("À"), period: viewModel.end) {
                    activePicker = .end
                }
            }

            Text(AppLocale.string("\(viewModel.inclusiveCount) périodes"))
                .font(PulpeTypography.caption)
                .foregroundStyle(Color.textSecondary)

            if let message = viewModel.validationMessage {
                ErrorBanner(message: message)
            }
        }
    }

    private var templateSection: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.md) {
            Text("Choisir un modèle")
                .font(PulpeTypography.buttonPrimary)

            if viewModel.isLoadingTemplates {
                ProgressView("Chargement des modèles...")
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, DesignTokens.Spacing.xl)
            } else if viewModel.templates.isEmpty {
                Text("Aucun modèle disponible")
                    .font(PulpeTypography.subheadline)
                    .foregroundStyle(Color.textSecondary)
            } else {
                VStack(spacing: DesignTokens.Spacing.sm) {
                    ForEach(viewModel.templates) { template in
                        TemplateSelectionCard(
                            template: template,
                            totals: nil,
                            isSelected: viewModel.selectedTemplateId == template.id
                        ) {
                            viewModel.selectedTemplateId = template.id
                        }
                    }
                }
            }
        }
    }

    private func periodButton(label: String, period: BudgetPeriod, action: @escaping () -> Void) -> some View {
        let value = period.formatted
        return Button(action: action) {
            VStack(alignment: .leading, spacing: DesignTokens.Spacing.xxs) {
                Text(label)
                    .font(PulpeTypography.caption)
                    .foregroundStyle(Color.onSurfaceVariant)
                HStack {
                    Text(value)
                        .font(PulpeTypography.subheadline)
                        .foregroundStyle(Color.textPrimary)
                    Spacer(minLength: 0)
                    Image(systemName: "chevron.up.chevron.down")
                        .font(PulpeTypography.metricMini)
                        .foregroundStyle(Color.textTertiary)
                }
            }
            .padding(.horizontal, DesignTokens.Spacing.lg)
            .padding(.vertical, DesignTokens.Spacing.md)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Color.surfaceContainerHigh, in: .rect(cornerRadius: DesignTokens.CornerRadius.button))
        }
        .frame(minHeight: DesignTokens.TapTarget.minimum)
        .contentShape(.rect(cornerRadius: DesignTokens.CornerRadius.button))
        .plainPressedButtonStyle()
        .accessibilityLabel("\(label) : \(value)")
    }

    private func generate() async {
        guard let response = await viewModel.generate() else { return }
        dismiss()
        onSuccess(response)
    }
}

@Observable @MainActor
final class PlanBudgetsViewModel {
    static let maximumCount = 36

    var start: BudgetPeriod
    var end: BudgetPeriod
    var selectedTemplateId: String?
    var error: Error?

    private(set) var templates: [BudgetTemplate] = []
    private(set) var isLoadingTemplates = false
    private(set) var isGenerating = false

    let yearRange: ClosedRange<Int>
    private let loadTemplatesAction: @Sendable () async throws -> [BudgetTemplate]
    private let generateAction: @Sendable (BudgetGenerate) async throws -> BudgetGenerateResponse

    init(
        payDayOfMonth: Int?,
        now: Date = Date(),
        loadTemplates: @escaping @Sendable () async throws -> [BudgetTemplate] = {
            try await TemplateService.shared.getAllTemplates()
        },
        generate: @escaping @Sendable (BudgetGenerate) async throws -> BudgetGenerateResponse = {
            try await BudgetService.shared.generateBudgets($0)
        }
    ) {
        let current = BudgetPeriodCalculator.periodForDate(now, payDayOfMonth: payDayOfMonth)
        self.start = current
        self.end = BudgetPeriodCalculator.periodFromIndex(
            BudgetPeriodCalculator.periodIndex(current) + 11
        )
        self.yearRange = current.year...(current.year + AppConfiguration.maxBudgetYearsAhead)
        self.loadTemplatesAction = loadTemplates
        self.generateAction = generate
    }

    var inclusiveCount: Int {
        BudgetPeriodCalculator.periodIndex(end) - BudgetPeriodCalculator.periodIndex(start) + 1
    }

    var validationMessage: String? {
        if inclusiveCount < 1 {
            return AppLocale.string("La période de fin doit suivre la période de début.")
        }
        if inclusiveCount > Self.maximumCount {
            return AppLocale.string("Choisis au maximum 36 périodes.")
        }
        return nil
    }

    var generateRequest: BudgetGenerate? {
        guard let selectedTemplateId, validationMessage == nil else { return nil }
        return BudgetGenerate(
            templateId: selectedTemplateId,
            startMonth: start.month,
            startYear: start.year,
            count: inclusiveCount
        )
    }

    var canGenerate: Bool {
        generateRequest != nil && !isLoadingTemplates && !isGenerating
    }

    func loadTemplates() async {
        isLoadingTemplates = true
        error = nil
        defer { isLoadingTemplates = false }

        do {
            templates = try await loadTemplatesAction()
            selectedTemplateId = templates.first(where: \.isDefaultTemplate)?.id ?? templates.first?.id
        } catch {
            self.error = error
        }
    }

    func generate() async -> BudgetGenerateResponse? {
        guard let request = generateRequest else { return nil }
        isGenerating = true
        error = nil
        defer { isGenerating = false }

        do {
            return try await generateAction(request)
        } catch {
            self.error = error
            return nil
        }
    }
}

enum BudgetGenerationResultAnnouncement {
    static func message(for response: BudgetGenerateResponse) -> String {
        let created = AppLocale.string("\(response.budgets.count) budgets créés")
        let skipped = AppLocale.string("\(response.skippedMonths.count) budgets déjà existants ignorés")
        return "\(created), \(skipped)"
    }
}

private extension BudgetPeriod {
    var formatted: String {
        Date.from(month: month, year: year)?.monthYearFormatted ?? String(format: "%02d.%d", month, year)
    }
}

#Preview {
    PlanBudgetsView(payDayOfMonth: 25) { _ in }
        .environment(UserSettingsStore())
}
