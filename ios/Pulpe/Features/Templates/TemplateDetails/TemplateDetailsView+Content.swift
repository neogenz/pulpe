import SwiftUI

extension TemplateDetailsView {
    func content(template: BudgetTemplate) -> some View {
        let split = TemplatePresentation.Split(lines: viewModel.lines)
        return ScrollView {
            VStack(alignment: .leading, spacing: DesignTokens.Spacing.xxl) {
                PageHeader(
                    title: template.name,
                    subtitle: TemplatePresentation.detailSubtitle(
                        template: template,
                        usedBudgetCount: viewModel.usedBudgetCount
                    )
                )
                heroCard(split)
                    .padding(.horizontal, DesignTokens.Spacing.lg)

                lineSection(title: AppLocale.string("Revenus"), lines: viewModel.incomeLines, kind: .income)
                lineSection(title: AppLocale.string("Dépenses"), lines: viewModel.expenseLines, kind: .expense)
                lineSection(title: AppLocale.string("Épargne"), lines: viewModel.savingLines, kind: .saving)

                webBanner
                    .padding(.horizontal, DesignTokens.Spacing.lg)
                deleteSection
                    .padding(.horizontal, DesignTokens.Spacing.lg)
            }
            .padding(.vertical, DesignTokens.Spacing.sm)
        }
        .pulpeRootBottomInset()
        .refreshable {
            await viewModel.loadDetails()
        }
    }

    // MARK: - Hero

    /// What the model leaves to spend at the start of a month (V2 `Modele`): the figure,
    /// the sentence that says what it is, then where the money goes.
    private func heroCard(_ split: TemplatePresentation.Split) -> some View {
        let currency = userSettingsStore.currency
        return VStack(alignment: .leading, spacing: DesignTokens.Spacing.lg) {
            VStack(alignment: .leading, spacing: DesignTokens.Spacing.xs) {
                Text("Disponible de départ")
                    .font(PulpeTypography.labelMedium)
                    .foregroundStyle(Color.textSecondary)
                (Text(verbatim: split.available.asAmount(for: currency))
                    .font(PulpeTypography.heroAmount)
                    .tracking(DesignTokens.Tracking.hero)
                    + Text(verbatim: " \(currency.symbol)")
                    .font(PulpeTypography.heroCurrencySuffix)
                    .foregroundStyle(Color.textTertiary))
                    .monospacedDigit()
                    .minimumScaleFactor(DesignTokens.TextScale.floor)
                    .lineLimit(1)
                    .foregroundStyle(split.available < 0 ? Color.financialOverBudget : Color.textPrimary)
                    .sensitiveAmount()
                    .accessibilityIdentifier("templateDetailsHeroAmount")
                Text("""
                    Ce que ce modèle laisse à dépenser sur \(split.income.asAmount(for: currency)) de revenus, \
                    avant le report du mois précédent.
                    """)
                    .font(PulpeTypography.captionRegular)
                    .foregroundStyle(Color.textSecondary)
                    .sensitiveAmount()
            }
            AvailableSplit(
                expenses: split.expenses,
                savings: split.savings,
                available: split.available,
                currency: currency
            )
        }
        .padding(DesignTokens.Spacing.xl)
        .frame(maxWidth: .infinity, alignment: .leading)
        .pulpeSurfaceCard()
    }

    // MARK: - Lines

    @ViewBuilder
    private func lineSection(title: String, lines: [TemplateLine], kind: TransactionKind) -> some View {
        if !lines.isEmpty {
            let total = lines.reduce(Decimal.zero) { $0 + $1.amount }
            VStack(alignment: .leading, spacing: DesignTokens.Spacing.md) {
                SectionHeader(title: title, trailingAmount: total.asAmount(for: userSettingsStore.currency))
                VStack(spacing: DesignTokens.Spacing.none) {
                    ForEach(lines) { line in
                        if line.id != lines.first?.id { Divider().overlay(Color.outlineVariant) }
                        TemplateLineRow(line: line, tagNamesById: tagStore.namesById) {
                            selectedLineForEdit = line
                        }
                    }
                }
                .padding(.horizontal, DesignTokens.Spacing.lg)
                .pulpeSurfaceCard()
            }
            .padding(.horizontal, DesignTokens.Spacing.lg)
        }
    }

    // MARK: - Web banner and delete

    /// Adding or removing a line stays on the web: the page says so where it matters.
    private var webBanner: some View {
        InfoBanner(style: .neutral, systemImage: "laptopcomputer") {
            VStack(alignment: .leading, spacing: DesignTokens.Spacing.xs) {
                Text("Ici tu modifies les lignes existantes. Pour en ajouter ou en retirer, passe par l'app web.")
                Button("Ouvrir l'app web") { openURL(AppURLs.webappBudgetTemplates) }
                    .textLinkButtonStyle()
                    .font(PulpeTypography.labelLarge)
                    .foregroundStyle(Color.pulpePrimary)
                    .accessibilityIdentifier("templateOpenWebButton")
            }
        }
    }

    private var deleteSection: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.md) {
            SectionHeader(title: AppLocale.string("Modèle"))
            ActionRow(
                title: AppLocale.string("Supprimer le modèle"),
                subtitle: TemplatePresentation.deleteSubtitle(usedBudgetCount: viewModel.usedBudgetCount),
                isDestructive: true
            ) { showDeleteConfirmation = true }
            .disabled(!viewModel.canDelete)
            .accessibilityIdentifier("templateDeleteButton")
            .padding(.horizontal, DesignTokens.Spacing.lg)
            .pulpeSurfaceCard()
        }
    }
}
