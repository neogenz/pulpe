import SwiftUI

/// "Quand ?": how often a new prévision happens. `everyMonth` writes it into the model so each
/// month carries it, `once` is this month only, `spread` divides a total over several months (PUL-17).
enum BudgetLineCreationMode: CaseIterable, Hashable {
    case everyMonth
    case once
    case spread

    var label: String {
        switch self {
        case .everyMonth: PendingWording.everyMonth
        case .once: PendingWording.once
        case .spread: PendingWording.spread
        }
    }
}

/// The three answers of "Quand ?". An income cannot be spread, so it only gets two.
struct SpreadModeToggle: View {
    @Binding var selection: BudgetLineCreationMode
    let kind: TransactionKind
    /// Set when the month cannot take an every-month prévision (closed, or no model behind it).
    let isEveryMonthDisabled: Bool

    var body: some View {
        SegmentedPicker(
            selection: $selection,
            title: nil,
            options: kind == .income ? [.everyMonth, .once] : BudgetLineCreationMode.allCases,
            disabledOptions: isEveryMonthDisabled ? [.everyMonth] : []
        ) { mode in
            Text(mode.label)
        }
        // `.contain` before the label/value: without it, both propagate onto the
        // segments themselves and VoiceOver loses their names.
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Quand ?")
        .accessibilityValue(selection.label)
    }
}

#Preview {
    @Previewable @State var mode: BudgetLineCreationMode = .once
    SpreadModeToggle(selection: $mode, kind: .expense, isEveryMonthDisabled: false)
        .padding()
}
