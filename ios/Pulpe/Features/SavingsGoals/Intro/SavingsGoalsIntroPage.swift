import SwiftUI

/// One page of the Objectifs first-run intro (PUL-12). It *shows* the feature
/// rather than describing it: a concrete, self-animating preview (a real goal
/// card / the real plan rows with mock data) sits above a short title + caption.
/// Restrained — authenticated context, so no brand glow (DESIGN.md Glass
/// Restraint Rule) — with a staggered entrance (preview → title → caption) that
/// respects Reduce Motion (keeps a short opacity fade, never a hard cut).
///
/// The preview builder receives `isActive`: it animates its own content (a
/// progress bar filling, a cascade of rows) once the page is the selected one —
/// the "make them want it" beat.
struct SavingsGoalsIntroPageView<Preview: View>: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    let title: String
    let caption: String
    /// The parent flips this true when the page becomes the selected one.
    let isActive: Bool
    @ViewBuilder var preview: (_ isActive: Bool) -> Preview

    @State private var hasAppeared = false

    var body: some View {
        VStack(spacing: DesignTokens.Spacing.xxl) {
            preview(hasAppeared)
                .opacity(hasAppeared ? 1 : 0)
                .scaleEffect(hasAppeared ? 1 : 0.92) // never from 0 — the shape stays visible
                .animation(entrance(delayIndex: 0), value: hasAppeared)

            VStack(spacing: DesignTokens.Spacing.sm) {
                Text(title)
                    .font(PulpeTypography.stepTitle)
                    .foregroundStyle(Color.textPrimary)
                    .multilineTextAlignment(.center)
                    .opacity(hasAppeared ? 1 : 0)
                    .offset(y: hasAppeared ? 0 : entranceOffset)
                    .animation(entrance(delayIndex: 1), value: hasAppeared)

                Text(caption)
                    .font(PulpeTypography.bodyLarge)
                    .foregroundStyle(Color.textTertiary)
                    .multilineTextAlignment(.center)
                    .opacity(hasAppeared ? 1 : 0)
                    .offset(y: hasAppeared ? 0 : entranceOffset)
                    .animation(entrance(delayIndex: 2), value: hasAppeared)
            }
            .accessibilityElement(children: .combine)
            .accessibilityLabel(Text(verbatim: "\(title). \(caption)"))
        }
        .padding(.horizontal, DesignTokens.Spacing.xxl)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .onChange(of: isActive, initial: true) { _, active in
            if active { hasAppeared = true }
        }
    }

    // Reduce Motion → drop the offset/spring but keep a short opacity fade
    // (reduced motion means gentler, not none — Apple HIG).
    private var entranceOffset: CGFloat {
        reduceMotion ? 0 : DesignTokens.Spacing.lg
    }

    private func entrance(delayIndex: Int) -> SwiftUI.Animation {
        if reduceMotion {
            return .easeOut(duration: DesignTokens.Animation.fast)
        }
        return DesignTokens.Animation.entranceSpring
            .delay(Double(delayIndex) * DesignTokens.Animation.staggerStep)
    }
}

// MARK: - Preview 1 — a real-looking goal card that fills up

