import SwiftUI

/// One whole-sentence key per variant: "disponible non défini" is a sentence, not
/// "disponible" glued to "non défini" — word order and agreement differ per language.
private func availabilityLabel(
    remaining: Decimal?,
    amountsHidden: Bool,
    currency: SupportedCurrency
) -> String {
    if amountsHidden { return AppLocale.string("montant masqué") }
    guard let remaining else { return AppLocale.string("disponible non défini") }
    return AppLocale.string("disponible \(remaining.rounded(2).asAdaptiveCurrency(currency))")
}

// MARK: - Budget Month Row

/// One month of the yearly ledger (The One Ledger Rule): month name, a status caption,
/// the amount block and a chevron. Current, past and future months share the row; only
/// the ink changes.
struct BudgetMonthRow: View {
    let budget: BudgetSparse
    var periodLabel: String?
    var isCurrent: Bool = false
    var isPast: Bool = false
    let action: () -> Void

    @State private var tapTrigger = false
    @Environment(\.amountsHidden) private var amountsHidden
    @Environment(UserSettingsStore.self) private var userSettingsStore

    private var monthName: String {
        Formatters.monthName(for: budget.month ?? 0)
    }

    private var titleColor: Color {
        if isCurrent { return .pulpePrimary }
        return isPast ? .textSecondary : .textPrimary
    }

    private var caption: String {
        if isCurrent { return AppLocale.string("en cours") }
        if isPast { return AppLocale.string("clos") }
        return periodLabel ?? ""
    }

    static func accessibilityIdentifier(for budget: BudgetSparse) -> String {
        "budgetMonthRow-\(budget.id)"
    }

    static func accessibilityTraits(isCurrent: Bool) -> AccessibilityTraits {
        isCurrent ? [.isButton, .isSelected] : .isButton
    }

    private var accessibilityStatus: String {
        isCurrent ? ", " + AppLocale.string("en cours") : (isPast ? ", " + AppLocale.string("clos") : "")
    }

    var body: some View {
        Button {
            tapTrigger.toggle()
            action()
        } label: {
            HStack(spacing: DesignTokens.Spacing.sm) {
                VStack(alignment: .leading, spacing: DesignTokens.Spacing.xxs) {
                    Text(monthName)
                        .font(PulpeTypography.listRowTitle)
                        .foregroundStyle(titleColor)
                    if !caption.isEmpty {
                        Text(caption)
                            .font(PulpeTypography.caption)
                            .foregroundStyle(Color.textSecondary)
                    }
                }
                Spacer(minLength: DesignTokens.Spacing.sm)
                BudgetAmountBlock(
                    remaining: budget.remaining,
                    emotionColor: budget.emotionState.color,
                    isPast: isPast
                )
                Image(systemName: "chevron.right")
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(Color.textTertiary)
                    .accessibilityHidden(true)
            }
            .padding(.vertical, DesignTokens.Spacing.md)
            .frame(maxWidth: .infinity, minHeight: DesignTokens.ListRow.minHeight, alignment: .leading)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .sensoryFeedback(.selection, trigger: tapTrigger)
        .accessibilityLabel(
            monthName
            + accessibilityStatus
            + ", "
            + availabilityLabel(
                remaining: budget.remaining,
                amountsHidden: amountsHidden,
                currency: userSettingsStore.currency
            )
        )
        .accessibilityHint("Appuie pour voir les détails")
        .accessibilityAddTraits(Self.accessibilityTraits(isCurrent: isCurrent))
        .accessibilityIdentifier(Self.accessibilityIdentifier(for: budget))
    }
}

// MARK: - Budget Amount Block (shared)

struct BudgetAmountBlock: View {
    let remaining: Decimal?
    let emotionColor: Color
    var isPast: Bool = false

    @Environment(UserSettingsStore.self) private var userSettingsStore

    private var roundedRemaining: Decimal { (remaining ?? 0).rounded(2) }

    private var amountLabel: String {
        roundedRemaining >= 0 ? AppLocale.string("Potentiel") : AppLocale.string("Ajustement")
    }

    var body: some View {
        VStack(alignment: .trailing, spacing: DesignTokens.Spacing.xxs) {
            if let remaining {
                let amount = remaining.rounded(2)
                Text("\(amount > 0 ? "+" : "")\(amount.asAdaptiveCurrency(userSettingsStore.currency))")
                    .font(PulpeTypography.listRowTitle)
                    .monospacedDigit()
                    .foregroundStyle(isPast ? .secondary : emotionColor)
                    .sensitiveAmount()
                Text(amountLabel)
                    .font(PulpeTypography.caption)
                    .foregroundStyle(Color.textSecondary)
            }
        }
    }
}

// MARK: - Next Month Row

/// Last row of the ledger: the next month without a budget and the text link that creates it.
struct NextMonthRow: View {
    let month: Int
    var adjustment: Decimal?
    let action: () -> Void

    @Environment(UserSettingsStore.self) private var userSettingsStore

    private var monthName: String {
        Formatters.monthName(for: month)
    }

    var body: some View {
        HStack(spacing: DesignTokens.Spacing.sm) {
            VStack(alignment: .leading, spacing: DesignTokens.Spacing.xxs) {
                Text(monthName)
                    .font(PulpeTypography.listRowTitle)
                    .foregroundStyle(Color.textPrimary)
                if let adjustment, adjustment.rounded(2) != 0 {
                    let projected = adjustment.rounded(2).asAdaptiveCurrency(userSettingsStore.currency)
                    Text(AppLocale.string("projeté \(projected)"))
                        .font(PulpeTypography.caption)
                        .foregroundStyle(Color.textSecondary)
                        .sensitiveAmount()
                }
            }
            Spacer(minLength: DesignTokens.Spacing.sm)
            Button(action: action) {
                Text("Créer le budget")
            }
            .textLinkButtonStyle()
            .accessibilityLabel("Créer un budget pour \(monthName)")
            .accessibilityIdentifier("nextMonthRow")
        }
        .padding(.vertical, DesignTokens.Spacing.md)
        .frame(maxWidth: .infinity, minHeight: DesignTokens.ListRow.minHeight, alignment: .leading)
    }
}
