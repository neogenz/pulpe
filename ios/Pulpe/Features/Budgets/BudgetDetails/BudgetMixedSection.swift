import SwiftUI
import TipKit

/// Mixed-list section for the budget detail screen (DM2.1.b.c5).
///
/// Hosts `BudgetLineMixedRow` cards inside the parent `List` from
/// `BudgetDetailsView`. Replaces `BudgetSection` for that screen only —
/// `BudgetSection` is still used elsewhere (CurrentMonth, PreviousBudgetSheet).
///
/// Spec: `Pulpe - Règles métier UX-UI` §02 — section header is a short word
/// followed by " · N" (count). No totals, no collapsibility, no swipe actions.
/// Edit/delete live in `BudgetLineDetailSheet`'s header `Menu`.
struct BudgetMixedSection: View {
    let kind: TransactionKind
    let items: [BudgetLine]
    let transactions: [Transaction]
    let syncingIds: Set<String>
    let onTap: (BudgetLine) -> Void
    let onTogglePointed: (BudgetLine) -> Void
    var tip: (any Tip)?

    init(
        kind: TransactionKind,
        items: [BudgetLine],
        transactions: [Transaction],
        syncingIds: Set<String>,
        onTap: @escaping (BudgetLine) -> Void,
        onTogglePointed: @escaping (BudgetLine) -> Void,
        tip: (any Tip)? = nil
    ) {
        self.kind = kind
        self.items = items
        self.transactions = transactions
        self.syncingIds = syncingIds
        self.onTap = onTap
        self.onTogglePointed = onTogglePointed
        self.tip = tip
    }

    private var headerTitle: String {
        switch kind {
        case .income: "Revenus"
        case .saving: "Épargne"
        case .expense: "Dépenses"
        }
    }

    var body: some View {
        Section {
            if let tip {
                TipView(tip)
                    .listRowCustomStyled(insets: EdgeInsets())
            }

            ForEach(items, id: \.id) { item in
                BudgetLineMixedRow(
                    line: item,
                    consumption: BudgetFormulas.calculateConsumption(
                        for: item,
                        transactions: transactions
                    ),
                    isSyncing: syncingIds.contains(item.id),
                    onTap: { onTap(item) },
                    onTogglePointed: { onTogglePointed(item) }
                )
                .listRowCustomStyled(insets: EdgeInsets())
            }
        } header: {
            HStack(spacing: DesignTokens.Spacing.xxs) {
                Text(headerTitle)
                    .font(PulpeTypography.headline)
                    .foregroundStyle(Color.textPrimary)
                Text(" · \(items.count)")
                    .font(PulpeTypography.subheadline)
                    .foregroundStyle(Color.textSecondary)
                Spacer()
            }
            .textCase(nil)
            .accessibilityElement(children: .combine)
            .accessibilityAddTraits(.isHeader)
            .accessibilityLabel("\(headerTitle), \(items.count)")
        }
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

    return List {
        BudgetMixedSection(
            kind: .income,
            items: income,
            transactions: [],
            syncingIds: [],
            onTap: { _ in },
            onTogglePointed: { _ in }
        )
        BudgetMixedSection(
            kind: .saving,
            items: savings,
            transactions: [],
            syncingIds: [],
            onTap: { _ in },
            onTogglePointed: { _ in }
        )
        BudgetMixedSection(
            kind: .expense,
            items: expenses,
            transactions: [],
            syncingIds: [],
            onTap: { _ in },
            onTogglePointed: { _ in }
        )
    }
    .listStyle(.insetGrouped)
    .listRowSpacing(DesignTokens.Spacing.md)
    .listSectionSpacing(DesignTokens.Spacing.xxl)
    .scrollContentBackground(.hidden)
    .pulpeBackground()
    .environment(UserSettingsStore())
}
