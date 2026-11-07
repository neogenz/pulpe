import Foundation

/// The chips of the Mouvements page and the search box, as one pure rule: tests pin which
/// movements each of them keeps.
enum MovementsFilter: CaseIterable, Hashable {
    case all
    case unpointed
    case unplanned

    func keeps(_ transaction: Transaction) -> Bool {
        switch self {
        case .all: true
        case .unpointed: !transaction.isChecked
        case .unplanned: transaction.isFree
        }
    }

    func count(in transactions: [Transaction]) -> Int {
        transactions.filter(keeps).count
    }

    /// What survives the chip and the search. The search reads the movement's own name and the
    /// name of its prévision, ignoring case and accents.
    static func apply(
        _ filter: MovementsFilter,
        query: String,
        to transactions: [Transaction],
        lineNames: [String: String]
    ) -> [Transaction] {
        let needle = query.trimmingCharacters(in: .whitespaces)
        return transactions.filter { transaction in
            guard filter.keeps(transaction) else { return false }
            guard !needle.isEmpty else { return true }
            let haystacks = [transaction.name, transaction.budgetLineId.flatMap { lineNames[$0] } ?? ""]
            let options: String.CompareOptions = [.caseInsensitive, .diacriticInsensitive]
            return haystacks.contains { $0.range(of: needle, options: options) != nil }
        }
    }
}
