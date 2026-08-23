import SwiftUI

/// Budget detail hero on the shared `HeroZone` family (The One Hero Rule).
///
/// Figure: what is left to spend, to the cent (Two-Decimals rule). Three tiles: income,
/// outflows, savings. A progress bar of the month's consumption, then the verdict sentence.
/// The surface never carries the state; the verdict and its accent do.
struct BudgetDetailHero: View {
    let metrics: BudgetFormulas.Metrics
    var timeElapsedPercentage: Double = 0
    var onTapProgress: (() -> Void)?
    var rolloverAmount: Decimal?
    /// Localized month name of the source budget (e.g. "mars"). Drives the rollover label.
    var previousBudgetMonth: String?
    var onRolloverTap: (() -> Void)?

    @Environment(\.amountsHidden) private var amountsHidden
    @Environment(UserSettingsStore.self) private var userSettingsStore
    @State private var tapTrigger = false

    // MARK: - Derived

    private var currency: SupportedCurrency { userSettingsStore.currency }

    private var eyebrow: String {
        metrics.isDeficit ? AppLocale.string("Déficit") : AppLocale.string("Disponible à dépenser")
    }

    private var fillPercentage: Double {
        min(max(metrics.usagePercentage / 100, 0), 1)
    }

    private var usagePercentageText: String {
        "\(Int(metrics.usagePercentage))%"
    }

    /// Gate on the value rounded to the 2-decimal display precision, not `!= 0`: a
    /// sub-cent residual rollover would otherwise render "+0.00 CHF".
    private var hasRollover: Bool {
        guard let rolloverAmount else { return false }
        return rolloverAmount.rounded(2) != 0
    }

    private var rolloverDisclosureLabel: String {
        if let previousBudgetMonth, !previousBudgetMonth.isEmpty {
            return AppLocale.string("Report de \(previousBudgetMonth) inclus")
        }
        return AppLocale.string("Report du mois précédent inclus")
    }

    private var verdict: BudgetDetailVerdict { BudgetDetailVerdict(metrics: metrics) }

    private var accessibilityDescription: String {
        if amountsHidden {
            return AppLocale.string("\(eyebrow) — montant masqué")
        }
        var desc = AppLocale.string("""
        \(eyebrow) \(abs(metrics.remaining).asCurrency(currency)). \
        \(Int(metrics.usagePercentage))% utilisé. \
        Revenus \(metrics.totalIncome.asCurrency(currency)). \
        Dépenses \(metrics.totalExpenses.asCurrency(currency)), \
        dont \(metrics.totalSavings.asCurrency(currency)) d'épargne
        """)
        if hasRollover, let rolloverAmount {
            let roundedAmount = rolloverAmount.rounded(2)
            let formatted = abs(roundedAmount).asCurrency(currency)
            desc += ". " + (roundedAmount >= 0
                ? AppLocale.string("Excédent reporté de \(formatted)")
                : AppLocale.string("Déficit reporté de \(formatted)"))
        }
        return desc
    }

    // MARK: - Body

