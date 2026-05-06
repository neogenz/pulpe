import SwiftUI

// MARK: - Filter Option

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

// MARK: - Unified Filter

/// Unified scroll bar combining the type filter (Tout/Revenus/Épargne/Dépenses with counts)
/// and the checked-state filter (À pointer/Pointé/Tout). The two filters are cumulative (AND).
///
/// Visual reference: Pulpe v2 `UnifiedFilter` (screen-envd-mobile-bc5.jsx). Active pill uses the
/// neutral ink (label) color; inactive type pills are surface cards with a hairline; inactive
/// checked pills are transparent. A 1pt vertical divider separates the two segments.
struct BudgetTypeFilter: View {
    @Binding var kind: BudgetLineKindFilter
    @Binding var checked: CheckedFilterOption
    let counts: BudgetLineKindCounts

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: DesignTokens.Spacing.tightGap) {
                ForEach(BudgetLineKindFilter.allCases) { option in
                    typePill(option)
                }

                Rectangle()
                    .fill(Color.outlineVariant.opacity(DesignTokens.Opacity.heavy))
                    .frame(width: DesignTokens.FrameHeight.separator, height: 22)
                    .padding(.horizontal, DesignTokens.Spacing.xs)

                ForEach(CheckedFilterOption.allCases) { option in
                    checkedPill(option)
                }
            }
            .padding(.horizontal, DesignTokens.Spacing.lg)
            .padding(.vertical, DesignTokens.Spacing.sm)
        }
        .scrollIndicators(.hidden)
        .sensoryFeedback(.selection, trigger: kind)
        .sensoryFeedback(.selection, trigger: checked)
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Filtres")
    }

    // MARK: - Type Pill (with count badge)

    @ViewBuilder
    private func typePill(_ option: BudgetLineKindFilter) -> some View {
        let isSelected = kind == option
        let count = counts.count(for: option)

        Button {
            withAnimation(.snappy(duration: DesignTokens.Animation.fast)) {
                kind = option
            }
        } label: {
            HStack(spacing: DesignTokens.Spacing.tightGap) {
                Text(option.label)
                    .font(PulpeTypography.metricLabelBold)
                Text("\(count)")
                    .font(PulpeTypography.metricMini)
                    .monospacedDigit()
                    .padding(.horizontal, DesignTokens.Spacing.tightGap)
                    .padding(.vertical, 1)
                    .background(
                        Capsule().fill(
                            isSelected
                                ? Color.white.opacity(DesignTokens.Opacity.secondary)
                                : Color.surfaceContainerHigh
                        )
                    )
                    .foregroundStyle(
                        isSelected ? Color(.systemBackground) : Color.textTertiary
                    )
            }
            .padding(.horizontal, DesignTokens.Spacing.md)
            .padding(.vertical, DesignTokens.Spacing.xs)
            .background(
                Capsule().fill(isSelected ? Color.textPrimary : Color.surface)
            )
            .overlay {
                if !isSelected {
                    Capsule()
                        .strokeBorder(
                            Color.onSurfaceVariant.opacity(0.22),
                            lineWidth: DesignTokens.BorderWidth.thin
                        )
                }
            }
            .foregroundStyle(isSelected ? Color(.systemBackground) : Color.textPrimary)
        }
        .frame(minHeight: DesignTokens.TapTarget.minimum)
        .contentShape(Capsule())
        .plainPressedButtonStyle()
        .accessibilityLabel(option.accessibilityLabel)
        .accessibilityValue("\(count) éléments")
        .accessibilityAddTraits(isSelected ? [.isButton, .isSelected] : .isButton)
    }

    // MARK: - Checked Pill (transparent when inactive)

    @ViewBuilder
    private func checkedPill(_ option: CheckedFilterOption) -> some View {
        let isSelected = checked == option

        Button {
            withAnimation(.snappy(duration: DesignTokens.Animation.fast)) {
                checked = option
            }
        } label: {
            Text(option.label)
                .font(PulpeTypography.metricLabel)
                .padding(.horizontal, DesignTokens.Spacing.md)
                .padding(.vertical, DesignTokens.Spacing.xs)
                .background(
                    Capsule().fill(isSelected ? Color.textPrimary : Color.clear)
                )
                .foregroundStyle(isSelected ? Color(.systemBackground) : Color.textTertiary)
        }
        .frame(minHeight: DesignTokens.TapTarget.minimum)
        .contentShape(Capsule())
        .plainPressedButtonStyle()
        .accessibilityLabel(option.accessibilityLabel)
        .accessibilityAddTraits(isSelected ? [.isButton, .isSelected] : .isButton)
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
            counts: BudgetLineKindCounts(all: 5, income: 1, saving: 1, expense: 3)
        )

        Text("Type: \(kind.label) · Pointage: \(checked.label)")
            .font(.caption)
            .foregroundStyle(.secondary)
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity)
    .background(Color.appBackground)
}
