import SwiftUI

/// Hero balance block — flat layout on the page neutral background per DM2.1.b.c5.
///
/// Layout (refonte mai 2026):
/// - Eyebrow: "DISPONIBLE · CHF" (or "DÉFICIT · CHF" if deficit)
/// - Hero amount: Manrope ExtraBold, `Color.textPrimary`
/// - Rollover disclosure (when non-zero): ties the reported balance to the amount above
/// - Inline progress bar (green) + percent flush right
/// - Horizontal scroll of pills: Revenus · Dépenses · dont Épargne
///
/// No surface, no border, no shadow, no gradient. Sits flush on `Color.appBackground`.
/// Used **only** in `BudgetDetailsView`. The dashboard + previous-budget sheet keep
/// the classic gradient `HeroBalanceCard`.
struct BudgetDetailHero: View {
    let metrics: BudgetFormulas.Metrics
    var timeElapsedPercentage: Double = 0
    var onTapProgress: (() -> Void)?
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
        return metrics.isDeficit
            ? AppLocale.string("Déficit · \(symbol)")
            : AppLocale.string("Disponible · \(symbol)")
    }

    /// VoiceOver-only label — no embedded currency symbol so it isn't doubled with the formatted amount.
    private var contextLabelForVoiceOver: String {
        metrics.isDeficit ? AppLocale.string("Déficit") : AppLocale.string("Disponible")
    }

    private var fillPercentage: Double {
        min(max(metrics.usagePercentage / 100, 0), 1)
    }

    private var formattedBalance: String {
        let amount = abs(metrics.remaining).asAmount(for: userSettingsStore.currency)
        let sign: String
        if metrics.remaining > 0 {
            sign = "+"
        } else if metrics.isDeficit {
            sign = "-"
        } else {
            sign = ""
        }
        return "\(sign)\(amount)"
    }

    private var usagePercentageText: String {
        "\(Int(metrics.usagePercentage))%"
    }

    /// Gate on the value rounded to the 2-decimal display precision, not `!= 0`: a
    /// sub-cent residual rollover would otherwise render "+0.00 CHF" — a disclosure
    /// claiming an amount it then shows as zero.
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

    private var accessibilityDescription: String {
        if amountsHidden {
            return AppLocale.string("\(contextLabelForVoiceOver) — montant masqué")
        }
        let currency = userSettingsStore.currency
        var desc = AppLocale.string("""
        \(contextLabelForVoiceOver) \(abs(metrics.remaining).asCurrency(currency)). \
        \(Int(metrics.usagePercentage))% utilisé. \
        Revenus \(metrics.totalIncome.asCurrency(currency)). \
        Dépenses \(metrics.totalExpenses.asCurrency(currency)), \
        dont \(metrics.totalSavings.asCurrency(currency)) d'épargne
        """)
        if hasRollover, let rolloverAmount {
            let formatted = abs(rolloverAmount).asCurrency(currency)
            desc += ". " + (rolloverAmount >= 0
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

            // Chunk 2.5 — Rollover disclosure: the amount above already bakes it in.
            if hasRollover, let rolloverAmount {
                rolloverDisclosure(amount: rolloverAmount)
                    .padding(.top, DesignTokens.Spacing.xs)
            }

            // Chunk 3 — Inline progress + percent
            progressRow
                .padding(.top, DesignTokens.Spacing.md)

            // Chunk 4 — Pills row (Revenus · Épargne · Dépenses)
            pillsRow
                .padding(.top, DesignTokens.Spacing.md)
        }
        .padding(.horizontal, DesignTokens.Spacing.lg)
        .padding(.top, DesignTokens.Spacing.lg)
        .padding(.bottom, DesignTokens.Spacing.sm)
        .frame(maxWidth: .infinity, alignment: .leading)
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
                incomePill
                expensesPill
                savingsPill
            }
        }
        .contentMargins(.horizontal, DesignTokens.Spacing.lg, for: .scrollContent)
        .scrollClipDisabled()
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, -DesignTokens.Spacing.lg)
    }

    // MARK: - Rollover Disclosure

    /// Ties the rollover to the hero amount it is baked into — sits directly under the
    /// number, not in the pill rail where it read as just another metric. Tappable
    /// through to the source budget when there is one.
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
                .foregroundStyle(Color.textTertiary)

            Text(rolloverDisclosureLabel)
                .font(PulpeTypography.metricLabel)
                .foregroundStyle(Color.textTertiary)

            Text(amount.asArithmeticSignedCurrency(userSettingsStore.currency))
                .font(PulpeTypography.metricLabelBold)
                .foregroundStyle(Color.textSecondary)
                .monospacedDigit()
                .sensitiveAmount()

            if onRolloverTap != nil {
                Image(systemName: "chevron.right")
                    .font(PulpeTypography.metricMini)
                    .foregroundStyle(Color.textTertiary)
            }
        }
    }

    // MARK: - Income / Savings / Expenses Pills

    private var incomePill: some View {
        tintedPill(
            amount: metrics.totalIncome,
            label: AppLocale.string("revenus"),
            tint: .financialIncome
        )
    }

    /// Every outflow, savings included — this is the figure the hero amount
    /// subtracts from `revenus`, so it sits next to it.
    private var expensesPill: some View {
        tintedPill(
            amount: metrics.totalExpenses,
            label: AppLocale.string("dépenses"),
            tint: .financialExpense
        )
    }

    /// Prefixed "dont" because the metrics calculator adds a saving line to
    /// *both* totals (`case .saving`). Without the word the three pills read as
    /// disjoint buckets and the arithmetic looks broken.
    private var savingsPill: some View {
        tintedPill(
            prefix: AppLocale.string("dont"),
            amount: metrics.totalSavings,
            label: AppLocale.string("épargne"),
            tint: .financialSavings
        )
    }

    /// Pale-tinted pill with colored ink text — pale category-tint background,
    /// dark category text. Matches DM2.1.b.c5 maquette (incomeSoft/incomeInk pattern).
    /// No leading icon: the label word already names the kind and the tint already
    /// encodes it, so the glyph only ate rail width the third pill needed.
    private func tintedPill(
        prefix: String? = nil,
        amount: Decimal,
        label: String,
        tint: Color
    ) -> some View {
        HStack(spacing: DesignTokens.Spacing.xs) {
            if let prefix {
                Text(prefix)
                    .font(PulpeTypography.metricLabelBold)
                    .foregroundStyle(tint)
            }

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
    }
}
