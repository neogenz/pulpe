import SwiftUI

/// Mixed-list section for the budget detail screen (DM2.1.b.c5).
///
/// One grouped card of `BudgetLineMixedRow`s under a `SectionHeader`, inside the parent
/// scroll of `BudgetDetailsView` (The One Ledger Rule). Each item is a pre-shaped `LineItem` carrying its
/// `consumption` + `isSyncing` flag. The projection pipeline computes those
/// once per source change — the section never calls `BudgetFormulas.*` or
/// transforms collections.
struct BudgetMixedSection: View {
    let kind: TransactionKind
    let items: [BudgetDetailsScreenState.LineItem]
    let currency: SupportedCurrency
    /// Savings goal names keyed by goal id (PUL-12). Only the Épargne section
    /// resolves a name; other kinds never carry a `savingsGoalId`.
    let goalNamesById: [String: String]
    let tagNamesById: [String: String]
    /// Origin month name (M) of a savings-withdrawal repayment (PUL-292), = this
    /// budget's month − 1. Shown only on the M+1 "Remettre sur ton épargne" line.
    let savingsWithdrawalOriginMonthName: String?
    /// The one line whose disc carries the checking tip popover, if any.
    let checkingTipLineId: String?
    let onPrepareTogglePointed: (BudgetLine) -> Bool
    let onTap: (BudgetLine) -> Void
    let onTogglePointed: (BudgetLine) -> Void
    /// Header total, already summed by the projector (plus the report on Revenus).
    var total: Decimal = 0
    /// The month carried over, as a row of Revenus. Not a prévision: no ring, no pointing.
    var rollover: SectionRollover?
    /// Footer « Ajouter une prévision », preselecting this section's kind.
    var onAdd: (() -> Void)?

    init(
        kind: TransactionKind,
        items: [BudgetDetailsScreenState.LineItem],
        total: Decimal = 0,
        rollover: SectionRollover? = nil,
        onAdd: (() -> Void)? = nil,
        currency: SupportedCurrency,
        goalNamesById: [String: String] = [:],
        tagNamesById: [String: String] = [:],
        savingsWithdrawalOriginMonthName: String? = nil,
        checkingTipLineId: String? = nil,
        onPrepareTogglePointed: @escaping (BudgetLine) -> Bool = { _ in true },
        onTap: @escaping (BudgetLine) -> Void,
        onTogglePointed: @escaping (BudgetLine) -> Void
    ) {
        self.kind = kind
        self.items = items
        self.total = total
        self.rollover = rollover
        self.onAdd = onAdd
        self.currency = currency
        self.goalNamesById = goalNamesById
        self.tagNamesById = tagNamesById
        self.savingsWithdrawalOriginMonthName = savingsWithdrawalOriginMonthName
        self.checkingTipLineId = checkingTipLineId
        self.onPrepareTogglePointed = onPrepareTogglePointed
        self.onTap = onTap
        self.onTogglePointed = onTogglePointed
    }

    /// O(1) lookup of the linked goal's name for a line, or `nil` when the line
    /// isn't tagged or the goal cache hasn't resolved the id yet.
    private func goalName(for line: BudgetLine) -> String? {
        guard let id = line.savingsGoalId else { return nil }
        return goalNamesById[id]
    }

    private var headerTitle: String {
        switch kind {
        case .income: AppLocale.string("Revenus")
        case .saving: AppLocale.string("Épargne")
        case .expense: AppLocale.string("Dépenses")
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
            SectionHeader(title: headerTitle, trailingAmount: total.asAmount(for: currency))

            VStack(spacing: 0) {
                ForEach(items) { item in
                    if item.id != items.first?.id {
                        Divider().padding(.leading, DesignTokens.ListRow.dividerInset)
                    }
                    BudgetLineMixedRow(
                        line: item.line,
                        consumption: item.consumption,
                        isSyncing: item.isSyncing,
                        currency: currency,
                        savingsGoalName: goalName(for: item.line),
                        tagNames: TagChips.names(for: item.line.tagIds, namesById: tagNamesById),
                        savingsWithdrawalOriginMonthName: savingsWithdrawalOriginMonthName,
                        showsCheckingTip: item.line.id == checkingTipLineId,
                        onPrepareTogglePointed: { onPrepareTogglePointed(item.line) },
                        onTap: { onTap(item.line) },
                        onTogglePointed: { onTogglePointed(item.line) }
                    )
                    .transition(.asymmetric(
                        insertion: .opacity.combined(with: .move(edge: .leading)),
                        removal: .opacity.combined(
                            with: .scale(scale: DesignTokens.Animation.settleScale)
                        )
                    ))
                }
                if let rollover {
                    if !items.isEmpty { Divider().padding(.leading, DesignTokens.ListRow.dividerInset) }
                    SectionRolloverRow(rollover: rollover, currency: currency)
                }
                if let onAdd {
                    Divider().padding(.leading, DesignTokens.ListRow.dividerInset)
                    SectionAddRow(title: AppLocale.string("Ajouter une prévision"), action: onAdd)
                        .accessibilityIdentifier("budgetSectionAdd-\(kind.rawValue)")
                }
            }
            .padding(.horizontal, DesignTokens.Spacing.lg)
            .pulpeRowCard()
        }
        .padding(.horizontal, DesignTokens.Spacing.lg)
        .padding(.top, DesignTokens.Spacing.xxl)
    }
}

