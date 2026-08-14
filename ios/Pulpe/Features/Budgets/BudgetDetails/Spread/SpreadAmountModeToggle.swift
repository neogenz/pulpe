import SwiftUI

/// Whether the amount typed in the hero field is a per-month figure or the TOTAL
/// to fan out over the selected months (PUL-17 dual-mode). Total is the default —
/// most users think "I want to spread 1'200 over the year", not "100/month".
enum SpreadAmountMode: CaseIterable, Hashable {
    case total
    case perMonth

    var label: String {
        switch self {
        case .total: "Total"
        case .perMonth: "Par mois"
        }
    }
}

/// Binary segmented control toggling between TOTAL and PER-MONTH amount entry.
/// Rides `CapsulePicker`'s recessed track like `SpreadModeToggle`, so the two
/// read as one family; the selected ink follows the picked `kind`.
struct SpreadAmountModeToggle: View {
    @Binding var mode: SpreadAmountMode
    let accentColor: Color

    var body: some View {
        CapsulePicker(selection: $mode, title: nil) { candidate, isSelected in
            Text(candidate.label)
                .foregroundStyle(isSelected ? accentColor : Color.onSurfaceVariant)
        }
        .accessibilityLabel("Mode de montant")
        .accessibilityValue(mode.label)
    }
}

#Preview {
    @Previewable @State var mode: SpreadAmountMode = .total
    SpreadAmountModeToggle(mode: $mode, accentColor: .financialExpense)
        .padding()
}
