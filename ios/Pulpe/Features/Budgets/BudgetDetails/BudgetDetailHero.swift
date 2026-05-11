import SwiftUI

/// Hero balance block — flat layout on the page neutral background per DM2.1.b.c5.
///
/// Layout (refonte mai 2026):
/// - Eyebrow: "DISPONIBLE · CHF" (or "DÉFICIT · CHF" if deficit)
/// - Hero amount: Manrope ExtraBold, `Color.textPrimary`
/// - Inline progress bar (green) + percent flush right
/// - Horizontal scroll of pills: Reporté · Revenus · Épargne · Dépenses
///
/// No surface, no border, no shadow, no gradient. Sits flush on `Color.appBackground`.
/// Used **only** in `BudgetDetailsView`. The dashboard + previous-budget sheet keep
/// the classic gradient `HeroBalanceCard`.
struct BudgetDetailHero: View {
    let metrics: BudgetFormulas.Metrics
    var timeElapsedPercentage: Double = 0
    var onTapProgress: (() -> Void)?
    var onTapChart: (() -> Void)?
    var rolloverAmount: Decimal?
    /// Localized month name of the source budget (e.g. "mars"). Drives the rollover pill label.
    var previousBudgetMonth: String?
    var onRolloverTap: (() -> Void)?

    // MARK: - Environment

    @Environment(\.amountsHidden) private var amountsHidden
    @Environment(UserSettingsStore.self) private var userSettingsStore
    @State private var tapTrigger = false

    // MARK: - Computed Properties

    private var contextLabel: String {
        let symbol = userSettingsStore.currency.symbol
        return metrics.isDeficit ? "Déficit · \(symbol)" : "Disponible · \(symbol)"
    }

    /// VoiceOver-only label — no embedded currency symbol so it isn't doubled with the formatted amount.
    private var contextLabelForVoiceOver: String {
        metrics.isDeficit ? "Déficit" : "Disponible"
    }

    private var fillPercentage: Double {
        min(max(metrics.usagePercentage / 100, 0), 1)
    }

    private var formattedBalance: String {
        abs(metrics.remaining).asAmount(for: userSettingsStore.currency)
    }

    private var usagePercentageText: String {
        "\(Int(metrics.usagePercentage))%"
    }

    private var hasRollover: Bool {
        guard let rolloverAmount else { return false }
        return rolloverAmount != 0
    }

    private var rolloverPillLabel: String {
        if let previousBudgetMonth, !previousBudgetMonth.isEmpty {
            return "Reporté de \(previousBudgetMonth)"
        }
        return "Reporté"
    }

    private var accessibilityDescription: String {
        if amountsHidden {
            return "\(contextLabelForVoiceOver) — montant masqué"
        }
        let currency = userSettingsStore.currency
        var desc = """
        \(contextLabelForVoiceOver) \(abs(metrics.remaining).asCurrency(currency)). \
        \(Int(metrics.usagePercentage))% utilisé. \
        Revenus \(metrics.totalIncome.asCurrency(currency)). \
        Épargne \(metrics.totalSavings.asCurrency(currency))
        """
        if let rolloverAmount, rolloverAmount != 0 {
            let label = rolloverAmount >= 0 ? "Excédent reporté" : "Déficit reporté"
            desc += ". \(label) de \(abs(rolloverAmount).asCurrency(currency))"
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
                    cardContent
                }
                .buttonStyle(.plain)
                .sensoryFeedback(.impact(flexibility: .soft), trigger: tapTrigger)
            } else {
                cardContent
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(accessibilityDescription)
        .accessibilityAddTraits(onTapProgress != nil ? .isButton : [])
        .ifLet(onRolloverTap) { view, action in
            view.accessibilityAction(named: "Voir le budget précédent", action)
        }
        .ifLet(onTapChart) { view, action in
            view.accessibilityAction(named: "Suivi du budget", action)
        }
    }

    // MARK: - Card Content

