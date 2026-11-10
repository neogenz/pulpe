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

    @Test
    func refreshUndoToast_doesNotCallPreviousOnFinished_onlyLatestOnAutoDismiss() async {
        let manager = ToastManager(autoDismissDuration: .milliseconds(200))
        var firstFinished = false
        var secondFinished = false
        manager.showWithUndo(
            "one",
            undo: {},
            onFinishedWithoutUndo: { firstFinished = true }
        )
        manager.refreshUndoToast(
            message: "two",
            detail: nil,
            undo: {},
            onFinishedWithoutUndo: { secondFinished = true }
        )
        try? await Task.sleep(for: .milliseconds(50))
        #expect(firstFinished == false)
        #expect(secondFinished == false)
        #expect(manager.currentToast?.message == "two")

        try? await Task.sleep(for: .milliseconds(250))
        #expect(firstFinished == false)
        #expect(secondFinished == true)
    }

    @Test
    func bottomClearance_hiddenFloatingButton_dropsItsRoom() {
        let withButton = ToastManager.bottomClearance(tabBarHeight: 50, showsFloatingAddButton: true)
        let withoutButton = ToastManager.bottomClearance(tabBarHeight: 50, showsFloatingAddButton: false)

        #expect(withButton - withoutButton == DesignTokens.Control.fabTabBarGap + DesignTokens.Control.fab)
        #expect(withoutButton == 50 + DesignTokens.Spacing.md)
    }

    @Test
    func bottomClearance_sideRailWithoutButton_sitsJustAboveSafeArea() {
        let clearance = ToastManager.bottomClearance(tabBarHeight: 0, showsFloatingAddButton: false)

        #expect(clearance == DesignTokens.Spacing.md)
    }

    @Test
    func floatingAddButtons_pushOverAnother_countsUntilBothLeave() {
        let manager = ToastManager()

        // A pushed month page shows its own « + » before the tab's one leaves.
        manager.floatingAddButtonAppeared()
        manager.floatingAddButtonAppeared()
        manager.floatingAddButtonDisappeared()
        #expect(manager.floatingAddButtonsOnScreen == 1)

        manager.floatingAddButtonDisappeared()
        manager.floatingAddButtonDisappeared()
        #expect(manager.floatingAddButtonsOnScreen == 0)
    }
}
