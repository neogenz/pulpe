import SwiftUI

/// Month-end estimate hero. Financial formulas stay in `BudgetFormulas`; this view only
/// translates their results into the signed, glanceable comparison shown on the dashboard.
/// The trajectory plot and its spoken description live in `HomeHeroCard+Chart.swift`.
struct HomeHeroCard: View {
    let metrics: BudgetFormulas.Metrics
    /// Used only when there is no trajectory to read the plan's own origin from — a period
    /// the plot cannot draw because today falls outside it. Named for that precedence, so a
    /// caller can see at the call site that this value does not always reach the screen.
    let fallbackPlannedBalance: Decimal
    let trajectory: BudgetFormulas.BalanceTrajectory?
    let monthName: String
    /// A home entry is still on its way to the server: the projection is drawn from an
    /// optimistic store and says so by shimmering until the response lands.
    var isSettling = false
    /// The first month of an account with nothing recorded: no plot to read yet, and the
    /// sentence invites instead of judging.
    var startsFresh = false
    /// Hides or shows every amount: the eye sits beside the figure it hides.
    var onToggleAmounts: (() -> Void)?
    var onTapCalculation: () -> Void

    @Environment(UserSettingsStore.self) private var userSettingsStore
    @Environment(\.amountsHidden) var amountsHidden
    @Environment(\.accessibilityReduceMotion) var reduceMotion
    @Environment(\.scenePhase) var scenePhase
    @State private var tapTrigger = false
    @State var settlePulse = false
    /// The day under the finger while the plot is being scrubbed, `nil` at rest.
    @State var scrubDay: Int?
    /// Each pill's measured size, so the plot can lay the labels out around the dot.
    @State var pillSizes: [HeroChartLabelLayout.Label: CGSize] = [:]

    var currency: SupportedCurrency { userSettingsStore.currency }
    private var scrubReading: ScrubReading? {
        guard let scrubDay, let trajectory else { return nil }
        return Self.scrubReading(at: scrubDay, in: trajectory)
    }
    var presentation: HeroVerdictPresentation {
        HeroVerdictPresentation(
            // The plot's own origin whenever there is a plot, so the sentence and the line it
            // describes quote one number rather than two calculations of it.
            plannedBalance: trajectory?.plannedBalance ?? fallbackPlannedBalance,
            estimatedBalance: metrics.remaining,
            // The plot's own drift date, so the sentence dates the same departure the line
            // draws. No plot, no date — and the sentence drops to its undated form.
            driftDate: trajectory?.driftDate
        )
    }

    /// One accent for the card, spent on the sentence's verdict and the projected stroke.
    var accentColor: Color { presentation.lightAccent }

    // MARK: - Body

