import Foundation

/// Which prévisions a movement can be filed under, and which one to suggest first.
/// The backend refuses a different kind (`validateKindMatchesLine`), a rollover line and an
/// announced withdrawal whose goal is gone, so none of them is ever offered.
enum MovementLineChoices {
    /// The Ajouter-toutes sections. `margin` has room left, `over` is past its forecast,
    /// `others` is everything already pointed.
    struct Sections: Equatable {
        let margin: [BudgetLine]
        let over: [BudgetLine]
        let others: [BudgetLine]

        var all: [BudgetLine] { margin + over + others }
    }

    static func eligible(lines: [BudgetLine], kind: TransactionKind) -> [BudgetLine] {
        lines.filter {
            $0.kind == kind
                && !$0.isVirtualRollover
                && !($0.sourceSavingsGoalId == nil && $0.sourceSavingsGoalName != nil)
        }
    }

    /// No model says which line is the likely one, so: the line of a same-name movement
    /// this month, else the unpointed line with the most left.
    static func suggested(
        lines: [BudgetLine],
        transactions: [Transaction],
        kind: TransactionKind,
        name: String
    ) -> BudgetLine? {
        let candidates = eligible(lines: lines, kind: kind)
        let typed = name.trimmingCharacters(in: .whitespaces).lowercased()
        if !typed.isEmpty,
           let lineId = transactions.first(where: { $0.kind == kind && $0.name.lowercased() == typed })?.budgetLineId,
           let match = candidates.first(where: { $0.id == lineId }) {
            return match
        }
        return candidates
            .filter { !$0.isChecked }
            .map { ($0, BudgetFormulas.calculateConsumption(for: $0, transactions: transactions).available) }
            .filter { $0.1 > 0 }
            .max { $0.1 < $1.1 }?.0
    }

    static func sections(
        lines: [BudgetLine],
        transactions: [Transaction],
        kind: TransactionKind
    ) -> Sections {
        var margin: [BudgetLine] = []
        var over: [BudgetLine] = []
        var others: [BudgetLine] = []
        for line in eligible(lines: lines, kind: kind) {
            let consumption = BudgetFormulas.calculateConsumption(for: line, transactions: transactions)
            if consumption.isOverBudget {
                over.append(line)
            } else if !line.isChecked, consumption.available > 0 {
                margin.append(line)
            } else {
                others.append(line)
            }
        }
        return Sections(margin: margin, over: over, others: others)
    }
}
