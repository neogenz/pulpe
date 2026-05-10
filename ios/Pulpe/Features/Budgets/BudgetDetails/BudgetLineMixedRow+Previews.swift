import SwiftUI

// MARK: - Previews

private extension BudgetLine {
    static func preview(
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

private struct BudgetLineMixedRowPreviewHost: View {
    let cases: [(line: BudgetLine, consumption: BudgetFormulas.Consumption)]

    var body: some View {
        ScrollView {
            VStack(spacing: DesignTokens.Spacing.sm) {
                ForEach(Array(cases.enumerated()), id: \.offset) { _, item in
                    BudgetLineMixedRow(
                        line: item.line,
                        consumption: item.consumption,
                        isSyncing: false,
                        currency: .chf,
                        onTap: {},
                        onTogglePointed: {}
                    )
                }
            }
            .padding(DesignTokens.Spacing.lg)
        }
        .background(Color.appBackground)
    }
}

#Preview("Expense — empty (no real)") {
    let line = BudgetLine.preview(name: "Téléphone", amount: 100, kind: .expense)
    // Literal zero consumption — projector pre-computes this at runtime; previews
    // mock it so the file stays compliant with `no_formula_in_view_body`.
    let consumption = BudgetFormulas.Consumption(allocated: 0, available: line.amount, percentage: 0)
    return BudgetLineMixedRowPreviewHost(cases: [(line, consumption)])
}

#Preview("Expense — partial (260 CHF restant)") {
    let line = BudgetLine.preview(name: "Courses", amount: 800, kind: .expense)
    let consumption = BudgetFormulas.Consumption(allocated: 540, available: 260, percentage: 67.5)
    return BudgetLineMixedRowPreviewHost(cases: [(line, consumption)])
}

#Preview("Expense — over budget") {
    let line = BudgetLine.preview(name: "Sorties & loisirs", amount: 300, kind: .expense)
    let consumption = BudgetFormulas.Consumption(allocated: 320, available: -20, percentage: 106.7)
    return BudgetLineMixedRowPreviewHost(cases: [(line, consumption)])
}

#Preview("Income — partially received") {
    let line = BudgetLine.preview(name: "Salaire", amount: 7500, kind: .income)
    let consumption = BudgetFormulas.Consumption(allocated: 3000, available: 4500, percentage: 40)
    return BudgetLineMixedRowPreviewHost(cases: [(line, consumption)])
}

#Preview("Saving — fully transferred") {
    let line = BudgetLine.preview(name: "Épargne du mois", amount: 600, kind: .saving)
    let consumption = BudgetFormulas.Consumption(allocated: 600, available: 0, percentage: 100)
    return BudgetLineMixedRowPreviewHost(cases: [(line, consumption)])
}

#Preview("Pointed (dimmed)") {
    let line = BudgetLine.preview(name: "Loyer", amount: 2100, kind: .expense, isChecked: true)
    let consumption = BudgetFormulas.Consumption(allocated: 2100, available: 0, percentage: 100)
    return BudgetLineMixedRowPreviewHost(cases: [(line, consumption)])
}

#Preview("Mixed list") {
    let income = BudgetLine.preview(name: "Salaire", amount: 7500, kind: .income)
    let incomeConsumption = BudgetFormulas.Consumption(allocated: 7500, available: 0, percentage: 100)

    let saving = BudgetLine.preview(name: "Épargne du mois", amount: 600, kind: .saving)
    let savingConsumption = BudgetFormulas.Consumption(allocated: 600, available: 0, percentage: 100)

    let phone = BudgetLine.preview(name: "Téléphone", amount: 100, kind: .expense)
    // Literal zero consumption — projector pre-computes at runtime; previews mock it.
    let phoneConsumption = BudgetFormulas.Consumption(allocated: 0, available: phone.amount, percentage: 0)

    let groceries = BudgetLine.preview(name: "Courses", amount: 800, kind: .expense)
    let groceriesConsumption = BudgetFormulas.Consumption(allocated: 540, available: 260, percentage: 67.5)

    let leisure = BudgetLine.preview(name: "Sorties & loisirs", amount: 300, kind: .expense)
    let leisureConsumption = BudgetFormulas.Consumption(allocated: 320, available: -20, percentage: 106.7)

    return BudgetLineMixedRowPreviewHost(cases: [
        (income, incomeConsumption),
        (saving, savingConsumption),
        (phone, phoneConsumption),
        (groceries, groceriesConsumption),
        (leisure, leisureConsumption),
    ])
}