    /// One read order, top to bottom: what is available, the sentence that explains where the
    /// month is heading, and the picture of it. A white card on the page, no forest.
    var body: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.lg) {
            VStack(alignment: .leading, spacing: DesignTokens.Spacing.xs) {
                headerRow
                figure
            }

            verdictSentence

            VStack(spacing: DesignTokens.Spacing.xs) {
                balanceChart
                chartTimeAxis
            }
        }
        .padding(DesignTokens.Spacing.xl)
        .frame(maxWidth: .infinity, alignment: .leading)
        .pulpeSurfaceCard()
        // Drives the digit morph of the figure: `contentTransition` is inert unless the value
        // change happens inside an animation, so the two ship together or neither works.
        .animation(DesignTokens.Animation.smoothEaseInOut, value: metrics)
        .animation(reduceMotion ? nil : DesignTokens.Animation.quickEaseInOut, value: scrubDay)
    }

    // MARK: - Figure

    /// While the plot is scrubbed the eyebrow hands itself to the finger: the day and the
    /// plan's reading, and the figure becomes the day's reading.
    private var headerRow: some View {
        HStack(alignment: .firstTextBaseline, spacing: DesignTokens.Spacing.md) {
            Text(scrubReading.map { Self.scrubEyebrow($0, currency: currency) }
                ?? AppLocale.string("Disponible à dépenser"))
                .font(PulpeTypography.labelMedium)
                .foregroundStyle(Color.textSecondary)
                .lineLimit(2)
                .minimumScaleFactor(DesignTokens.TextScale.compact)
            if let onToggleAmounts, scrubReading == nil {
                amountsToggle(onToggleAmounts)
            }
            Spacer(minLength: DesignTokens.Spacing.sm)
            Button {
                tapTrigger.toggle()
                onTapCalculation()
            } label: {
                HStack(spacing: DesignTokens.Spacing.xxs) {
                    Text("Le calcul")
                    Image(systemName: "chevron.right").font(PulpeTypography.metricLabel)
                }
                .font(PulpeTypography.labelLarge)
                .foregroundStyle(Color.pulpePrimary)
                // 44pt hit area without growing the row (swiftui-hit-areas.md).
                .padding(.vertical, DesignTokens.TapTarget.minimum / 2)
                .contentShape(Rectangle())
                .padding(.vertical, -DesignTokens.TapTarget.minimum / 2)
            }
            .textLinkButtonStyle()
            .sensoryFeedback(.impact(flexibility: .soft), trigger: tapTrigger)
            .accessibilityHint("Ouvrir le détail du calcul")
            .accessibilityIdentifier("homeHeroMetrics")
        }
    }

    /// The action, like the password field: a slashed eye while the amounts show.
    private func amountsToggle(_ action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: amountsHidden ? "eye" : "eye.slash")
                .font(PulpeTypography.labelMedium)
                .foregroundStyle(amountsHidden ? Color.accentInk : Color.textSecondary)
                .contentTransition(.symbolEffect(.replace))
                // 44pt hit area without growing the row (swiftui-hit-areas.md).
                .padding(DesignTokens.TapTarget.minimum / 2)
                .contentShape(Rectangle())
                .padding(-DesignTokens.TapTarget.minimum / 2)
        }
        .plainPressedButtonStyle()
        .accessibilityLabel(amountsHidden ? "Afficher les montants" : "Masquer les montants")
        .accessibilityIdentifier("homeAmountsToggle")
    }

    private var figure: some View {
        let amount = scrubReading.map(Self.scrubFigure) ?? metrics.remaining
        return (Text(verbatim: amount.asAdaptiveAmount(for: currency))
            .font(PulpeTypography.heroAmount)
            .tracking(DesignTokens.Tracking.hero)
            + Text(verbatim: " \(currency.symbol)")
            .font(PulpeTypography.heroCurrencySuffix)
            .foregroundStyle(Color.textTertiary))
            .monospacedDigit()
            .minimumScaleFactor(DesignTokens.TextScale.floor)
            .lineLimit(1)
            .foregroundStyle(Color.textPrimary)
            .contentTransition(.numericText())
            .sensitiveAmount()
            .accessibilityIdentifier("homeProjectedBalanceAmount")
    }

    // MARK: - Verdict

    /// The one sentence the card spends on the rhythm: the verdict in the accent, then where
    /// the month lands if it keeps its pace. Figures drop out under the privacy mode.
    private var verdictSentence: some View {
        let rhythm = trajectory.flatMap {
            Self.rhythmSentence(for: $0, currency: currency, amountsHidden: amountsHidden)
        }
        let verdict = startsFresh ? AppLocale.string("Pile sur ton plan.") : presentation.verdictText
        let tail = startsFresh
            ? AppLocale.string("Ajoute tes dépenses au fil du mois : ce chiffre se met à jour aussitôt.")
            : rhythm
        return (Text(verdict)
            .font(PulpeTypography.bodyLarge.weight(.semibold))
            .foregroundStyle(startsFresh ? Color.pulpePrimary : accentColor)
            + Text(tail.map { " \($0)" } ?? "")
            .font(PulpeTypography.bodyLarge)
            .foregroundStyle(Color.textPrimary))
            .fixedSize(horizontal: false, vertical: true)
            .accessibilityIdentifier("homeHeroVerdict")
    }
}

#Preview("Estimated balance hero") {
    let gainTrajectory = BudgetFormulas.BalanceTrajectory(
        landing: [
            .init(day: 0, balance: 632),
            .init(day: 3, balance: 632),
            .init(day: 8, balance: 1_020),
            .init(day: 12, balance: 1_020),
            .init(day: 17, balance: 1_260),
        ],
        plannedAvailable: 8_032,
        real: [
            .init(day: 0, balance: 8_032),
            .init(day: 3, balance: 6_900),
            .init(day: 8, balance: 6_100),
            .init(day: 12, balance: 5_400),
            .init(day: 17, balance: 4_800),
        ],
        driftDate: Calendar.current.date(from: DateComponents(year: 2026, month: 7, day: 8)),
        plannedOutflows: 6_772,
        today: 17,
        totalDays: 31
    )
    ScrollView {
        HomeHeroCard(
            metrics: .init(
                totalIncome: 8032,
                totalExpenses: 6772,
                totalSavings: 0,
                available: 8032,
                endingBalance: 1260,
                remaining: 1260,
                rollover: 0
            ),
            fallbackPlannedBalance: 632,
            trajectory: gainTrajectory,
            monthName: "juillet",
            onTapCalculation: {}
        )
        .padding(DesignTokens.Spacing.lg)
    }
    .background(Color.appBackground)
    .environment(UserSettingsStore())
}
