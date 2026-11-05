import SwiftUI

/// The planned-withdrawal rows of the recap: breakdown and destination choice.
extension GoalPlanApplyRecapSheet {
    func destinationRow(
        for change: SavingsPlanCalculator.SimulatedMonth,
        _ destination: SavingsGoalPlanApply.PlanWithdrawalAdjustment.Destination,
        title: String,
        detail: String,
        enabled: Bool = true
    ) -> some View {
        let isSelected = withdrawalDestination(for: change) == destination
        return Button {
            withdrawalDestinations[change.id] = destination
        } label: {
            HStack(alignment: .top, spacing: DesignTokens.Spacing.md) {
                Image(systemName: isSelected ? "largecircle.fill.circle" : "circle")
                    .foregroundStyle(enabled ? Color.pulpePrimary : Color.textTertiary)
                    .accessibilityHidden(true)
                VStack(alignment: .leading, spacing: DesignTokens.Spacing.xxs) {
                    Text(title).font(PulpeTypography.listRowTitle)
                    Text(detail)
                        .font(PulpeTypography.listRowSubtitle)
                        .foregroundStyle(Color.textSecondary)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
        .buttonStyle(.plain)
        .frame(minHeight: DesignTokens.TapTarget.minimum, alignment: .leading)
        .contentShape(Rectangle())
        .disabled(!enabled)
        .opacity(enabled ? 1 : DesignTokens.Opacity.disabled)
        .accessibilityLabel(title)
        .accessibilityHint(detail)
        .accessibilityAddTraits(isSelected ? .isSelected : [])
    }

    func withdrawalChange(_ change: SavingsPlanCalculator.SimulatedMonth) -> some View {
        let breakdown = Self.withdrawalBreakdown(for: change)

        return VStack(alignment: .leading, spacing: DesignTokens.Spacing.md) {
            // `String(year)`: interpolating an `Int` would apply localized grouping.
            Text("\(Formatters.monthName(for: change.month.month)) \(String(change.month.year))")
                .font(PulpeTypography.listRowTitle)
                .foregroundStyle(Color.textPrimary)

            withdrawalAmounts(breakdown)
            if change.simulatedAmount < 0 {
                withdrawalDestinationChoices(for: change)
            } else if change.month.planWithdrawalDestination == .linkedIncome {
                Text("La Prévision Revenu liée sera supprimée avec la mise à jour du plan.")
                    .font(PulpeTypography.listRowSubtitle)
                    .foregroundStyle(Color.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
    }

    func withdrawalAmounts(_ breakdown: WithdrawalBreakdown) -> some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
            if breakdown.contribution == breakdown.updatedContribution {
                amountRow(
                    label: AppLocale.string("Épargne prévue"),
                    amount: breakdown.contribution,
                    detail: AppLocale.string("Conservée")
                )
            } else {
                withdrawalTransition(
                    label: AppLocale.string("Épargne prévue"),
                    from: breakdown.contribution,
                    to: breakdown.updatedContribution
                )
            }
            withdrawalTransition(
                from: breakdown.previousWithdrawal,
                to: breakdown.plannedWithdrawal
            )
            amountRow(label: AppLocale.string("Effet net du mois"), amount: breakdown.netEffect)
        }
    }

    func withdrawalDestinationChoices(
        for change: SavingsPlanCalculator.SimulatedMonth
    ) -> some View {
        let canLink = Self.canLinkWithdrawal(change)
        let selectedDestination = withdrawalDestination(for: change)

        return VStack(alignment: .leading, spacing: DesignTokens.Spacing.md) {
            Text("Destination de ce mois")
                .font(PulpeTypography.metricLabel)
                .foregroundStyle(Color.textSecondary)

            destinationRow(
                for: change,
                .goalOnly,
                title: AppLocale.string("Objectif uniquement"),
                detail: AppLocale.string("La projection baisse. Rien ne change dans ton budget.")
            )
            destinationRow(
                for: change,
                .linkedIncome,
                title: AppLocale.string("Revenu dans le budget"),
                detail: AppLocale.string("""
                    Une Prévision Revenu liée sera ajoutée. \
                    Réalise-la dans le budget : le Réel créé sera automatiquement pointé.
                    """),
                enabled: canLink
            )

            if !canLink {
                Text("Crée d’abord le budget de ce mois pour y ajouter le revenu.")
                    .font(PulpeTypography.listRowSubtitle)
                    .foregroundStyle(Color.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)
            }

            if let message = Self.conversionMessage(
                from: change.month.planWithdrawalDestination,
                to: selectedDestination
            ) {
                Text(message)
                    .font(PulpeTypography.listRowSubtitle)
                    .foregroundStyle(Color.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)
                    .accessibilityAddTraits(.isStaticText)
            }
        }
    }

    func amountRow(label: String, amount: Decimal, detail: String? = nil) -> some View {
        ViewThatFits(in: .horizontal) {
            HStack(alignment: .firstTextBaseline, spacing: DesignTokens.Spacing.sm) {
                amountLabel(label, detail: detail)
                    .fixedSize(horizontal: true, vertical: false)
                Spacer(minLength: DesignTokens.Spacing.sm)
                breakdownAmount(amount)
                    .fixedSize(horizontal: true, vertical: false)
            }

            VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
                amountLabel(label, detail: detail)
                    .fixedSize(horizontal: false, vertical: true)
                breakdownAmount(amount)
                    .frame(maxWidth: .infinity, alignment: .trailing)
            }
        }
        .font(PulpeTypography.metricLabel)
        .foregroundStyle(Color.textPrimary)
    }

    func amountLabel(_ label: String, detail: String?) -> some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.xxs) {
            Text(label)
            if let detail {
                Text(detail)
                    .font(PulpeTypography.listRowSubtitle)
                    .foregroundStyle(Color.textTertiary)
            }
        }
    }

    func breakdownAmount(_ amount: Decimal) -> some View {
        Text(signedCurrency(amount))
            .font(PulpeTypography.metricLabelBold)
            .monospacedDigit()
            .sensitiveAmount()
    }

    func withdrawalTransition(
        label: String = AppLocale.string("Retrait planifié"),
        from: Decimal,
        to: Decimal
    ) -> some View {
        ViewThatFits(in: .horizontal) {
            HStack(alignment: .firstTextBaseline, spacing: DesignTokens.Spacing.sm) {
                Text(label)
                    .fixedSize(horizontal: true, vertical: false)
                Spacer(minLength: DesignTokens.Spacing.sm)
                withdrawalTransitionAmounts(from: from, to: to)
                    .fixedSize(horizontal: true, vertical: false)
            }

            VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
                Text(label)
                withdrawalTransitionAmounts(from: from, to: to)
                    .frame(maxWidth: .infinity, alignment: .trailing)
            }
        }
        .font(PulpeTypography.metricLabelBold)
        .monospacedDigit()
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(
            "\(label), de \(signedCurrency(from)) à \(signedCurrency(to))"
        )
        .sensitiveAmount()
    }

