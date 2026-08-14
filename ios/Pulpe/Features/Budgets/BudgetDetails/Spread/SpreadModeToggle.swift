import SwiftUI

/// Whether a new budget line is created once or spread over several months (PUL-17).
enum BudgetLineCreationMode: CaseIterable, Hashable {
    case once
    case spread

    var label: String {
        switch self {
        case .once: "Une seule fois"
        case .spread: "Lisser"
        }
    }
}

/// Binary segmented control toggling between the single-line and "Lisser" flows.
/// Rides `CapsulePicker`'s recessed track; the selected ink follows the picked
/// `kind` so the control reads as part of the same form.
struct SpreadModeToggle: View {
    @Binding var selection: BudgetLineCreationMode
    let accentColor: Color

    var body: some View {
        CapsulePicker(selection: $selection, title: nil) { mode, isSelected in
            Text(mode.label)
                .foregroundStyle(isSelected ? accentColor : Color.onSurfaceVariant)
        }
        .accessibilityLabel("Mode de création")
        .accessibilityValue(selection.label)
    }
}

#Preview {
    @Previewable @State var mode: BudgetLineCreationMode = .once
    SpreadModeToggle(selection: $mode, accentColor: .financialExpense)
        .padding()
}
