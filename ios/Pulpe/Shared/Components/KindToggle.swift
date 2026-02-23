import SwiftUI

struct KindToggle: View {
    @Binding var selection: TransactionKind

    var body: some View {
        Picker("Type de transaction", selection: $selection) {
            ForEach(TransactionKind.allCases, id: \.self) { kind in
                Text(kind.label).tag(kind)
            }
        }
        .pickerStyle(.segmented)
        .sensoryFeedback(.selection, trigger: selection)
        .accessibilityLabel("Type de transaction")
        .accessibilityValue(selection.label)
    }
}
