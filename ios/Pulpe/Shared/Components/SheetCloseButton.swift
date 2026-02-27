import SwiftUI

/// Close button for sheets — uses SF Symbol with native toolbar styling (Liquid Glass on iOS 26+).
struct SheetCloseButton: View {
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        Button {
            dismiss()
        } label: {
            Image(systemName: "xmark")
        }
        .accessibilityLabel("Fermer")
    }
}