// MARK: - Report row

/// The amount the previous month left, carried into this one.
struct SectionRollover: Equatable {
    let previousMonth: Int
    let amount: Decimal
    var onTap: (() -> Void)?

    static func == (lhs: Self, rhs: Self) -> Bool {
        lhs.previousMonth == rhs.previousMonth && lhs.amount == rhs.amount
    }
}

private struct SectionRolloverRow: View {
    let rollover: SectionRollover
    let currency: SupportedCurrency

    private var amountText: String {
        let rounded = rollover.amount.rounded(2)
        return rounded > 0 ? "+\(rounded.asAmount(for: currency))" : rounded.asAmount(for: currency)
    }

    var body: some View {
        Button {
            rollover.onTap?()
        } label: {
            HStack(spacing: DesignTokens.Spacing.md) {
                Image(systemName: "arrow.uturn.backward")
                    .font(PulpeTypography.metricMini)
                    .foregroundStyle(Color.textSecondary)
                    .frame(width: DesignTokens.Checkbox.size, height: DesignTokens.Checkbox.size)
                    .background(Color.sunk, in: Circle())
                    .frame(width: DesignTokens.TapTarget.minimum)
                    .accessibilityHidden(true)

                VStack(alignment: .leading, spacing: DesignTokens.Spacing.dividerGap) {
                    Text(ReportWording.reportTitle(of: rollover.previousMonth))
                        .font(PulpeTypography.rowTitle)
                        .foregroundStyle(Color.textPrimary)
                    Text("Ce qu'il te restait fin \(Formatters.monthNameInText(for: rollover.previousMonth))")
                        .font(PulpeTypography.captionRegular)
                        .foregroundStyle(Color.textSecondary)
                }
                .frame(maxWidth: .infinity, alignment: .leading)

                Text(amountText)
                    .font(PulpeTypography.rowAmount)
                    .foregroundStyle(Color.textPrimary)
                    .lineLimit(1)
                    .minimumScaleFactor(DesignTokens.TextScale.compact)
                    .layoutPriority(1)
                    .sensitiveAmount()

                if rollover.onTap != nil { RowChevron() }
            }
            .padding(.vertical, DesignTokens.ListRow.verticalPadding + DesignTokens.Spacing.xxs)
            .frame(maxWidth: .infinity, minHeight: DesignTokens.ListRow.minHeight, alignment: .leading)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("budgetRolloverRow")
    }
}

// MARK: - Previews

private extension BudgetLine {
    static func mixedSectionPreview(
        id: String = UUID().uuidString,
        name: String,
        amount: Decimal,
        kind: TransactionKind,
        recurrence: TransactionRecurrence = .fixed,
        isChecked: Bool = false
    ) -> BudgetLine {
        BudgetLine(
            id: id,
            budgetId: "preview-budget",
            templateLineId: nil,
            savingsGoalId: nil,
            name: name,
            amount: amount,
            kind: kind,
            recurrence: recurrence,
            isManuallyAdjusted: false,
            checkedAt: isChecked ? Date() : nil,
            createdAt: Date(),
            updatedAt: Date()
        )
    }

    /// Shapes a list of preview lines into the LineItem shape consumed by the
    /// migrated `BudgetMixedSection`. Mirrors what the projector does at runtime
    /// but uses a literal zero `Consumption` so previews stay compliant with
    /// the `no_formula_in_view_body` lint rule.
    static func previewItems(_ lines: [BudgetLine]) -> [BudgetDetailsScreenState.LineItem] {
        lines.map { line in
            BudgetDetailsScreenState.LineItem(
                line: line,
                consumption: BudgetFormulas.Consumption(
                    allocated: 0,
                    available: line.amount,
                    percentage: 0
                ),
                isSyncing: false
            )
        }
    }
}

#Preview("Mixed section — 3 kinds") {
    let income = [
        BudgetLine.mixedSectionPreview(name: "Salaire", amount: 7500, kind: .income),
        BudgetLine.mixedSectionPreview(name: "Freelance", amount: 800, kind: .income),
    ]
    let savings = [
        BudgetLine.mixedSectionPreview(name: "Épargne du mois", amount: 600, kind: .saving),
    ]
    let expenses = [
        BudgetLine.mixedSectionPreview(name: "Loyer", amount: 2100, kind: .expense),
        BudgetLine.mixedSectionPreview(name: "Téléphone", amount: 100, kind: .expense),
        BudgetLine.mixedSectionPreview(name: "Courses", amount: 800, kind: .expense),
        BudgetLine.mixedSectionPreview(name: "Sorties & loisirs", amount: 300, kind: .expense),
        BudgetLine.mixedSectionPreview(name: "Transports", amount: 150, kind: .expense),
    ]

    return ScrollView {
        BudgetMixedSection(
            kind: .income,
            items: BudgetLine.previewItems(income),
            currency: .chf,
            onTap: { _ in },
            onTogglePointed: { _ in }
        )
        BudgetMixedSection(
            kind: .saving,
            items: BudgetLine.previewItems(savings),
            currency: .chf,
            onTap: { _ in },
            onTogglePointed: { _ in }
        )
        BudgetMixedSection(
            kind: .expense,
            items: BudgetLine.previewItems(expenses),
            currency: .chf,
            onTap: { _ in },
            onTogglePointed: { _ in }
        )
    }
    .pulpeBackground()
}
