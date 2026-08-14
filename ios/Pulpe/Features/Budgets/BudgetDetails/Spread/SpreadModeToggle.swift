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
struct SpreadModeToggle: View {
    @Binding var selection: BudgetLineCreationMode

    var body: some View {
        SegmentedPicker(selection: $selection, title: nil) { mode in
            Text(mode.label)
        }
        .accessibilityLabel("Mode de création")
        .accessibilityValue(selection.label)
    }
}

#Preview {
    @Previewable @State var mode: BudgetLineCreationMode = .once
    SpreadModeToggle(selection: $mode)
        .padding()
}
