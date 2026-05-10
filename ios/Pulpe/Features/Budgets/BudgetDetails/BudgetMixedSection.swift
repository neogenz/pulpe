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
///
/// Each item is a pre-shaped `LineItem` carrying its `consumption` + `isSyncing`
/// flag. The projection pipeline computes those once per source change — the
/// section never calls `BudgetFormulas.*` or transforms collections.
struct BudgetMixedSection: View {
    let kind: TransactionKind
    let items: [BudgetDetailsScreenState.LineItem]
    let onTap: (BudgetLine) -> Void
    let onTogglePointed: (BudgetLine) -> Void
    var tip: (any Tip)?

    init(
        kind: TransactionKind,
        items: [BudgetDetailsScreenState.LineItem],
        onTap: @escaping (BudgetLine) -> Void,
        onTogglePointed: @escaping (BudgetLine) -> Void,
        tip: (any Tip)? = nil
    ) {
        self.kind = kind
        self.items = items
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
        // Plain VStack so the section can live inside a ScrollView/LazyVStack
        // and let the whole page scroll as one unit. Each row's card chrome is
        // self-contained (`BudgetLineMixedRow` styles its own surface), so the
        // section just stacks header + tip + rows with consistent horizontal
        // insets matching the design system.
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: DesignTokens.Spacing.xxs) {
                Text(headerTitle)
                    .font(PulpeTypography.headline)
                    .foregroundStyle(Color.textPrimary)
                Text(" · \(items.count)")
                    .font(PulpeTypography.subheadline)
                    .foregroundStyle(Color.textSecondary)
                Spacer()
            }
            .accessibilityElement(children: .combine)
            .accessibilityAddTraits(.isHeader)
            .accessibilityLabel("\(headerTitle), \(items.count)")
            .padding(.horizontal, DesignTokens.Spacing.lg)
            .padding(.top, DesignTokens.Spacing.lg)
            .padding(.bottom, DesignTokens.Spacing.sm)

            if let tip {
                TipView(tip)
                    .padding(.horizontal, DesignTokens.Spacing.lg)
                    .padding(.bottom, DesignTokens.Spacing.md)
            }

            ForEach(items) { item in
                BudgetLineMixedRow(
                    line: item.line,
                    consumption: item.consumption,
                    isSyncing: item.isSyncing,
                    onTap: { onTap(item.line) },
                    onTogglePointed: { onTogglePointed(item.line) }
                )
                .padding(.horizontal, DesignTokens.Spacing.lg)
                .padding(.bottom, DesignTokens.Spacing.md)
                .transition(.asymmetric(
                    insertion: .opacity.combined(with: .move(edge: .leading)),
                    removal: .opacity.combined(with: .scale(scale: 0.95))
                ))
            }
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

    return List {
        BudgetMixedSection(
            kind: .income,
            items: BudgetLine.previewItems(income),
            onTap: { _ in },
            onTogglePointed: { _ in }
        )
        BudgetMixedSection(
            kind: .saving,
            items: BudgetLine.previewItems(savings),
            onTap: { _ in },
            onTogglePointed: { _ in }
        )
        BudgetMixedSection(
            kind: .expense,
            items: BudgetLine.previewItems(expenses),
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
