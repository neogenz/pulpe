import SwiftUI

/// Sticky horizontal month pager that appears under the nav bar once the user has scrolled
/// past the hero on `BudgetDetailsView`. Inspired by Revolut's transactions screen: shows every
/// month with an existing budget (chronological, cross-year), centered focused chip, edge fade.
///
/// Behavior:
/// - **Tap** a chip → switches budget, scroll-snaps the chip to center.
/// - **Swipe** the pager → browses chips visually only. Does NOT change the active month.
///   Users can scrub the rail to peek at distant months without committing — committing is
///   an explicit tap (matches Revolut's transactions tab interaction).
struct BudgetMonthPagerBar: View {
    let months: [BudgetSparse]
    let currentBudgetId: String
    let onSelect: (String) -> Void

    @State private var scrollPosition: String?

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            LazyHStack(spacing: DesignTokens.ChipMetrics.Standard.interChipGap) {
                ForEach(months, id: \.id) { sparse in
                    BudgetMonthPagerChip(
                        sparse: sparse,
                        anchorYear: anchorYear,
                        isSelected: sparse.id == currentBudgetId,
                        onTap: { onSelect(sparse.id) }
                    )
                    .id(sparse.id)
                }
            }
            .scrollTargetLayout()
            .padding(.horizontal, DesignTokens.Spacing.lg)
        }
        .scrollPosition(id: $scrollPosition, anchor: .center)
        .scrollTargetBehavior(.viewAligned(limitBehavior: .alwaysByOne))
        .scrollClipDisabled()
        .onChange(of: currentBudgetId, initial: true) { _, newId in
            guard scrollPosition != newId else { return }
            scrollPosition = newId
        }
        .frame(height: DesignTokens.TapTarget.minimum)
        .padding(.vertical, DesignTokens.Spacing.sm)
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Sélecteur de mois")
    }

    /// Reference year used to decide whether a chip can show its short label ("Mai")
    /// or must show the disambiguating long label ("Mai 2025"). The currently centered
    /// month is the natural anchor — its neighbours in the same year stay short, while
    /// chips from a different year get the year suffix.
    private var anchorYear: Int? {
        months.first(where: { $0.id == currentBudgetId })?.year
    }
}

// MARK: - Chip

private struct BudgetMonthPagerChip: View {
    let sparse: BudgetSparse
    let anchorYear: Int?
    let isSelected: Bool
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            PulpeChip(
                label: shortLabel,
                style: isSelected ? .solid : .outlined
            )
        }
        .plainPressedButtonStyle()
        .scrollTransition(
            topLeading: .interactive,
            bottomTrailing: .interactive,
            axis: .horizontal
        ) { content, phase in
            content
                .opacity(phase.isIdentity ? 1 : DesignTokens.Opacity.disabled)
                .scaleEffect(phase.isIdentity ? 1 : 0.94)
        }
        .accessibilityLabel(longLabel)
        .accessibilityAddTraits(isSelected ? [.isButton, .isSelected] : .isButton)
    }

    /// Short label ("Mai") for chips in the anchor year, full label ("Mai 2025") for cross-year chips.
    /// Returns "—" on data error rather than "today" so a corrupted sparse never leaks the current
    /// date into the UI.
    private var shortLabel: String {
        guard let date = monthDate(),
              let year = sparse.year,
              let anchor = anchorYear else {
            return "—"
        }
        return year == anchor
            ? Formatters.month.string(from: date).capitalized
            : Formatters.monthYear.string(from: date).capitalized
    }

    private var longLabel: String {
        guard let date = monthDate() else { return "Mois" }
        return Formatters.monthYear.string(from: date).capitalized
    }

    private func monthDate() -> Date? {
        guard let month = sparse.month, let year = sparse.year else { return nil }
        var components = DateComponents()
        components.month = month
        components.year = year
        components.day = 1
        return Calendar.current.date(from: components)
    }
}

// MARK: - Preview

#Preview("Few months") {
    StatefulPagerPreview(monthCount: 6, selectedIndex: 4)
}

#Preview("Cross-year") {
    StatefulPagerPreview(monthCount: 24, selectedIndex: 18)
}

#Preview("Lazy stress (150)") {
    StatefulPagerPreview(monthCount: 150, selectedIndex: 100)
}

private struct StatefulPagerPreview: View {
    let monthCount: Int
    let selectedIndex: Int
    @State private var currentId: String = ""

    var months: [BudgetSparse] {
        let calendar = Calendar.current
        let baseComponents = calendar.dateComponents([.year, .month], from: .now)
        let baseYear = baseComponents.year ?? 2026
        let baseMonth = baseComponents.month ?? 1
        return (0..<monthCount).map { offset in
            let totalMonths = baseMonth + offset - monthCount / 2
            let year = baseYear + Int((totalMonths - 1) / 12)
            var month = totalMonths % 12
            if month <= 0 { month += 12 }
            let id = "preview-\(year)-\(month)"
            return BudgetSparse(id: id, month: month, year: year)
        }
    }

    var body: some View {
        VStack(spacing: DesignTokens.Spacing.lg) {
            BudgetMonthPagerBar(
                months: months,
                currentBudgetId: currentId
            ) { newId in
                currentId = newId
            }

            Text("Selected: \(currentId)")
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        .background(Color.appBackground)
        .onAppear { currentId = months[selectedIndex].id }
    }
}
