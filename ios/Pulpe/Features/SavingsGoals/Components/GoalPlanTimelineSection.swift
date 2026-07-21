import SwiftUI

enum GoalPlanMonthAvailability: Equatable {
    case linkedForecast
    case noLinkedForecast
    case missingBudget

    init(month: SavingsGoalPlanMonth) {
        if !month.lines.isEmpty {
            self = .linkedForecast
        } else if month.isProvisionable {
            self = .missingBudget
        } else {
            self = .noLinkedForecast
        }
    }

    var label: String {
        switch self {
        case .linkedForecast:
            ""
        case .noLinkedForecast:
            "Aucune prévision liée"
        case .missingBudget:
            "Pas de budget"
        }
    }

    var icon: String {
        switch self {
        case .linkedForecast:
            "checkmark.circle.fill"
        case .noLinkedForecast:
            "link"
        case .missingBudget:
            "calendar.badge.exclamationmark"
        }
    }
}

struct GoalPlanTimelinePresentation {
    private static let openMonthsWindow = 3

    let months: [SavingsGoalPlanMonth]
    let isExpanded: Bool

    private var currentIndex: Int {
        months.firstIndex { $0.state == .current } ?? 0
    }

    private var collapsedMonths: [SavingsGoalPlanMonth] {
        guard !months.isEmpty else { return [] }
        let end = min(months.count, currentIndex + Self.openMonthsWindow + 1)
        return Array(months[currentIndex..<end])
    }

    var visibleMonths: [SavingsGoalPlanMonth] {
        isExpanded ? months : collapsedMonths
    }

    var hiddenCount: Int {
        max(0, months.count - visibleMonths.count)
    }

    var canToggle: Bool {
        collapsedMonths.count < months.count
    }

    var unlinkedMonthCount: Int {
        months.count(where: { $0.lines.isEmpty })
    }
}

/// « Ton plan, mois par mois » (PUL-12+, pilier B) — the read-mode timeline section
/// on the goal detail. Windowed by default (current month + three future months)
/// with a « Voir tout le plan » toggle; a full 24–96 row list
/// would burn the 30 s attention budget (`docs/SAVINGS.md` §10.1).
///
/// The section header carries the « Ajuster » CTA (pilier C entry), shown
/// only when the goal is actionable (`canAdjust`).
struct GoalPlanTimelineSection: View {
    let months: [SavingsGoalPlanMonth]
    let currency: SupportedCurrency
    let canAdjust: Bool
    let onAdjust: () -> Void

    @State private var isExpanded = false

    private var presentation: GoalPlanTimelinePresentation {
        GoalPlanTimelinePresentation(months: months, isExpanded: isExpanded)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.md) {
            HStack(spacing: DesignTokens.Spacing.md) {
                Text("Ton plan, mois par mois")
                    .font(PulpeTypography.title2)
                    .foregroundStyle(Color.textPrimary)

                Spacer(minLength: DesignTokens.Spacing.sm)

                if canAdjust {
                    Button(action: onAdjust) {
                        Label("Ajuster", systemImage: "slider.horizontal.3")
                            .font(PulpeTypography.buttonSecondary)
                    }
                    .frame(minHeight: DesignTokens.TapTarget.minimum)
                    .textLinkButtonStyle()
                    .accessibilityLabel("Ajuster le plan")
                }
            }

            timelineCard

            if presentation.canToggle {
                Button {
                    withAnimation(DesignTokens.Animation.gentleSpring) { isExpanded.toggle() }
                } label: {
                    HStack(spacing: DesignTokens.Spacing.sm) {
                        Text(isExpanded ? "Voir moins" : "Voir tout le plan (\(months.count) mois)")
                        Spacer()
                        Image(systemName: isExpanded ? "chevron.up" : "chevron.down")
                    }
                }
                .frame(
                    maxWidth: .infinity,
                    minHeight: DesignTokens.TapTarget.minimum,
                    alignment: .leading
                )
                .contentShape(Rectangle())
                .textLinkButtonStyle()
                .accessibilityHint(isExpanded ? "Réduit la liste des mois" : "Affiche tous les mois")
            }

            if presentation.unlinkedMonthCount > 0 {
                Text("\(presentation.unlinkedMonthCount) mois sans prévision liée à cet objectif.")
                    .font(PulpeTypography.listRowSubtitle)
                    .foregroundStyle(Color.textTertiary)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
    }

    private var timelineCard: some View {
        VStack(spacing: 0) {
            ForEach(Array(presentation.visibleMonths.enumerated()), id: \.element.id) { index, month in
                if index > 0 {
                    Divider().foregroundStyle(Color.textTertiary.opacity(DesignTokens.Opacity.secondary))
                }
                GoalPlanMonthRow(
                    month: month,
                    amount: month.plannedAmount,
                    cumulative: month.plannedCumulative,
                    currency: currency
                )
            }
        }
        .padding(DesignTokens.Spacing.lg)
        .pulpeCard()
    }
}
