import SwiftUI

struct KindToggle: View {
    @Binding var selection: TransactionKind

    var body: some View {
        SegmentedPicker(selection: $selection, title: nil) { kind in
            Text(kind.label)
        }
        .accessibilityLabel("Nature")
        .accessibilityValue(selection.label)
    }
}

#Preview {
    @Previewable @State var kind: TransactionKind = .expense
    KindToggle(selection: $kind)
        .padding()
}
