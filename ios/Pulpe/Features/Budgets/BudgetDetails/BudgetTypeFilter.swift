import SwiftUI

// MARK: - Checked Filter Option

/// État filter applied to budget items in the detail flow (cumulative AND with `BudgetLineKindFilter`).
/// Three states: `À pointer` / `Pointé` / `Tout voir`. Driven from the leading icon button on
/// the filter rail (tap cycles, long-press opens a context menu).
enum CheckedFilterOption: String, CaseIterable, Identifiable {
    case unchecked
    case checked
    case all
    /// Prévisions whose movements went past the planned amount.
    case over

    var id: String { rawValue }

    var label: String {
        switch self {
        case .unchecked: AppLocale.string("À pointer")
        case .checked: AppLocale.string("Pointé")
        case .all: AppLocale.string("Tout")
        case .over: AppLocale.string("Dépassées")
        }
    }
}

// MARK: - Type Filter Option

/// Type filter applied to the budget detail flow (cumulative AND with `CheckedFilterOption`).
/// Matches the v2 UnifiedFilter spec: `Tout / Revenus / Épargne / Dépenses`.
enum BudgetLineKindFilter: String, CaseIterable, Identifiable {
    case all
    case income
    case saving
    case expense

    var id: String { rawValue }

    var label: String {
        switch self {
        case .all: AppLocale.string("Tout")
        case .income: AppLocale.string("Revenus")
        case .saving: AppLocale.string("Épargne")
        case .expense: AppLocale.string("Dépenses")
        }
    }

    var accessibilityLabel: String {
        switch self {
        case .all: AppLocale.string("Afficher tous les types")
        case .income: AppLocale.string("Afficher uniquement les revenus")
        case .saving: AppLocale.string("Afficher uniquement l'épargne")
        case .expense: AppLocale.string("Afficher uniquement les dépenses")
        }
    }
}

// MARK: - Counts

/// Per-kind item counts displayed in the type pills.
/// Values are pre-computed by the view model so the filter is a pure presentation component.
struct BudgetLineKindCounts: Equatable {
    let all: Int
    let income: Int
    let saving: Int
    let expense: Int

    static let zero = BudgetLineKindCounts(all: 0, income: 0, saving: 0, expense: 0)

    func count(for kind: BudgetLineKindFilter) -> Int {
        switch kind {
        case .all: all
        case .income: income
        case .saving: saving
        case .expense: expense
        }
    }
}

/// Per-état item counts displayed in the leading icon's contextual menu.
/// Pre-computed by the view model AFTER the type filter so each option mirrors
/// "what tapping this would show" given the current type filter.
struct CheckedFilterCounts: Equatable {
    let unchecked: Int
    let checked: Int
    let all: Int
    var over = 0

    static let zero = CheckedFilterCounts(unchecked: 0, checked: 0, all: 0)

    func count(for option: CheckedFilterOption) -> Int {
        switch option {
        case .unchecked: unchecked
        case .checked: checked
        case .all: all
        case .over: over
        }
    }
}

// MARK: - Filter rail

/// "Tout / À pointer N / Dépassées N" (V2 `Budget-mois`). The kind filter lives in the
/// month menu. "Pointé" stays a stored option but has no chip of its own.
struct BudgetTypeFilter: View {
    @Binding var checked: CheckedFilterOption
    let counts: CheckedFilterCounts

    private static let options: [CheckedFilterOption] = [.all, .unchecked, .over]

    var body: some View {
        ScrollView(.horizontal) {
            HStack(spacing: DesignTokens.ChipMetrics.Standard.interChipGap) {
                ForEach(Self.options) { option in
                    Button {
                        checked = option
                    } label: {
                        PulpeChip(
                            label: option.label,
                            count: option == .all ? nil : counts.count(for: option),
                            style: checked == option ? .selected : .outlined
                        )
                    }
                    .buttonStyle(.plain)
                    .accessibilityAddTraits(checked == option ? .isSelected : [])
                    .accessibilityIdentifier("budgetCheckedFilter-\(option.rawValue)")
                }
            }
            .padding(.horizontal, DesignTokens.Spacing.xl)
        }
        .scrollIndicators(.hidden)
        .scrollClipDisabled()
        .sensoryFeedback(.selection, trigger: checked)
    }
}

#Preview {
    @Previewable @State var checked: CheckedFilterOption = .all
    BudgetTypeFilter(checked: $checked, counts: CheckedFilterCounts(unchecked: 9, checked: 4, all: 13, over: 2))
        .padding(.vertical)
        .background(Color.appBackground)
}
