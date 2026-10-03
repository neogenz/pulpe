import SwiftUI

/// Close button for sheets — uses SF Symbol with native toolbar styling (Liquid Glass on iOS 26+).
struct SheetCloseButton: View {
    /// Replaces the environment's dismiss, which inside a pushed navigation step pops the
    /// step instead of closing the sheet.
    private let action: (@MainActor () -> Void)?

    @Environment(\.dismiss) private var dismiss

    init(action: (@MainActor () -> Void)? = nil) {
        self.action = action
    }

    var body: some View {
        Button {
            if let action { action() } else { dismiss() }
        } label: {
            Image(systemName: "xmark")
        }
        .accessibilityLabel("Fermer")
    }
}

#Preview {
    NavigationStack {
        Text("Sheet content")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    SheetCloseButton()
                }
            }
    }
}
