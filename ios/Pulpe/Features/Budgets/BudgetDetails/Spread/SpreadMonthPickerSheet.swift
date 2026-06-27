import SwiftUI

/// Wheel month + year picker presented as a sheet from a `De`/`À` row.
/// Owns its dismiss; reports the chosen month through `onSelect`.
struct SpreadMonthPickerSheet: View {
    let title: String
    let initial: SpreadMonth
    let yearRange: ClosedRange<Int>
    let accentColor: Color
    let onSelect: (SpreadMonth) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var month: Int
    @State private var year: Int

    init(
        title: String,
        initial: SpreadMonth,
        yearRange: ClosedRange<Int>,
        accentColor: Color = .pulpePrimary,
        onSelect: @escaping (SpreadMonth) -> Void
    ) {
        self.title = title
        self.initial = initial
        self.yearRange = yearRange
        self.accentColor = accentColor
        self.onSelect = onSelect
        self._month = State(initialValue: initial.month)
        self._year = State(initialValue: initial.year)
    }

    var body: some View {
        NavigationStack {
            HStack(spacing: DesignTokens.Spacing.none) {
                Picker("Mois", selection: $month) {
                    ForEach(1...12, id: \.self) { value in
                        Text(Formatters.monthName(for: value)).tag(value)
                    }
                }
                .pickerStyle(.wheel)

                Picker("Année", selection: $year) {
                    ForEach(Array(yearRange), id: \.self) { value in
                        Text(String(value)).tag(value)
                    }
                }
                .pickerStyle(.wheel)
            }
            .padding(.horizontal, DesignTokens.Spacing.xl)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(Color.sheetBackground)
            .navigationTitle(title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Annuler") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("OK") {
                        onSelect(SpreadMonth(year: year, month: month))
                        dismiss()
                    }
                    .fontWeight(.semibold)
                    .foregroundStyle(accentColor)
                }
            }
        }
        .standardSheetPresentation(detents: [.medium])
    }
}

#Preview {
    SpreadMonthPickerSheet(
        title: "Premier mois",
        initial: SpreadMonth(year: 2026, month: 6),
        yearRange: 2026...2029
    ) { _ in }
}
