import SwiftUI

/// One page of the Objectifs first-run intro (PUL-12). It *shows* the feature
/// rather than describing it: a concrete preview (a real goal card / the real
/// plan rows with mock data) sits above a short title + caption. Restrained —
/// authenticated context, so no brand glow (DESIGN.md Glass Restraint Rule) —
/// with a staggered entrance (preview → title → caption) that respects Reduce
/// Motion (keeps a short opacity fade, never a hard cut).
struct SavingsGoalsIntroPageView<Preview: View>: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    let title: String
    let caption: String
    /// The parent flips this true when the page becomes the selected one, so the
    /// entrance plays on first reveal rather than while pre-rendered off-screen.
    let isActive: Bool
    @ViewBuilder var preview: () -> Preview

    @State private var hasAppeared = false

    var body: some View {
        VStack(spacing: DesignTokens.Spacing.xxl) {
            preview()
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
            .accessibilityLabel("\(title). \(caption)")
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

// MARK: - Preview 1 — a real-looking goal card

/// A realistic Objectif card (mock data) so the user sees what a goal *is*:
/// name, échéance, and how far along it is. Mirrors the list row's grammar
/// (`SavingsGoalRow`) plus a progression bar. Savings green/neutral only (RG-002).
struct IntroGoalCardPreview: View {
    let currency: SupportedCurrency

    private let saved: Decimal = 1200
    private let target: Decimal = 3000

    var body: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.md) {
            HStack(alignment: .firstTextBaseline) {
                Text("Voyage au Japon")
                    .font(PulpeTypography.listRowTitle)
                    .foregroundStyle(Color.textPrimary)
                Spacer(minLength: DesignTokens.Spacing.sm)
                PulpeChip(label: "En cours", style: .muted)
            }

            Text("Échéance juin 2027")
                .font(PulpeTypography.listRowSubtitle)
                .foregroundStyle(Color.textTertiary)

            ProgressView(value: 0.4)
                .tint(Color.financialSavings)

            HStack {
                Text(saved.asCompactCurrency(currency))
                    .font(PulpeTypography.amountCard)
                    .monospacedDigit()
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
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Objectif Voyage au Japon, échéance juin 2027, \(saved.asCurrency(currency)) sur \(target.asCurrency(currency))")
    }
}

// MARK: - Preview 2 — the real plan rows, mock months

/// The actual month-by-month plan (`GoalPlanMonthRow`) with mock months: one
/// pointé/verrouillé, the current one, and an upcoming one — so the user sees
/// the cumulative build up. Reuses the real row, not a parallel mock.
struct IntroPlanPreview: View {
    let currency: SupportedCurrency

    private let months: [IntroPlanRow] = [
        IntroPlanRow(month: 9, year: 2026, state: .past, locked: true, checked: true, planned: 300, cumulative: 900),
        IntroPlanRow(month: 10, year: 2026, state: .current, locked: false, checked: false, planned: 300, cumulative: 1200),
        IntroPlanRow(month: 11, year: 2026, state: .future, locked: false, checked: false, planned: 300, cumulative: 1500),
    ]

    var body: some View {
        VStack(spacing: DesignTokens.Spacing.xs) {
            ForEach(months) { row in
                GoalPlanMonthRow(
                    month: row.planMonth,
                    amount: row.planned,
                    cumulative: row.cumulative,
                    currency: currency
                )
            }
        }
        .frame(maxWidth: .infinity)
        .pulpeCard()
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
            title: "Donne un cap à ton épargne",
            caption: "Fixe un objectif — une somme, une échéance — et suis-le sans calculer.",
            isActive: true
        ) { IntroGoalCardPreview(currency: .chf) }

        SavingsGoalsIntroPageView(
            title: "Pulpe calcule ton rythme",
            caption: "Pulpe répartit le montant mois par mois — et tu l'ajustes quand tu veux.",
            isActive: true
        ) { IntroPlanPreview(currency: .chf) }
    }
    .tabViewStyle(.page)
    .pulpeBackground()
}
