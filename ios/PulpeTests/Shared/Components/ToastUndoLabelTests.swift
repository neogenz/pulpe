@testable import Pulpe
import Testing

@Suite("Toast undo label")
@MainActor
struct ToastUndoLabelTests {
    @Test func defaultsToDeletionWording() {
        let manager = ToastManager()
        manager.showWithUndo("x", undo: {}, onFinishedWithoutUndo: {})
        #expect(manager.currentToast?.undoAccessibilityLabel == "Annuler la suppression")
    }

    @Test func carriesTheLabelItWasGiven() {
        let manager = ToastManager()
        manager.showWithUndo("x", undo: {}, onFinishedWithoutUndo: {}, undoAccessibilityLabel: "Annuler")
        #expect(manager.currentToast?.undoAccessibilityLabel == "Annuler")
    }
}
