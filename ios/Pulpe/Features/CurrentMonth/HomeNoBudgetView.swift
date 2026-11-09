import SwiftUI

/// The accueil of a month that has no budget yet (V2 `Accueil-vide`): a preview of the default
/// template, then « Créer le budget de … » in one tap. Another template is one link away.
struct HomeNoBudgetView: View {
    let month: Int
    let year: Int
    let isCreationAvailable: Bool
    let onCreated: (Budget) -> Void
    let onPickOtherTemplate: () -> Void

    @Environment(UserSettingsStore.self) private var userSettingsStore
    @State private var viewModel: CreateBudgetViewModel
    @State private var templateLines: [TemplateLine] = []

    init(
        month: Int,
        year: Int,
        isCreationAvailable: Bool,
        onCreated: @escaping (Budget) -> Void,
        onPickOtherTemplate: @escaping () -> Void
    ) {
        self.month = month
        self.year = year
        self.isCreationAvailable = isCreationAvailable
        self.onCreated = onCreated
        self.onPickOtherTemplate = onPickOtherTemplate
        _viewModel = State(initialValue: CreateBudgetViewModel(month: month, year: year))
    }

    private var currency: SupportedCurrency { userSettingsStore.currency }

    private var template: BudgetTemplate? {
        viewModel.templates.first { $0.id == viewModel.selectedTemplateId }
    }

    private var monthName: String { Formatters.monthNameInText(for: month) }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: DesignTokens.Spacing.xxl) {
                PageHeader(title: Formatters.monthName(for: month).capitalized, subtitle: periodCaption)

                VStack(spacing: DesignTokens.Spacing.xxl) {
                    card
                    VStack(spacing: DesignTokens.Spacing.sm) {
                        Button(AppLocale.string("Créer le budget de \(monthName)")) {
                            Task {
                                if let budget = await viewModel.createBudget() { onCreated(budget) }
                            }
                        }
                        .primaryButtonStyle(isEnabled: viewModel.canCreate && isCreationAvailable)
                        .disabled(!viewModel.canCreate || !isCreationAvailable)
                        .accessibilityIdentifier("homeCreateBudgetButton")

                        Button("Partir d'un autre modèle", action: onPickOtherTemplate)
                            .textLinkButtonStyle()
                            .disabled(!isCreationAvailable)
                            .accessibilityIdentifier("homeOtherTemplateButton")
                    }
                    if let error = viewModel.error {
                        ErrorBanner(message: DomainErrorLocalizer.localize(error)) { viewModel.error = nil }
                    }
                }
                .padding(.horizontal, DesignTokens.Spacing.xl)
            }
            .padding(.top, DesignTokens.Spacing.sm)
            .padding(.bottom, DesignTokens.Spacing.lg)
        }
        .scrollBounceBehavior(.basedOnSize)
        .loadingOverlay(viewModel.isCreating, message: AppLocale.string("Création..."))
        .task {
            await viewModel.loadTemplates()
            if let id = viewModel.selectedTemplateId {
                templateLines = (try? await TemplateService.shared.getTemplateLines(templateId: id)) ?? []
            }
        }
    }

    /// "Du 25 nov. au 24 déc.": the period the budget would cover.
    private var periodCaption: String {
        let dates = BudgetPeriodCalculator.periodDates(
            month: month, year: year, payDayOfMonth: userSettingsStore.payDayOfMonth
        )
        return AppLocale.string(
            "Du \(Formatters.dayMonthLabel(for: dates.startDate)) au \(Formatters.dayMonthLabel(for: dates.endDate))"
        )
    }

    private var card: some View {
        let totals = BudgetFormulas.calculateTemplateTotals(lines: templateLines)
        let savings = sum(.saving)
        return VStack(spacing: DesignTokens.Spacing.lg) {
            VStack(spacing: DesignTokens.Spacing.md) {
                Image(systemName: "calendar")
                    .font(PulpeTypography.sectionIcon)
                    .foregroundStyle(Color.accentInk)
                    .frame(width: DesignTokens.IconSize.statusDisc, height: DesignTokens.IconSize.statusDisc)
                    .background(Color.accentWash, in: Circle())
                    .accessibilityHidden(true)
                Text("Pas encore de budget ce mois-ci")
                    .font(PulpeTypography.statusTitle)
                    .foregroundStyle(Color.textPrimary)
                    .multilineTextAlignment(.center)
                    .accessibilityAddTraits(.isHeader)
                Text("Je pars de ton modèle : tu ajustes ce qui change, et c'est prêt.")
                    .font(PulpeTypography.bannerText)
                    .foregroundStyle(Color.textSecondary)
                    .multilineTextAlignment(.center)
            }

            if let template {
                VStack(spacing: DesignTokens.Spacing.none) {
                    HStack {
                        Text(template.name)
                            .font(PulpeTypography.rowTitle)
                            .foregroundStyle(Color.textPrimary)
                        Spacer(minLength: DesignTokens.Spacing.sm)
                        if template.isDefaultTemplate {
                            PulpeChip(label: AppLocale.string("Par défaut"), style: .muted)
                                .allowsHitTesting(false)
                        }
                    }
                    .frame(minHeight: DesignTokens.ListRow.formRowHeight)
                    totalRow(AppLocale.string("Revenus"), totals.totalIncome)
                    totalRow(AppLocale.string("Dépenses prévues"), sum(.expense))
                    totalRow(AppLocale.string("Épargne prévue"), savings)
                    totalRow(AppLocale.string("Disponible à dépenser"), totals.balance, isBold: true)
                }
                .transition(.opacity)
            } else {
                SkeletonShape(height: DesignTokens.Skeleton.lineHeight * 4).shimmering()
            }
        }
        .padding(DesignTokens.Spacing.xl)
        .frame(maxWidth: .infinity)
        .pulpeSurfaceCard()
        .animation(DesignTokens.Animation.smoothEaseOut, value: template?.id)
    }

    private func sum(_ kind: TransactionKind) -> Decimal {
        templateLines.filter { $0.kind == kind }.reduce(Decimal.zero) { $0 + $1.amount }
    }

    private func totalRow(_ title: String, _ amount: Decimal, isBold: Bool = false) -> some View {
        VStack(spacing: DesignTokens.Spacing.none) {
            Divider().overlay(Color.outlineVariant)
            HStack {
                Text(title)
                    .font(isBold ? PulpeTypography.rowTitle : PulpeTypography.bodyLarge)
                    .foregroundStyle(Color.textPrimary)
                Spacer(minLength: DesignTokens.Spacing.sm)
                Text(amount.asAmount(for: currency))
                    .font(PulpeTypography.rowAmount)
                    .foregroundStyle(Color.textPrimary)
                    .sensitiveAmount()
            }
            .frame(minHeight: DesignTokens.ListRow.formRowHeight)
        }
    }
}
