import SwiftUI

struct MonthDropdownMenu: View {
    let budgets: [BudgetSparse]
    let currentBudgetId: String
    let currentMonthYear: String
    let onSelect: (String) -> Void

    @State private var selectionTrigger = false

    var body: some View {
        Menu {
            pickerContent
        } label: {
            labelContent
        }
        .sensoryFeedback(.selection, trigger: selectionTrigger)
        .accessibilityLabel("Sélectionner un mois")
        .onChange(of: currentBudgetId) { selectionTrigger.toggle() }
    }

    private var pickerContent: some View {
        Picker("", selection: Binding(
            get: { currentBudgetId },
            set: { id in
                guard id != currentBudgetId else { return }
                onSelect(id)
            }
        )) {
            ForEach(currentYearBudgets) { budget in
                Text(monthLabel(for: budget))
                    .tag(budget.id)
            }
        }
    }

    private var labelContent: some View {
        HStack(spacing: DesignTokens.Spacing.xs) {
            Text(currentMonthYear)
                .font(PulpeTypography.headline)
                .lineLimit(1)
            Image(systemName: "chevron.up.chevron.down")
                .font(.caption2.weight(.semibold))
                .foregroundStyle(.secondary)
        }
        .padding(.horizontal, DesignTokens.Spacing.lg)
        .padding(.vertical, 10)
        .modifier(GlassBackgroundModifier())
    }

    private var currentYear: Int? {
        budgets.first(where: { $0.id == currentBudgetId })?.year
    }

    private var currentYearBudgets: [BudgetSparse] {
        guard let year = currentYear else { return [] }
        return budgets
            .filter { $0.year == year && $0.month != nil }
            .sorted { ($0.month ?? 0) < ($1.month ?? 0) }
    }

    private func monthLabel(for budget: BudgetSparse) -> String {
        guard let month = budget.month, let year = budget.year else { return "—" }
        var components = DateComponents()
        components.month = month
        components.year = year
        components.day = 1
        guard let date = Calendar.current.date(from: components) else {
            return "\(month)"
        }
        return Formatters.month.string(from: date).capitalized
    }
}
