import SwiftUI

// MARK: - Checked Filter Option

/// État filter applied to budget items in the detail flow (cumulative AND with `BudgetLineKindFilter`).
/// Three states: `À pointer` / `Pointé` / `Tout voir`. Driven from the leading icon button on
/// the filter rail (tap cycles, long-press opens a context menu).
enum CheckedFilterOption: String, CaseIterable, Identifiable {
    case unchecked
    case checked
    case all

    var id: String { rawValue }

    var label: String {
        switch self {
        case .unchecked: "À pointer"
        case .checked: "Pointé"
        case .all: "Tout voir"
        }
    }

    var icon: String {
        switch self {
        case .unchecked: "square"
        case .checked: "checkmark.square"
        case .all: "list.bullet"
        }
    }

    var accessibilityLabel: String {
        switch self {
        case .unchecked: "Afficher uniquement les éléments à pointer"
        case .checked: "Afficher uniquement les éléments pointés"
        case .all: "Afficher tous les éléments"
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
        case .all: "Tout"
        case .income: "Revenus"
        case .saving: "Épargne"
        case .expense: "Dépenses"
        }
    }

    var accessibilityLabel: String {
        switch self {
        case .all: "Afficher tous les types"
        case .income: "Afficher uniquement les revenus"
        case .saving: "Afficher uniquement l'épargne"
        case .expense: "Afficher uniquement les dépenses"
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

    static let zero = CheckedFilterCounts(unchecked: 0, checked: 0, all: 0)

    func count(for option: CheckedFilterOption) -> Int {
        switch option {
        case .unchecked: unchecked
        case .checked: checked
        case .all: all
        }
    }
}

// MARK: - Unified Filter

/// Horizontal filter rail for the budget detail page.
///
/// Two cumulative axes:
/// 1. **État** (À pointer / Pointé / Tout voir) — leading labelled `Menu` button showing icon,
///    label, count and chevron. Tap opens a native iOS menu with the three options and counts.
/// 2. **Type** (Tout / Revenus / Épargne / Dépenses) — pills with count badges; the pill is
///    disabled at 0.4 opacity when its count is 0 (except `.all`).
///
/// The two axes AND together. Visual reference: Pulpe v2 UnifiedFilter (post-PUL-209 brief).
struct BudgetTypeFilter: View {
    @Binding var kind: BudgetLineKindFilter
    @Binding var checked: CheckedFilterOption
    let counts: BudgetLineKindCounts
    let checkedCounts: CheckedFilterCounts

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: DesignTokens.Spacing.sm) {
                checkedMenuButton()
                    .padding(.trailing, DesignTokens.Spacing.xs)

                ForEach(BudgetLineKindFilter.allCases) { option in
                    typePill(option)
                }
            }
            .padding(.vertical, DesignTokens.Spacing.sm)
        }
        .contentMargins(.horizontal, DesignTokens.Spacing.lg, for: .scrollContent)
        .scrollIndicators(.hidden)
        .scrollClipDisabled()
        .frame(maxWidth: .infinity, alignment: .leading)
        .sensoryFeedback(.selection, trigger: kind)
        .sensoryFeedback(.selection, trigger: checked)
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Filtres")
    }

    // MARK: - Checked Menu Button (labelled, opens native iOS Menu on tap)

    @ViewBuilder
    private func checkedMenuButton() -> some View {
        Menu {
            checkedMenuItems()
        } label: {
            checkedMenuLabel()
        }
        .menuStyle(.button)
        .frame(minHeight: DesignTokens.TapTarget.minimum)
        .contentShape(Capsule())
        .plainPressedButtonStyle()
        .accessibilityLabel("Filtre d'état")
        .accessibilityValue("\(checked.label), \(checkedCounts.count(for: checked)) éléments")
        .accessibilityHint("Touche deux fois pour ouvrir le menu de filtres d'état.")
    }

    @ViewBuilder
    private func checkedMenuItems() -> some View {
        ForEach(CheckedFilterOption.allCases) { option in
            Button {
                withAnimation(.snappy(duration: DesignTokens.Animation.fast)) {
                    checked = option
                }
            } label: {
                Label(
                    "\(option.label) (\(checkedCounts.count(for: option)))",
                    systemImage: option.icon
                )
            }
        }
    }

    @ViewBuilder
    private func checkedMenuLabel() -> some View {
        HStack(spacing: DesignTokens.Spacing.tightGap) {
            Image(systemName: checked.icon)
                .contentTransition(.symbolEffect(.replace))
            Text(checked.label)
                .font(PulpeTypography.metricLabelBold)
            Text("\(checkedCounts.count(for: checked))")
                .font(PulpeTypography.metricMini)
                .monospacedDigit()
                .padding(.horizontal, DesignTokens.Spacing.tightGap)
                .padding(.vertical, DesignTokens.Spacing.xxs)
                .background(Capsule().fill(Color.surfaceContainerHigh))
                .foregroundStyle(Color.textTertiary)
            Image(systemName: "chevron.down")
                .font(PulpeTypography.metricMini)
                .foregroundStyle(Color.textTertiary)
        }
        .padding(.horizontal, DesignTokens.Spacing.lg)
        .padding(.vertical, DesignTokens.Spacing.md)
        .background(Capsule().fill(Color.surface))
        .overlay {
            Capsule()
                .strokeBorder(
                    Color.onSurfaceVariant.opacity(DesignTokens.Opacity.outlinePill),
                    lineWidth: DesignTokens.BorderWidth.thin
                )
        }
        .foregroundStyle(Color.textPrimary)
    }

    // MARK: - Type Pill (with count badge)

    @ViewBuilder
    private func typePill(_ option: BudgetLineKindFilter) -> some View {
        let isSelected = kind == option
        let count = counts.count(for: option)
        let isDisabled = count == 0 && option != .all

        Button {
            withAnimation(.snappy(duration: DesignTokens.Animation.fast)) {
                kind = option
            }
        } label: {
            typePillLabel(option, isSelected: isSelected, count: count)
        }
        .frame(minHeight: DesignTokens.TapTarget.minimum)
        .contentShape(Capsule())
        .plainPressedButtonStyle()
        .disabled(isDisabled)
        .opacity(isDisabled ? DesignTokens.Opacity.disabled : 1)
        .accessibilityLabel(option.accessibilityLabel)
        .accessibilityValue("\(count) éléments")
        .accessibilityAddTraits(isSelected ? [.isButton, .isSelected] : .isButton)
    }

    @ViewBuilder
    private func typePillLabel(
        _ option: BudgetLineKindFilter,
        isSelected: Bool,
        count: Int
    ) -> some View {
        HStack(spacing: DesignTokens.Spacing.tightGap) {
            Text(option.label)
                .font(PulpeTypography.metricLabelBold)
            Text("\(count)")
                .font(PulpeTypography.metricMini)
                .monospacedDigit()
                .padding(.horizontal, DesignTokens.Spacing.tightGap)
                .padding(.vertical, DesignTokens.Spacing.xxs)
                .background(
                    Capsule().fill(
                        isSelected
                            ? Color(.systemBackground).opacity(DesignTokens.Opacity.secondary)
                            : Color.surfaceContainerHigh
                    )
                )
                .foregroundStyle(isSelected ? Color(.systemBackground) : Color.textTertiary)
        }
        .padding(.horizontal, DesignTokens.Spacing.lg)
        .padding(.vertical, DesignTokens.Spacing.md)
        .background(Capsule().fill(isSelected ? Color.textPrimary : Color.surface))
        .overlay {
            if !isSelected {
                Capsule()
                    .strokeBorder(
                        Color.onSurfaceVariant.opacity(DesignTokens.Opacity.outlinePill),
                        lineWidth: DesignTokens.BorderWidth.thin
                    )
            }
        }
        .foregroundStyle(isSelected ? Color(.systemBackground) : Color.textPrimary)
    }
}

// MARK: - Preview

#Preview {
    @Previewable @State var kind: BudgetLineKindFilter = .all
    @Previewable @State var checked: CheckedFilterOption = .unchecked

    VStack(spacing: 24) {
        BudgetTypeFilter(
            kind: $kind,
            checked: $checked,
            counts: BudgetLineKindCounts(all: 5, income: 0, saving: 1, expense: 4),
            checkedCounts: CheckedFilterCounts(unchecked: 4, checked: 1, all: 5)
        )

        Text("Type: \(kind.label) · Pointage: \(checked.label)")
            .font(.caption)
            .foregroundStyle(.secondary)
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity)
    .background(Color.appBackground)
}
