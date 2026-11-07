import SwiftUI

/// The withdrawal rows of the goal pages. Every row lives inside its group's card, so it
/// draws no surface of its own: it pads itself vertically and lets the hairline above it
/// do the separating.
struct GoalPlannedWithdrawalRow: View {
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    let item: GoalWithdrawals.PlannedItem
    let currency: SupportedCurrency
    let onOpenBudget: (String) -> Void

    var body: some View { plannedRow(item) }

    @ViewBuilder
    private func plannedRow(_ item: GoalWithdrawals.PlannedItem) -> some View {
        if let budgetId = item.budgetId {
            Button {
                onOpenBudget(budgetId)
            } label: {
                plannedRowContent(item)
            }
            .plainPressedButtonStyle()
            .frame(minHeight: DesignTokens.TapTarget.minimum)
            .contentShape(.rect)
            .accessibilityElement(children: .ignore)
            .accessibilityLabel(item.accessibilityLabel(currency: currency))
            .accessibilityHint(item.accessibilityHint ?? "")
        } else {
            plannedRowContent(item)
                .accessibilityElement(children: .ignore)
                .accessibilityLabel(item.accessibilityLabel(currency: currency))
        }
    }

    /// No head glyph: every row of a group says the same thing, so a repeated
    /// calendar scans as texture rather than information. The « Hors budget »
    /// segment of the subtitle already carries what the second glyph encoded.
    private func plannedRowContent(_ item: GoalWithdrawals.PlannedItem) -> some View {
        // Ligne de base commune, pas alignement haut : la colonne de droite ne
        // porte de contenu que sur la première ligne, alors un chevron centré
        // sur une rangée de trois lignes flotte seul au milieu du vide.
        HStack(alignment: .firstTextBaseline, spacing: DesignTokens.Spacing.md) {
            if dynamicTypeSize.isAccessibilitySize {
                VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
                    plannedDescription(item)
                    HStack(alignment: .firstTextBaseline, spacing: DesignTokens.Spacing.sm) {
                        Spacer(minLength: DesignTokens.Spacing.none)
                        plannedAmount(item)
                        WithdrawalChevron().opacity(item.budgetId == nil ? 0 : 1)
                    }
                }
            } else {
                plannedDescription(item)
                Spacer(minLength: DesignTokens.Spacing.sm)
                plannedAmount(item)
                WithdrawalChevron().opacity(item.budgetId == nil ? 0 : 1)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.vertical, DesignTokens.Spacing.md)
    }

    private func plannedDescription(_ item: GoalWithdrawals.PlannedItem) -> some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.xxs) {
            Text(item.name)
                .font(PulpeTypography.labelLarge)
                .foregroundStyle(Color.textPrimary)
                .fixedSize(horizontal: false, vertical: true)
            Text(verbatim: item.isPlanOnly
                ? "\(item.periodLabel) · \(item.statusLabel) · " + AppLocale.string("Hors budget")
                : "\(item.periodLabel) · \(item.statusLabel)")
                .font(PulpeTypography.labelMedium)
                .foregroundStyle(Color.textTertiary)
                .fixedSize(horizontal: false, vertical: true)
            if item.isPartiallyRealized {
                Text(item.contextLabel(currency: currency))
                    .font(PulpeTypography.labelMedium)
                    .foregroundStyle(Color.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)
                    .sensitiveAmount()
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func plannedAmount(_ item: GoalWithdrawals.PlannedItem) -> some View {
        VStack(alignment: .trailing, spacing: DesignTokens.Spacing.xxs) {
            Text((-item.primaryAmount).asCurrency(currency))
                .font(PulpeTypography.amountMedium)
                .monospacedDigit()
                .foregroundStyle(Color.textPrimary)
                .fixedSize(horizontal: false, vertical: true)
                .sensitiveAmount()

            if let detail = item.primaryAmountDetail {
                Text(detail)
                    .font(PulpeTypography.labelMedium)
                    .foregroundStyle(Color.textSecondary)
                    .accessibilityHidden(true)
            }
        }
    }
}

struct GoalRealizedWithdrawalRow: View {
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    let withdrawal: SavingsGoalWithdrawal
    let currency: SupportedCurrency
    let onOpenBudget: (String) -> Void

    var body: some View { realizedRow(withdrawal) }

    private func realizedRow(_ withdrawal: SavingsGoalWithdrawal) -> some View {
        Button {
            onOpenBudget(withdrawal.budgetId)
        } label: {
            HStack(alignment: .firstTextBaseline, spacing: DesignTokens.Spacing.md) {
                if dynamicTypeSize.isAccessibilitySize {
                    VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
                        realizedDescription(withdrawal)
                        HStack(alignment: .firstTextBaseline, spacing: DesignTokens.Spacing.sm) {
                            Spacer(minLength: DesignTokens.Spacing.none)
                            realizedAmount(withdrawal)
                            WithdrawalChevron()
                        }
                    }
                } else {
                    realizedDescription(withdrawal)
                    Spacer(minLength: DesignTokens.Spacing.sm)
                    realizedAmount(withdrawal)
                    WithdrawalChevron()
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.vertical, DesignTokens.Spacing.md)
        }
        .plainPressedButtonStyle()
        .frame(minHeight: DesignTokens.TapTarget.minimum)
        .contentShape(.rect)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(realizedAccessibilityLabel(withdrawal))
        .accessibilityHint("Ouvre le budget")
    }

    private func realizedDescription(_ withdrawal: SavingsGoalWithdrawal) -> some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.xxs) {
            Text(withdrawal.name)
                .font(PulpeTypography.labelLarge)
                .foregroundStyle(Color.textPrimary)
                .fixedSize(horizontal: false, vertical: true)
            Text(realizedStatus(withdrawal))
                .font(PulpeTypography.labelMedium)
                .foregroundStyle(Color.textTertiary)
                .fixedSize(horizontal: false, vertical: true)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func realizedAmount(_ withdrawal: SavingsGoalWithdrawal) -> some View {
        Text((-withdrawal.amount).asCurrency(currency))
            .font(PulpeTypography.amountMedium)
            .monospacedDigit()
            .foregroundStyle(Color.textPrimary)
            .fixedSize(horizontal: false, vertical: true)
            .sensitiveAmount()
    }

    private func realizedStatus(_ withdrawal: SavingsGoalWithdrawal) -> String {
        "\(withdrawal.transactionDate.abbreviatedDateFormatted) · "
            + (withdrawal.checkedAt == nil ? AppLocale.string("À pointer") : AppLocale.string("Pointé"))
    }

    private func realizedAccessibilityLabel(_ withdrawal: SavingsGoalWithdrawal) -> String {
        let status = realizedStatus(withdrawal)
        let amount = withdrawal.amount.asCurrency(currency)
        return AppLocale.string("\(withdrawal.name), \(status), retrait réalisé \(amount)")
    }
}

/// The only glyph of a withdrawal row: it points at a destination, which no word on the
/// row already says. A row with nothing to open hides it rather than dropping it, so the
/// amounts keep the trailing edge they are read against.
private struct WithdrawalChevron: View {
    var body: some View {
        Image(systemName: "chevron.right")
            .font(PulpeTypography.caption)
            .foregroundStyle(Color.textTertiary)
            .accessibilityHidden(true)
    }
}