    var body: some View {
        Group {
            if let onTapProgress {
                Button {
                    tapTrigger.toggle()
                    onTapProgress()
                } label: {
                    heroContent
                }
                .buttonStyle(.plain)
                .sensoryFeedback(.impact(flexibility: .soft), trigger: tapTrigger)
            } else {
                heroContent
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(accessibilityDescription)
        .accessibilityAddTraits(onTapProgress != nil ? .isButton : [])
        .ifLet(onRolloverTap) { view, action in
            view.accessibilityAction(named: "Voir le budget précédent", action)
        }
    }

    private var heroContent: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.lg) {
            HeroFigure(
                eyebrow: eyebrow,
                amount: metrics.remaining,
                currency: currency,
                alignment: .leading,
                accessibilityIdentifier: "budgetDetailHeroAmount"
            )

            if hasRollover, let rolloverAmount {
                rolloverDisclosure(amount: rolloverAmount)
            }

            HeroMetricTileRow {
                HeroMetricTile(
                    icon: "arrow.down.circle",
                    label: AppLocale.string("Revenus"),
                    value: metrics.totalIncome.asAmount(for: currency)
                )
                HeroMetricTile(
                    icon: "arrow.up.circle",
                    label: AppLocale.string("Dépenses"),
                    value: metrics.totalExpenses.asAmount(for: currency)
                )
                HeroMetricTile(
                    icon: "target",
                    label: AppLocale.string("Épargne"),
                    value: metrics.totalSavings.asAmount(for: currency)
                )
            }

            progressRow

            HeroVerdictRow(sentence: verdict.sentence, accent: verdict.accent)
        }
        .padding(.horizontal, DesignTokens.Spacing.lg)
        .padding(.top, DesignTokens.Spacing.lg)
        .padding(.bottom, DesignTokens.Spacing.xl)
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    // MARK: - Progress

    private var progressRow: some View {
        HStack(spacing: DesignTokens.Spacing.sm) {
            ZStack(alignment: .leading) {
                // A progress track, not a chip: `.rect(cornerRadius:)` keeps the pill shape
                // without tripping the ad-hoc chip lint.
                Rectangle()
                    .fill(Color.heroInk.opacity(DesignTokens.Opacity.heroTile))
                    .clipShape(.rect(cornerRadius: DesignTokens.ProgressBar.heroHeight / 2))
                ProgressBarShape(progress: fillPercentage)
                    .fill(Color.heroInkSecondary)
                    .animation(DesignTokens.Animation.smoothEaseInOut, value: fillPercentage)
            }
            .frame(height: DesignTokens.ProgressBar.heroHeight)

            Text(usagePercentageText)
                .font(PulpeTypography.progressValue)
                .foregroundStyle(Color.heroInkSecondary)
                .monospacedDigit()
                .accessibilityHidden(true)
        }
    }

    // MARK: - Rollover Disclosure

    @ViewBuilder
    private func rolloverDisclosure(amount: Decimal) -> some View {
        if let onRolloverTap {
            Button(action: onRolloverTap) { rolloverDisclosureContent(amount: amount) }
                .frame(minHeight: DesignTokens.TapTarget.minimum)
                .contentShape(Rectangle())
                .plainPressedButtonStyle()
        } else {
            rolloverDisclosureContent(amount: amount)
        }
    }

    private func rolloverDisclosureContent(amount: Decimal) -> some View {
        HStack(spacing: DesignTokens.Spacing.xs) {
            Image(systemName: "arrow.clockwise")
                .font(PulpeTypography.metricMini)

            Text(rolloverDisclosureLabel)
                .font(PulpeTypography.metricLabel)

            let roundedAmount = amount.rounded(2)
            Text("\(roundedAmount > 0 ? "+" : "")\(roundedAmount.asAdaptiveCurrency(currency))")
                .font(PulpeTypography.metricLabelBold)
                .foregroundStyle(Color.heroInk)
                .monospacedDigit()
                .sensitiveAmount()

            if onRolloverTap != nil {
                Image(systemName: "chevron.right")
                    .font(PulpeTypography.metricMini)
            }
        }
        .foregroundStyle(Color.heroInkSecondary)
    }
}

/// The sentence and accent the budget-detail hero spends on its verdict. Derived from the
/// metrics' emotion state, since a closed budget has no plan to compare an estimate against.
struct BudgetDetailVerdict: Equatable {
    let sentence: String
    let accent: Color

    init(metrics: BudgetFormulas.Metrics) {
        switch metrics.emotionState {
        case .comfortable:
            sentence = AppLocale.string("Tu es large ce mois-ci.")
            accent = .heroAccentPositive
        case .tight:
            sentence = AppLocale.string("Ce mois est un peu juste.")
            accent = .heroAccentCaution
        case .deficit:
            sentence = AppLocale.string("Tu dépenses plus que tu ne gagnes ce mois-ci.")
            accent = .heroAccentDeficit
        }
    }
}