/// A realistic Objectif card (mock data) so the user sees what a goal *is* — and
/// watches it come alive: the progression bar fills and the saved amount rolls
/// up (numericText) once the page is active. Savings green/neutral only (RG-002).
struct IntroGoalCardPreview: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    let currency: SupportedCurrency
    /// Flips true when the page is shown — starts the fill/count-up.
    let animate: Bool

    private let saved: Decimal = 1200
    private let target: Decimal = 3000
    private let fraction = 0.4

    @State private var filled = false

    private var shownSaved: Decimal { filled ? saved : 0 }
    private var shownFraction: Double { filled ? fraction : 0 }

    var body: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.md) {
            HStack(alignment: .firstTextBaseline) {
                Text("Voyage au Japon")
                    .font(PulpeTypography.listRowTitle)
                    .foregroundStyle(Color.textPrimary)
                Spacer(minLength: DesignTokens.Spacing.sm)
                PulpeChip(label: AppLocale.string("En cours"), style: .muted)
            }

            Text("Échéance juin 2027")
                .font(PulpeTypography.listRowSubtitle)
                .foregroundStyle(Color.textTertiary)

            ProgressView(value: shownFraction)
                .tint(Color.financialSavings)

            HStack {
                Text(shownSaved.asCompactCurrency(currency))
                    .font(PulpeTypography.amountCard)
                    .monospacedDigit()
                    .contentTransition(.numericText())
                    .foregroundStyle(Color.textPrimary)
                Spacer()
                Text("sur \(target.asCompactCurrency(currency))")
                    .font(PulpeTypography.listRowSubtitle)
                    .monospacedDigit()
                    .foregroundStyle(Color.textTertiary)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .pulpeCard()
        .onChange(of: animate, initial: true) { _, active in
            guard active, !filled else { return }
            if reduceMotion {
                filled = true // final state, no fill/roll
            } else {
                // A second beat: the card lands, then it fills — "your money grows".
                withAnimation(DesignTokens.Animation.entranceSpring.delay(0.3)) { filled = true }
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(cardAccessibilityLabel)
    }

    private var cardAccessibilityLabel: String {
        let savedText = saved.asCurrency(currency)
        let targetText = target.asCurrency(currency)
        return AppLocale.string("Objectif Voyage au Japon, échéance juin 2027, \(savedText) sur \(targetText)")
    }
}

// MARK: - Preview 2 — the real plan rows, cascading in

/// The actual month-by-month plan (`GoalPlanMonthRow`) with mock months: one
/// pointé/verrouillé, the current one, and an upcoming one. The rows cascade in
/// once the page is active, so the user watches the plan *build*. Reuses the
/// real row, not a parallel mock.
struct IntroPlanPreview: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    let currency: SupportedCurrency
    /// Flips true when the page is shown — starts the cascade.
    let animate: Bool

    @State private var revealed = false

    private let months: [IntroPlanRow] = [
        IntroPlanRow(month: 9, year: 2026, state: .past, locked: true, checked: true, planned: 300, cumulative: 900),
        IntroPlanRow(
            month: 10, year: 2026, state: .current, locked: false, checked: false, planned: 300, cumulative: 1200
        ),
        IntroPlanRow(
            month: 11, year: 2026, state: .future, locked: false, checked: false, planned: 300, cumulative: 1500
        ),
    ]

    var body: some View {
        VStack(spacing: DesignTokens.Spacing.xs) {
            ForEach(Array(months.enumerated()), id: \.element.id) { index, row in
                GoalPlanMonthRow(
                    month: row.planMonth,
                    amount: row.planned,
                    cumulative: row.cumulative,
                    currency: currency
                )
                .opacity(revealed ? 1 : 0)
                .offset(y: revealed ? 0 : DesignTokens.Spacing.md)
                .animation(rowAnimation(index: index), value: revealed)
            }
        }
        .frame(maxWidth: .infinity)
        .pulpeCard()
        .onChange(of: animate, initial: true) { _, active in
            if active { revealed = true }
        }
    }

    private func rowAnimation(index: Int) -> SwiftUI.Animation {
        if reduceMotion {
            return .easeOut(duration: DesignTokens.Animation.fast)
        }
        // Cascade: each row lands a beat after the previous, after a short lead-in.
        return DesignTokens.Animation.entranceSpring
            .delay(0.25 + Double(index) * DesignTokens.Animation.staggerStep)
    }
}

/// Mock plan-month descriptor for the intro preview — builds the real
/// `SavingsGoalPlanMonth` the row expects.
private struct IntroPlanRow: Identifiable {
    let month: Int
    let year: Int
    let state: SavingsPlanMonthState
    let locked: Bool
    let checked: Bool
    let planned: Decimal
    let cumulative: Decimal

    var id: Int { year * 12 + month }

    var planMonth: SavingsGoalPlanMonth {
        SavingsGoalPlanMonth(
            month: month,
            year: year,
            state: state,
            isLocked: locked,
            plannedAmount: planned,
            confirmedAmount: checked ? planned : 0,
            plannedCumulative: cumulative,
            confirmedCumulative: checked ? cumulative : 0,
            lines: [
                SavingsGoalPlanLine(
                    budgetLineId: "intro-\(month)",
                    amount: planned,
                    checkedAt: checked ? "2026-01-01" : nil,
                    isManuallyAdjusted: false
                )
            ]
        )
    }
}

#Preview {
    TabView {
        SavingsGoalsIntroPageView(
            title: "Ce projet, tu vas l'atteindre",
            caption: "Voyage, appart, coussin de sécurité… donne-lui un montant et une date.",
            isActive: true
        ) { active in IntroGoalCardPreview(currency: .chf, animate: active) }

        SavingsGoalsIntroPageView(
            title: "Et tu sauras toujours où tu en es",
            caption: "Chaque mois s'ajuste tout seul. Zéro calcul, zéro doute — juste ta progression qui monte.",
            isActive: true
        ) { active in IntroPlanPreview(currency: .chf, animate: active) }
    }
    .tabViewStyle(.page)
    .pulpeBackground()
}