    func withdrawalTransitionAmounts(from: Decimal, to: Decimal) -> some View {
        ViewThatFits(in: .horizontal) {
            HStack(alignment: .firstTextBaseline, spacing: DesignTokens.Spacing.sm) {
                withdrawalBeforeAmount(from)
                transitionArrow(systemName: "arrow.right")
                withdrawalAfterAmount(to)
            }
            .fixedSize(horizontal: true, vertical: false)

            VStack(alignment: .trailing, spacing: DesignTokens.Spacing.sm) {
                withdrawalBeforeAmount(from)
                transitionArrow(systemName: "arrow.down")
                withdrawalAfterAmount(to)
            }
        }
    }

    func withdrawalBeforeAmount(_ amount: Decimal) -> some View {
        Text(signedCurrency(amount))
            .foregroundStyle(Color.textTertiary)
            .strikethrough(true, color: Color.textTertiary)
    }

    func withdrawalAfterAmount(_ amount: Decimal) -> some View {
        Text(signedCurrency(amount))
            .foregroundStyle(Color.textPrimary)
    }

    func signedCurrency(_ amount: Decimal) -> String {
        let formatted = amount.asAdaptiveCurrency(currency)
        return amount > 0 ? "+\(formatted)" : formatted
    }

    func withdrawalDestination(
        for change: SavingsPlanCalculator.SimulatedMonth
    ) -> SavingsGoalPlanApply.PlanWithdrawalAdjustment.Destination {
        withdrawalDestinations[change.id]
            ?? change.month.planWithdrawalDestination
            ?? .goalOnly
    }

    func transitionArrow(systemName: String) -> some View {
        Image(systemName: systemName)
            .font(PulpeTypography.caption2)
            .foregroundStyle(Color.textTertiary)
            .accessibilityHidden(true)
    }
}
