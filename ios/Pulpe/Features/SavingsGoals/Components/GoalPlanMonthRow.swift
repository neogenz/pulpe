import SwiftUI

enum GoalPlanMonthAvailability: Equatable {
    case linkedForecast
    case repairableForecast
    case noLinkedForecast
    case missingBudget

    /// `canRepair` carries the half a month cannot know: repair is a
    /// plan-level offer, gated on an ACTIVE goal with a required amount above
    /// zero (`SavingsGoalDetailViewModel.canRepairPlan`). A goal whose initial
    /// amount already covers its target floors `required` at 0 while its empty
    /// future months stay provisionable — without this term the row would
    /// promise « Épargne à ajouter » with no recap to act on. Surfaces that do
    /// not offer the repair (intro, simulator) keep the default and fall back
    /// to the honest « Aucune épargne prévue ».
    init(month: SavingsGoalPlanMonth, canRepair: Bool = false) {
        if !month.lines.isEmpty {
            self = .linkedForecast
        } else if canRepair, month.isRepairable {
            self = .repairableForecast
        } else if month.hasBudget {
            self = .noLinkedForecast
        } else {
            self = .missingBudget
        }
    }

    var label: String {
        switch self {
        case .linkedForecast:
            ""
        case .repairableForecast:
            AppLocale.string("Épargne à ajouter")
        case .noLinkedForecast:
            AppLocale.string("Aucune épargne prévue")
        case .missingBudget:
            AppLocale.string("Pas de budget")
        }
    }

    var icon: String? {
        switch self {
        case .linkedForecast:
            nil
        case .repairableForecast:
            "link"
        case .noLinkedForecast:
            "minus.circle"
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
/// is adaptive to cents (`asAdaptiveCurrency`), cumulative the aggregation compact
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
    var canRepair: Bool = false
    var onOpenBudget: (() -> Void)?

    private var isCurrentPeriod: Bool { month.state == .current }
    private var availability: GoalPlanMonthAvailability {
        GoalPlanMonthAvailability(month: month, canRepair: canRepair)
    }
    private var hasLinkedForecast: Bool { availability == .linkedForecast }
    private var isBlockedByRealization: Bool {
        month.planWithdrawalConsumedAmount.rounded(2) > 0
    }
    private var isEffectivelyLocked: Bool { month.isLocked || isBlockedByRealization }

    /// Computed, not stored: a `static let` resolves once per process and would
    /// keep serving the language the app was launched in.
    nonisolated static var realizedWithdrawalLockReason: String {
        AppLocale.string("Ce retrait est déjà réalisé en partie ou en totalité. Modifie-le depuis le budget.")
    }

    private var allChecked: Bool {
        !month.lines.isEmpty && month.lines.allSatisfy(\.isChecked)
    }

    /// Statut de pointage/verrouillage dans la ligne de métadonnées — même
    /// grammaire que « Ton suivi » (`GoalContributionsSection`). L'ancien slot
    /// d'icône réservé (28pt) laissait une colonne fantôme sur tout le plan
    /// quand aucun mois ne portait de coche ni de cadenas (le cas commun d'un
    /// objectif qui démarre).
    private var stateText: (label: String, color: Color)? {
        if allChecked { return (AppLocale.string("Pointé"), .financialSavings) }
        if isEffectivelyLocked { return (AppLocale.string("Verrouillé"), .textTertiary) }
        return nil
    }

    /// PUL-329 v2 — ce que le mois ANNONCE sortir. Somme brute, affichage seul :
    /// la part déjà réalisée vit dans le stock confirmé et le reliquat est ce que
    /// la projection retranche — la sous-ligne, elle, dit seulement « ce mois
    /// prévoit de sortir 500 ». Rien à éditer : le simulateur n'ajuste que les
    /// contributions, un montant négatif n'a jamais à être saisi.
    ///
    /// `nonisolated` : pure sur deux valeurs, sans quoi elle hériterait du
    /// `@MainActor` de `View` et piégerait tout appelant hors du main thread.
    nonisolated static func plannedWithdrawalText(
        for month: SavingsGoalPlanMonth,
        currency: SupportedCurrency
    ) -> String? {
        guard month.plannedWithdrawalAmount > 0 else { return nil }
        return AppLocale.string(
            "Retrait prévu · \((-month.plannedWithdrawalAmount).asAdaptiveCurrency(currency))"
        )
    }

    private var announcedWithdrawal: String? {
        Self.plannedWithdrawalText(for: month, currency: currency)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
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

                    if let announcedWithdrawal {
                        Text(announcedWithdrawal)
                            .font(PulpeTypography.listRowSubtitle)
                            .foregroundStyle(Color.textSecondary)
                            .sensitiveAmount()
                    }

                    if isBlockedByRealization {
                        Text(Self.realizedWithdrawalLockReason)
                            .font(PulpeTypography.listRowSubtitle)
                            .foregroundStyle(Color.textSecondary)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }

                Spacer(minLength: DesignTokens.Spacing.sm)

                amountView
            }
            .opacity(isEffectivelyLocked ? DesignTokens.Opacity.pointedDim : 1)
            .accessibilityElement(children: .combine)
            .accessibilityLabel(accessibilityLabel)
            .accessibilityIdentifier("savingsGoalPlanMonthRow-\(month.year)-\(month.month)")

            if isBlockedByRealization, let onOpenBudget {
                Button("Ouvrir le budget", action: onOpenBudget)
                    .frame(
                        maxWidth: .infinity,
                        minHeight: DesignTokens.TapTarget.minimum,
                        alignment: .trailing
                    )
                    .textLinkButtonStyle()
                    .accessibilityHint("Ouvre le budget de ce retrait")
            }
        }
        // Rythme sémantique des rangées de liste — sans le minHeight de
        // `ListRow` : il dérive des rangées à icône 40pt et centrerait ces
        // rangées texte-seul dans une bande trop haute.
        .padding(.vertical, DesignTokens.ListRow.verticalPadding)
    }

    @ViewBuilder
    private var amountView: some View {
        VStack(alignment: .trailing, spacing: DesignTokens.Spacing.xxs) {
            if hasLinkedForecast {
                Text(amount.asAdaptiveCurrency(currency))
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
            parts.append(amount.asAdaptiveCurrency(currency))
        } else {
            parts.append(availability.label)
        }
        if let announcedWithdrawal {
            parts.append(announcedWithdrawal)
        }
        if showsCumulative {
            parts.append(AppLocale.string("cumulé \(cumulative.asCompactCurrency(currency))"))
        }
        if isCurrentPeriod { parts.append(AppLocale.string("ce mois")) }
        if allChecked { parts.append(AppLocale.string("pointé")) }
        if isBlockedByRealization { parts.append(Self.realizedWithdrawalLockReason) }
        if isEffectivelyLocked { parts.append(AppLocale.string("verrouillé")) }
        return parts.joined(separator: ", ")
    }
}
