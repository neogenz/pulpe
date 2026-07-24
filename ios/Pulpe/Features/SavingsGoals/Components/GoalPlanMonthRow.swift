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
            "Rien de prévu ce mois"
        case .missingBudget:
            "Pas de budget"
        }
    }

    var icon: String? {
        switch self {
        case .linkedForecast:
            nil
        case .noLinkedForecast:
            "link"
        case .missingBudget:
            "calendar.badge.exclamationmark"
        }
    }
}

/// One month row of « Ton plan, mois par mois » (PUL-12+, pilier B). Cloned from
/// `SpreadOccurrenceRow`: same grammar as the lissage timeline so there is zero new
/// language to learn (`docs/SAVINGS.md` §10.1).
///
/// `amount` / `cumulative` are injected so the same row serves read mode
/// (`plannedAmount` / `plannedCumulative`) and the simulator (`simulatedAmount` /
/// `simulatedCumulative`). Locked rows are dimmed + non-interactive; the current
/// period accents its title (semibold, savings green) — a chip would read as a
/// button on a passive marker; a month without a linked forecast states why. Amount
/// is the ligne 2-decimal (`asCurrency`), cumulative the aggregation compact
/// (`asCompactCurrency`, `→` prefix) — simulator only (`showsCumulative`): while
/// adjusting, the running total is the feedback; in read mode it already lives in
/// the hero (« Déjà prévu »), a per-row echo is triple-encoding. Savings green +
/// neutrals only (RG-002).
struct GoalPlanMonthRow: View {
    let month: SavingsGoalPlanMonth
    let amount: Decimal
    let cumulative: Decimal
    let currency: SupportedCurrency
    var isAdjusted: Bool = false
    var showsCumulative: Bool = false

    private var isCurrentPeriod: Bool { month.state == .current }
    private var availability: GoalPlanMonthAvailability { GoalPlanMonthAvailability(month: month) }
    private var hasLinkedForecast: Bool { availability == .linkedForecast }

    private var allChecked: Bool {
        !month.lines.isEmpty && month.lines.allSatisfy(\.isChecked)
    }

    /// Statut de pointage/verrouillage dans la ligne de métadonnées — même
    /// grammaire que « Ton suivi » (`GoalContributionsSection`). L'ancien slot
    /// d'icône réservé (28pt) laissait une colonne fantôme sur tout le plan
    /// quand aucun mois ne portait de coche ni de cadenas (le cas commun d'un
    /// objectif qui démarre).
    private var stateText: (label: String, color: Color)? {
        if allChecked { return ("Pointé", .financialSavings) }
        if month.isLocked { return ("Verrouillé", .textTertiary) }
        return nil
    }

    var body: some View {
        HStack(spacing: DesignTokens.Spacing.md) {
            VStack(alignment: .leading, spacing: DesignTokens.Spacing.xxs) {
                Text(monthLabel)
                    .font(PulpeTypography.listRowTitle)
                    .fontWeight(isCurrentPeriod ? .semibold : nil)
                    .foregroundStyle(isCurrentPeriod ? Color.financialSavings : Color.textPrimary)

                HStack(spacing: DesignTokens.Spacing.sm) {
                    if let availabilityIcon = availability.icon {
                        Label(availability.label, systemImage: availabilityIcon)
                            .font(PulpeTypography.listRowSubtitle)
                            .foregroundStyle(Color.textSecondary)
                    }

                    if let state = stateText {
                        Text(state.label)
                            .font(PulpeTypography.listRowSubtitle)
                            .foregroundStyle(state.color)
                    }
                }
            }

            Spacer(minLength: DesignTokens.Spacing.sm)

            amountView
        }
        .padding(.vertical, DesignTokens.Spacing.xs)
        .opacity(month.isLocked ? DesignTokens.Opacity.pointedDim : 1)
        .allowsHitTesting(!month.isLocked)
        .accessibilityElement(children: .combine)
        .accessibilityLabel(accessibilityLabel)
    }

    @ViewBuilder
    private var amountView: some View {
        VStack(alignment: .trailing, spacing: DesignTokens.Spacing.xxs) {
            if hasLinkedForecast {
                Text(amount.asCurrency(currency))
                    .font(PulpeTypography.amountCard)
                    .monospacedDigit()
                    .foregroundStyle(isAdjusted ? Color.pulpePrimary : Color.textPrimary)
            }
            if showsCumulative {
                Text("→ \(cumulative.asCompactCurrency(currency))")
                    .font(PulpeTypography.metricMini)
                    .monospacedDigit()
                    .foregroundStyle(Color.textTertiary)
            }
        }
        .sensitiveAmount()
    }

    private var monthLabel: String {
        "\(Formatters.monthName(for: month.month)) \(month.year)"
    }

    private var accessibilityLabel: String {
        var parts = [monthLabel]
        if hasLinkedForecast {
            parts.append(amount.asCurrency(currency))
        } else {
            parts.append(availability.label)
        }
        if showsCumulative {
            parts.append("cumulé \(cumulative.asCurrency(currency))")
        }
        if isCurrentPeriod { parts.append("ce mois") }
        if allChecked { parts.append("pointé") }
        if month.isLocked { parts.append("verrouillé") }
        return parts.joined(separator: ", ")
    }
}
