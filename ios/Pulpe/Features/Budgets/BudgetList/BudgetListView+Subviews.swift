import SwiftUI

/// One whole-sentence key per variant: "disponible non défini" is a sentence, not
/// "disponible" glued to "non défini": word order and agreement differ per language.
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

/// One month of the yearly ledger (V2 `row`): month name, its dates, the amount in ink
/// (ocre when the month ends below zero) and a chevron. The month in progress adds the
/// bar of what is already planned out.
struct BudgetMonthRow: View {
    enum Role {
        case current, upcoming, closed

        /// Under the amount: what the figure is. A closed month only keeps its figure.
        var amountCaption: String? {
            switch self {
            case .current: AppLocale.string("disponible")
            case .upcoming: AppLocale.string("disponible prévu")
            case .closed: nil
            }
        }
    }

    let budget: BudgetSparse
    var periodLabel: String?
    var role: Role = .upcoming
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
        Formatters.monthName(for: budget.month ?? 0).capitalized
    }

    static func accessibilityIdentifier(for budget: BudgetSparse) -> String {
        "budgetMonthRow-\(budget.id)"
    }

    static func accessibilityTraits(isCurrent: Bool) -> AccessibilityTraits {
        isCurrent ? [.isButton, .isSelected] : .isButton
    }

    /// Beside the month, `selectsBesidePane` already carries the button and selected traits.
    private var traits: AccessibilityTraits {
        selection == nil ? Self.accessibilityTraits(isCurrent: role == .current) : []
    }

    private var accessibilityStatus: String {
        switch role {
        case .current: ", " + AppLocale.string("en cours")
        case .closed: ", " + AppLocale.string("clos")
        case .upcoming: ""
        }
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
        HStack(spacing: DesignTokens.Spacing.md) {
            VStack(alignment: .leading, spacing: DesignTokens.Spacing.xxs) {
                Text(monthName)
                    .font(role == .closed ? PulpeTypography.rowTitleRegular : PulpeTypography.rowTitle)
                    .foregroundStyle(Color.textPrimary)
                    // A month name never hyphenates: « Sep-tembre » stops reading as a date.
                    .lineLimit(1)
                if let periodLabel {
                    Text(periodLabel)
                        .font(PulpeTypography.captionRegular)
                        .foregroundStyle(Color.textSecondary)
                }
                if role == .current {
                    usageBar
                        .padding(.top, DesignTokens.Spacing.xs)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            amountBlock
                .layoutPriority(1)

            // A chevron promises a push; beside the month, the row only selects.
            if selection == nil {
                RowChevron()
            }
        }
        .padding(.vertical, DesignTokens.ListRow.verticalPadding + DesignTokens.Spacing.xxs)
        .frame(maxWidth: .infinity, minHeight: DesignTokens.ListRow.minHeight, alignment: .leading)
        .contentShape(Rectangle())
    }

    @ViewBuilder
    private var amountBlock: some View {
        if let remaining = budget.remaining {
            VStack(alignment: .trailing, spacing: DesignTokens.Spacing.xxs) {
                Text(verbatim: remaining.rounded(2).asAmount(for: userSettingsStore.currency))
                    .font(PulpeTypography.rowAmount)
                    .monospacedDigit()
                    .foregroundStyle(remaining.rounded(2) < 0 ? Color.financialOverBudget : Color.textPrimary)
                    // The month name wraps first: an amount split over two lines misreads.
                    .lineLimit(1)
                    .sensitiveAmount()
                if let caption = role.amountCaption {
                    Text(caption)
                        .font(PulpeTypography.captionRegular)
                        .foregroundStyle(Color.textSecondary)
                }
            }
        }
    }

    private var usageBar: some View {
        let usage = BudgetListPresentation.usage(of: budget)
        return HStack(spacing: DesignTokens.Spacing.sm) {
            SegmentedBar(
                segments: [.init(
                    fraction: min(max(usage, 0), 1),
                    color: usage > 1 ? .financialOverBudget : .textPrimary
                )],
                trackColor: .sunk,
                height: DesignTokens.ProgressBar.height
            )
            .frame(height: DesignTokens.ProgressBar.height)
            Text(BudgetListPresentation.usageLabel(usage))
                .font(PulpeTypography.labelMedium)
                .foregroundStyle(Color.textSecondary)
                .monospacedDigit()
                .lineLimit(1)
                .layoutPriority(1)
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

// MARK: - Next Free Month

/// Where a month gets created from the list: the next month without a budget, created in
/// one tap, and the way to plan several at once. Replaces the toolbar's + and calendar,
/// since the global + opens « Ajouter ».
struct NextFreeMonthCard: View {
    let month: (month: Int, year: Int)?
    let onCreate: () -> Void
    let onPlan: () -> Void

    private var monthName: String? {
        month.map { BudgetListPresentation.monthYear(BudgetPeriod(month: $0.month, year: $0.year)) }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.md) {
            if let monthName {
                Text("Prochain mois libre : \(monthName)")
                    .font(PulpeTypography.rowTitle)
                    .foregroundStyle(Color.textPrimary)
                Button(action: onCreate) {
                    Text("Créer \(monthName)")
                        .frame(maxWidth: .infinity)
                }
                .secondaryButtonStyle(size: .small)
                    .accessibilityIdentifier("budgetListCreateNextMonth")
            }
            Button("Planifier plusieurs mois", action: onPlan)
                .tertiaryButtonStyle()
                .accessibilityIdentifier("budgetListPlanSeveral")
        }
        .padding(DesignTokens.Spacing.lg)
        .frame(maxWidth: .infinity, alignment: .leading)
        .pulpeSurfaceCard()
    }
}
