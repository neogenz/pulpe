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
        // Title + symbol: the symbol shows in the bar, the title feeds VoiceOver and the
        // overflow menu, and both let iPhone Duo move it into a vertical bar.
        Button("Fermer", systemImage: "xmark") {
            if let action { action() } else { dismiss() }
        }
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
