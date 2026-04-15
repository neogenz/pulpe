import Foundation
@testable import Pulpe
import Testing

@Suite("ToastManager")
@MainActor
struct ToastManagerTests {
    @Test
    func showWhileUndoActive_doesNotReplaceCurrentToast() {
        let manager = ToastManager()
        var finished = false
        manager.showWithUndo(
            "undo",
            undo: {},
            onFinishedWithoutUndo: { finished = true }
        )
        let undoId = manager.currentToast?.id
        manager.show("later", type: .success)
        #expect(manager.currentToast?.id == undoId)
        #expect(manager.currentToast?.type == .undo)
        #expect(finished == false)
    }

    @Test
    func executeUndo_doesNotRunOnFinished_thenShowsPending() async {
        let manager = ToastManager()
        var finished = false
        manager.showWithUndo(
            "undo",
            undo: {},
            onFinishedWithoutUndo: { finished = true }
        )
        manager.show("later", type: .success)
        manager.executeUndo()
        try? await Task.sleep(for: .milliseconds(100))
        #expect(finished == false)
        #expect(manager.currentToast?.message == "later")
        #expect(manager.currentToast?.type == .success)
    }

    @Test
    func dismissUndo_runsOnFinished_thenShowsPending() async {
        let manager = ToastManager()
        var finished = false
        manager.showWithUndo(
            "undo",
            undo: {},
            onFinishedWithoutUndo: { finished = true }
        )
        manager.show("later", type: .success)
        manager.dismiss()
        try? await Task.sleep(for: .milliseconds(100))
        #expect(finished == true)
        #expect(manager.currentToast?.message == "later")
    }

    @Test
    func autoDismissUndo_runsOnFinished_thenShowsPending() async {
        // Même durée s’applique au toast en file : assez long pour l’assert avant son auto-dismiss.
        let manager = ToastManager(autoDismissDuration: .milliseconds(200))
        var finished = false
        manager.showWithUndo(
            "undo",
            undo: {},
            onFinishedWithoutUndo: { finished = true }
        )
        manager.show("later", type: .success)
        try? await Task.sleep(for: .milliseconds(250))
        #expect(finished == true)
        #expect(manager.currentToast?.message == "later")
    }

    @Test
    func pending_drainsFIFO_afterUndoDismissal() async {
        let manager = ToastManager()
        manager.showWithUndo("undo", undo: {}, onFinishedWithoutUndo: {})
        manager.show("a", type: .success)
        manager.show("b", type: .success)
        manager.executeUndo()
        try? await Task.sleep(for: .milliseconds(100))
        #expect(manager.currentToast?.message == "a")
        manager.dismiss()
        try? await Task.sleep(for: .milliseconds(50))
        #expect(manager.currentToast?.message == "b")
    }

    @Test
    func replaceUndoWithNewUndo_callsPreviousOnFinished() async {
        let manager = ToastManager()
        var firstFinished = false
        var secondFinished = false
        manager.showWithUndo(
            "one",
            undo: {},
            onFinishedWithoutUndo: { firstFinished = true }
        )
        manager.showWithUndo(
            "two",
            undo: {},
            onFinishedWithoutUndo: { secondFinished = true }
        )
        try? await Task.sleep(for: .milliseconds(100))
        #expect(firstFinished == true)
        #expect(secondFinished == false)
        #expect(manager.currentToast?.message == "two")
    }
}
