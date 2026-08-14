import SwiftUI

struct KindToggle: View {
    @Binding var selection: TransactionKind

    var body: some View {
        CapsulePicker(selection: $selection, title: nil) { kind, isSelected in
            Text(kind.label)
                .foregroundStyle(isSelected ? kind.color : Color.onSurfaceVariant)
        }
        .accessibilityLabel("Nature")
        .accessibilityValue(selection.label)
    }
}
