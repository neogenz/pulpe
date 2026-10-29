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

/// One month of the yearly ledger (The One Ledger Rule): month name, its dates,
/// the amount block and a chevron. Current, past and future months share the row; only
/// the ink changes.
struct BudgetMonthRow: View {
    let budget: BudgetSparse
    var periodLabel: String?
    var isCurrent: Bool = false
    var isPast: Bool = false
    /// Present when the row picks the month shown beside the list instead of pushing it.
    var selection: Selection?
    let action: () -> Void

    struct Selection {
        let isSelected: Bool
    }

    @State private var tapTrigger = false
    @Environment(\.amountsHidden) private var amountsHidden
    @Environment(UserSettingsStore.self) private var userSettingsStore

    private var monthName: String {
        Formatters.monthName(for: budget.month ?? 0)
    }

    /// The block the row sits in names the month in progress; the ink only steps back
    /// for a month that is over.
    private var titleColor: Color {
        isPast ? .textSecondary : .textPrimary
    }

    /// How much of the month's money is already planned out, as the budget page's hero
    /// measures it: expenses against income plus what came over from the month before.
    private var usage: Double {
        let available = (budget.totalIncome ?? 0) + (budget.rollover ?? 0)
        guard available > 0 else { return 0 }
        return Double(truncating: ((budget.totalExpenses ?? 0) / available) as NSDecimalNumber)
    }

    /// The block a row sits in already says « en cours » or « clos »; the caption keeps
    /// what the block cannot: the dates a month spans.
    private var caption: String {
        isPast ? "" : periodLabel ?? ""
    }

    static func accessibilityIdentifier(for budget: BudgetSparse) -> String {
        "budgetMonthRow-\(budget.id)"
    }

    static func accessibilityTraits(isCurrent: Bool) -> AccessibilityTraits {
        isCurrent ? [.isButton, .isSelected] : .isButton
    }

    /// Beside the month it opens, the row marks what is on screen rather than the calendar.
    private var traits: AccessibilityTraits {
        // Beside the month, `selectsBesidePane` already carries the button and selected traits.
        selection == nil ? Self.accessibilityTraits(isCurrent: isCurrent) : []
    }

    private var accessibilityStatus: String {
        isCurrent ? ", " + AppLocale.string("en cours") : (isPast ? ", " + AppLocale.string("clos") : "")
    }

    var body: some View {
        if let selection {
            rowContent
                .selectsBesidePane(isSelected: selection.isSelected, action: activate)
                .modifier(accessibility)
        } else {
            Button(action: activate) { rowContent }
                .buttonStyle(.plain)
                .modifier(accessibility)
        }
    }

    private func activate() {
        tapTrigger.toggle()
        action()
    }

    private var rowContent: some View {
        HStack(spacing: DesignTokens.Spacing.sm) {
            VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
                HStack(spacing: DesignTokens.Spacing.sm) {
                    VStack(alignment: .leading, spacing: DesignTokens.Spacing.xxs) {
                        Text(monthName)
                            .font(PulpeTypography.listRowTitle)
                            .foregroundStyle(titleColor)
                            // A month name never hyphenates: « Sep-tembre » stops reading as a date.
                            .lineLimit(1)
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
                    .layoutPriority(1)
                }
                // The month in progress is the one still moving: its card carries the bar
                // the budget page opens on.
                if isCurrent {
                    usageBar
                }
            }
            // A chevron promises a push; beside the month, the row only selects.
            if selection == nil {
                Image(systemName: "chevron.right")
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(Color.textTertiary)
                    .accessibilityHidden(true)
            }
        }
        .padding(.vertical, DesignTokens.Spacing.md)
        .frame(maxWidth: .infinity, minHeight: DesignTokens.ListRow.minHeight, alignment: .leading)
        .contentShape(Rectangle())
    }

    private var usageBar: some View {
        HStack(spacing: DesignTokens.Spacing.sm) {
            ZStack {
                Rectangle()
                    .fill(Color.progressTrack)
                ProgressBarShape(progress: CGFloat(min(max(usage, 0), 1)))
                    .fill(budget.emotionState.color)
            }
            .frame(height: DesignTokens.ProgressBar.height)
            .clipShape(.rect(cornerRadius: DesignTokens.CornerRadius.progressBar))

            Text("\(Int(usage * 100))%")
                .font(PulpeTypography.caption)
                .foregroundStyle(Color.textSecondary)
                .monospacedDigit()
        }
        .accessibilityHidden(true)
    }

    private var accessibility: RowAccessibility {
        RowAccessibility(
            label: monthName
                + accessibilityStatus
                + ", "
                + availabilityLabel(
                    remaining: budget.remaining,
                    amountsHidden: amountsHidden,
                    currency: userSettingsStore.currency
                ),
            traits: traits,
            hint: selection == nil ? "Appuie pour voir les détails" : "Appuie pour l'afficher à côté",
            identifier: Self.accessibilityIdentifier(for: budget),
            tapTrigger: tapTrigger
        )
    }
}

private struct RowAccessibility: ViewModifier {
    let label: String
    let traits: AccessibilityTraits
    let hint: LocalizedStringKey
    let identifier: String
    let tapTrigger: Bool

    func body(content: Content) -> some View {
        content
            .sensoryFeedback(.selection, trigger: tapTrigger)
            .accessibilityLabel(label)
            .accessibilityHint(hint)
            .accessibilityAddTraits(traits)
            .accessibilityIdentifier(identifier)
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
                let color: Color = isPast ? .textSecondary : emotionColor
                // The budget page's amount style, the currency set small after it; adaptive decimals, as
                // a month card's remaining carries a state (webapp-currency-formatting rule).
                HStack(alignment: .firstTextBaseline, spacing: DesignTokens.Spacing.xxs) {
                    Text("\(amount > 0 ? "+" : "")\(amount.asAdaptiveAmount(for: userSettingsStore.currency))")
                        .font(PulpeTypography.amountCard)
                        .monospacedDigit()
                        .foregroundStyle(color)
                    Text(userSettingsStore.currency.symbol)
                        .font(PulpeTypography.metricMini)
                        .foregroundStyle(color)
                        .opacity(DesignTokens.Opacity.pressed)
                }
                // The month name wraps first: an amount split over two lines misreads.
                .lineLimit(1)
                .sensitiveAmount()
                // « Potentiel » and « Ajustement » say what can still be done with the
                // money; a closed month only keeps its figure, on one line.
                if !isPast {
                    Text(amountLabel)
                        .font(PulpeTypography.caption)
                        .foregroundStyle(Color.textSecondary)
                }
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