    private var cardContent: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.none) {
            // Chunk 1 — Contextual eyebrow
            Text(contextLabel)
                .font(PulpeTypography.labelLargeBold)
                .textCase(.uppercase)
                .tracking(DesignTokens.Tracking.uppercase)
                .foregroundStyle(Color.textSecondary)

            // Chunk 2 — Hero amount (black on neutral) — tight 6pt gap to eyebrow
            Text(formattedBalance)
                .font(PulpeTypography.displayYear)
                .tracking(DesignTokens.Tracking.display)
                .minimumScaleFactor(0.5)
                .lineLimit(1)
                .monospacedDigit()
                .foregroundStyle(Color.textPrimary)
                .contentTransition(.numericText())
                .sensitiveAmount()
                .padding(.top, DesignTokens.Spacing.tightGap)

            // Chunk 3 — Inline progress + percent
            progressRow
                .padding(.top, DesignTokens.Spacing.md)

            // Chunk 4 — Pills row (Reporté · Revenus · Épargne · Dépenses)
            pillsRow
                .padding(.top, DesignTokens.Spacing.md)
        }
        .padding(.horizontal, DesignTokens.Spacing.lg)
        .padding(.top, DesignTokens.Spacing.lg)
        .padding(.bottom, DesignTokens.Spacing.sm)
        .frame(maxWidth: .infinity, alignment: .leading)
        .overlay(alignment: .topTrailing) {
            if let onTapChart {
                chartButton(action: onTapChart)
                    .padding(.trailing, DesignTokens.Spacing.lg)
                    .padding(.top, DesignTokens.Spacing.sm)
            }
        }
    }

    // MARK: - Chart Button

    private func chartButton(action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: "chart.bar.fill")
                .font(PulpeTypography.metricLabel)
                .foregroundStyle(Color.textSecondary)
                .frame(
                    width: DesignTokens.TapTarget.minimum,
                    height: DesignTokens.TapTarget.minimum
                )
        }
        .iconButtonStyle()
        .accessibilityLabel("Suivi du budget")
    }

    // MARK: - Progress + Inline Percent

    private var progressRow: some View {
        HStack(spacing: DesignTokens.Spacing.sm) {
            progressBar

            Text(usagePercentageText)
                .font(PulpeTypography.progressValue)
                .foregroundStyle(Color.financialSavings)
                .monospacedDigit()
                .accessibilityHidden(true)
        }
    }

    // MARK: - Progress Bar

    private var progressBar: some View {
        ZStack(alignment: .leading) {
            Capsule()
                .fill(Color.progressTrack)

            ProgressBarShape(progress: fillPercentage)
                .fill(Color.financialSavings)
                .animation(DesignTokens.Animation.smoothEaseInOut, value: fillPercentage)
        }
        .frame(height: DesignTokens.ProgressBar.heroHeight)
    }

    // MARK: - Pills Row

    private var pillsRow: some View {
        // Only this horizontal rail goes full-bleed. The surrounding hero chunks
        // keep their lg horizontal padding; the negative outer padding cancels
        // it so the scroll viewport spans the whole card width, and the inner
        // contentMargins re-adds it so the first pill aligns with the chunks.
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: DesignTokens.Spacing.tightGap) {
                if hasRollover, let rolloverAmount {
                    rolloverPill(amount: rolloverAmount)
                }

                incomePill
                savingsPill
                expensesPill
            }
        }
        .contentMargins(.horizontal, DesignTokens.Spacing.lg, for: .scrollContent)
        .scrollClipDisabled()
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, -DesignTokens.Spacing.lg)
    }

    // MARK: - Rollover Pill

    @ViewBuilder
    private func rolloverPill(amount: Decimal) -> some View {
        if let onRolloverTap {
            Button(action: onRolloverTap) { rolloverPillContent(amount: amount) }
                .frame(minHeight: DesignTokens.TapTarget.minimum)
                .contentShape(Capsule())
                .plainPressedButtonStyle()
        } else {
            rolloverPillContent(amount: amount)
        }
    }

    private func rolloverPillContent(amount: Decimal) -> some View {
        HStack(spacing: DesignTokens.Spacing.xs) {
            Image(systemName: "arrow.clockwise")
                .font(PulpeTypography.metricMini)
                .foregroundStyle(Color.textTertiary)

            Text("\(rolloverPillLabel) ·")
                .font(PulpeTypography.metricLabel)
                .foregroundStyle(Color.textTertiary)

            Text(abs(amount).asCurrency(userSettingsStore.currency))
                .font(PulpeTypography.metricLabelBold)
                .foregroundStyle(Color.textSecondary)
                .monospacedDigit()
                .sensitiveAmount()
        }
        .padding(.horizontal, DesignTokens.Spacing.md)
        .padding(.vertical, DesignTokens.Spacing.tightGap)
        .background {
            Capsule()
                .fill(Color.surfaceContainer)
        }
        .overlay {
            Capsule()
                .strokeBorder(
                    Color.outlineVariant,
                    style: StrokeStyle(lineWidth: DesignTokens.BorderWidth.thin, dash: [4])
                )
        }
        .contentShape(Capsule())
    }

    // MARK: - Income / Savings / Expenses Pills

    private var incomePill: some View {
        tintedPill(
            iconName: TransactionKind.income.icon,
            amount: metrics.totalIncome,
            label: "revenus",
            tint: .financialIncome
        )
    }

    private var savingsPill: some View {
        tintedPill(
            iconName: TransactionKind.saving.icon,
            amount: metrics.totalSavings,
            label: "épargne",
            tint: .financialSavings
        )
    }

    private var expensesPill: some View {
        tintedPill(
            iconName: TransactionKind.expense.icon,
            amount: metrics.totalExpenses,
            label: "dépenses",
            tint: .financialExpense
        )
    }

    /// Pale-tinted pill with colored ink text — pale category-tint background,
    /// dark category text. Matches DM2.1.b.c5 maquette (incomeSoft/incomeInk pattern).
    /// Icon is an SF Symbol from `TransactionKind.icon` so all three pills stay
    /// visually consistent with the kind icons used in `TransactionRow` and
    /// `BudgetLineMixedRow`.
    private func tintedPill(
        iconName: String,
        amount: Decimal,
        label: String,
        tint: Color
    ) -> some View {
        HStack(spacing: DesignTokens.Spacing.xs) {
            Image(systemName: iconName)
                .font(PulpeTypography.metricLabelBold)
                .foregroundStyle(tint)

            Text(amount.asAmount(for: userSettingsStore.currency))
                .font(PulpeTypography.metricLabelBold)
                .foregroundStyle(tint)
                .monospacedDigit()
                .sensitiveAmount()

            Text(label)
                .font(PulpeTypography.metricLabelBold)
                .foregroundStyle(tint)
        }
        .padding(.horizontal, DesignTokens.Spacing.md)
        .padding(.vertical, DesignTokens.Spacing.tightGap)
        .background {
            Capsule()
                .fill(tint.opacity(DesignTokens.Opacity.accent))
        }
        .contentShape(Capsule())
    }
}
