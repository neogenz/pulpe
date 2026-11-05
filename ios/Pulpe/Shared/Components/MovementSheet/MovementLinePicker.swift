import SwiftUI

/// "Dans quelle prévision ?": the pushed list inside the movement sheet. The "imprévu"
/// card on top says what leaving the movement without a prévision costs, then the prévisions
/// of the same kind in three sections.
struct MovementLinePicker: View {
    let sections: MovementLineChoices.Sections
    let transactions: [Transaction]
    let kind: TransactionKind
    let currency: SupportedCurrency
    let selectedLineId: String?
    let onPick: (MovementSheet.LinePick) -> Void

    @State private var query = ""

    private var otherTitle: String {
        kind == .income ? AppLocale.string("Autres revenus") : AppLocale.string("Autres dépenses")
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: DesignTokens.Spacing.xl) {
                searchField
                unplannedCard
                section(AppLocale.string("Avec de la marge"), lines: matching(sections.margin))
                section(AppLocale.string("Déjà dépassées"), lines: matching(sections.over), isOver: true)
                section(otherTitle, lines: matching(sections.others), isPlannedList: true)
            }
            .padding(.horizontal, DesignTokens.Spacing.xl)
            .padding(.top, DesignTokens.Spacing.lg)
            .padding(.bottom, DesignTokens.Spacing.xxxl)
        }
        .scrollDismissesKeyboard(.interactively)
        .background(Color.sheetBackground)
        .navigationTitle("Dans quelle prévision ?")
        .navigationBarTitleDisplayMode(.inline)
    }

    private func matching(_ lines: [BudgetLine]) -> [BudgetLine] {
        let needle = query.trimmingCharacters(in: .whitespaces)
        guard !needle.isEmpty else { return lines }
        return lines.filter { $0.name.localizedStandardContains(needle) }
    }

    private var searchField: some View {
        HStack(spacing: DesignTokens.Spacing.sm) {
            Image(systemName: "magnifyingglass")
                .foregroundStyle(Color.textTertiary)
                .accessibilityHidden(true)
            TextField("Rechercher une prévision", text: $query)
                .font(PulpeTypography.bodyLarge)
                .submitLabel(.search)
        }
        .padding(.horizontal, DesignTokens.CornerRadius.input)
        .frame(minHeight: DesignTokens.FrameHeight.input)
        .background(Color.surface, in: .rect(cornerRadius: DesignTokens.CornerRadius.input))
        .overlay {
            RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.input)
                .strokeBorder(Color.outline, lineWidth: DesignTokens.BorderWidth.thin)
        }
    }

    private var unplannedCard: some View {
        Button { onPick(.unplanned) } label: {
            PulpeListRow(
                title: PendingWording.unplannedAnswer,
                subtitle: AppLocale.string("Aucune prévision : ton disponible baisse"),
                trailing: { EmptyView() }
            )
            .padding(.horizontal, DesignTokens.Spacing.lg)
            .pulpeSurfaceCard()
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("movementPickerUnplanned")
    }

    @ViewBuilder
    private func section(
        _ title: String,
        lines: [BudgetLine],
        isOver: Bool = false,
        isPlannedList: Bool = false
    ) -> some View {
        if !lines.isEmpty {
            VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
                Text(title)
                    .font(PulpeTypography.metricLabel)
                    .foregroundStyle(Color.textSecondary)
                    .padding(.leading, DesignTokens.Spacing.xs)
                VStack(spacing: DesignTokens.Spacing.none) {
                    ForEach(lines) { line in
                        if line.id != lines.first?.id { FormRowDivider() }
                        row(line, isOver: isOver, isPlannedList: isPlannedList)
                    }
                }
                .padding(.horizontal, DesignTokens.Spacing.lg)
                .pulpeSurfaceCard()
            }
        }
    }

    private func row(_ line: BudgetLine, isOver: Bool, isPlannedList: Bool) -> some View {
        let consumption = BudgetFormulas.calculateConsumption(for: line, transactions: transactions)
        let isSelected = line.id == selectedLineId
        return Button { onPick(.line(line.id)) } label: {
            HStack(spacing: DesignTokens.Spacing.md) {
                VStack(alignment: .leading, spacing: DesignTokens.Spacing.dividerGap) {
                    Text(line.name)
                        .font(PulpeTypography.rowTitle)
                        .foregroundStyle(isSelected ? Color.accentInk : Color.textPrimary)
                    Text(subtitle(for: line, isPlannedList: isPlannedList))
                        .font(PulpeTypography.captionRegular)
                        .foregroundStyle(Color.textSecondary)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                VStack(alignment: .trailing, spacing: DesignTokens.Spacing.dividerGap) {
                    Text((isPlannedList ? line.amount : abs(consumption.available)).asAmount(for: currency))
                        .font(PulpeTypography.rowAmount)
                        .foregroundStyle(isOver ? Color.financialOverBudget : Color.textPrimary)
                    Text(trailingCaption(isOver: isOver, isPlannedList: isPlannedList))
                        .font(PulpeTypography.captionRegular)
                        .foregroundStyle(isOver ? Color.financialOverBudget : Color.textSecondary)
                }
                Image(systemName: "checkmark")
                    .font(PulpeTypography.metricMini)
                    .foregroundStyle(Color.pulpePrimary)
                    .opacity(isSelected ? 1 : 0)
                    .accessibilityHidden(true)
            }
            .padding(.vertical, DesignTokens.ListRow.verticalPadding + DesignTokens.Spacing.xxs)
            .frame(minHeight: DesignTokens.ListRow.minHeight)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(isSelected ? .isSelected : [])
    }

    private func subtitle(for line: BudgetLine, isPlannedList: Bool) -> String {
        guard isPlannedList else { return AppLocale.string("\(line.amount.asAmount(for: currency)) prévus") }
        return line.isChecked
            ? AppLocale.string("\(line.recurrence.label) · pointé")
            : line.recurrence.label
    }

    private func trailingCaption(isOver: Bool, isPlannedList: Bool) -> String {
        if isOver { return AppLocale.string("au-delà") }
        return isPlannedList ? AppLocale.string("prévus") : AppLocale.string("reste")
    }
}
