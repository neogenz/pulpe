import SwiftUI

// MARK: - Amount column (which number, which colour, which caption)

extension BudgetLineMixedRow {
    /// Hero amount shown on the right — kind-aware semantics (spec §2.6):
    /// expenses surface the *remaining* envelope (the actionable info), while
    /// income/saving surface the *real* received/transferred amount (mental
    /// model: "did it land?" vs "did I transfer?"). Overflow surfaces the
    /// excess (real − planned) so the red number reads as the overshoot.
    var displayAmount: Decimal {
        if isExpense {
            if isOverBudget { return realAmount - plannedAmount }
            if hasReal { return consumption.available }
            return plannedAmount
        }
        return hasReal ? realAmount : plannedAmount
    }

    /// Small grey caption under the hero amount. Kind-aware:
    /// - expense empty → `prévu`
    /// - expense partial → `restant sur {planned}`
    /// - expense overflow → `de dépassement`
    /// - income/saving partial → `/ {planned} prévu`
    /// - everything else (full, equal, no-progress income/saving) → none.
    var amountSuffix: String? {
        if isExpense {
            if isOverBudget { return "de dépassement" }
            if !hasReal { return "prévu" }
            if realAmount == plannedAmount { return nil }
            return "restant sur \(plannedAmount.asAmount(for: currency))"
        }
        if hasReal, realAmount < plannedAmount {
            return "/ \(plannedAmount.asAmount(for: currency)) prévu"
        }
        return nil
    }

    /// Spec §07 — amount color cascade.
    /// Income / saving keep their category color even when `real > planned`
    /// (an over-received salary is good news, not a deficit). The overflow
    /// red is reserved for expenses that have actually blown the envelope.
    var amountColor: Color {
        if isIncome { return .financialIncome }
        if isSaving { return .financialSavings }
        if isOverBudget { return .financialOverBudget }
        if consumption.percentage >= 50 { return .warningPrimary }
        return .textSecondary
    }

    /// Spec — color of the small "CHF" suffix. Tracks the amount color for
    /// income / saving / overflowing rows (with a slight tint reduction), falls
    /// back to neutral inks otherwise so the suffix never out-shouts the digits.
    var currencyCodeColor: Color {
        if isIncome || isSaving || (isExpense && isOverBudget) {
            return amountColor
        }
        return hasReal ? .textTertiary : .textSecondary
    }

    /// Spec — opacity of the small "CHF" suffix. 0.8 only when it inherits the
    /// amount color (income / saving / over-budget expense), full strength otherwise.
    var currencyCodeOpacity: Double {
        (isIncome || isSaving || (isExpense && isOverBudget)) ? DesignTokens.Opacity.pressed : 1
    }

    @ViewBuilder
    var amountColumn: some View {
        VStack(alignment: .trailing, spacing: DesignTokens.Spacing.xxs) {
            HStack(alignment: .firstTextBaseline, spacing: DesignTokens.Spacing.xxs) {
                Text(displayAmount.asAmount(for: currency))
                    .font(PulpeTypography.amountCard)
                    .foregroundStyle(amountColor)
                    .monospacedDigit()
                    .lineLimit(1)

                Text(currency.symbol)
                    .font(PulpeTypography.metricMini)
                    .foregroundStyle(currencyCodeColor)
                    .opacity(currencyCodeOpacity)
                    .tracking(DesignTokens.Tracking.uppercaseNarrow)
            }
            .sensitiveAmount()

            if let suffix = amountSuffix {
                Text(suffix)
                    .font(PulpeTypography.metricMini)
                    .foregroundStyle(Color.textTertiary)
                    .monospacedDigit()
                    .sensitiveAmount()
            }
        }
        .lineLimit(1)
        .layoutPriority(1)
    }
}
