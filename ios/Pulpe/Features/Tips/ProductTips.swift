import SwiftUI
import TipKit

/// Product tips for contextual user education
/// Uses @Parameter pattern for state management
enum ProductTips {
    // MARK: - Global State

    /// When true, all tips are permanently hidden
    @Parameter
    static var tourDismissed: Bool = false

    /// When true, tips are hidden (sheet/dialog is presented)
    @Parameter
    private(set) static var isSheetPresented: Bool = false

    /// Tracks whether the user has seen the pessimistic check explanation
    @Parameter
    static var pessimisticCheckSeen: Bool = false

    /// Count of currently-presented modals suppressing tips. `isSheetPresented`
    /// derives from this — the counter is its SINGLE writer, so overlapping
    /// modals (e.g. a sheet pushed while another is still dismissing) can't
    /// race two independent booleans back to `false` too early.
    /// `@MainActor`: only ever touched from SwiftUI view lifecycle callbacks.
    @MainActor
    private static var modalPresentationCount = 0

    /// Call from a modal's `onAppear`. Every presenter of a tip-suppressing
    /// modal (FAB sheet, deep-link sheet, root sheets, CurrentMonthView's own
    /// sheet/fullScreenCover) must pair this with `modalDidDisappear()` — see
    /// `View.suppressesTips()` below.
    @MainActor
    static func modalDidAppear() {
        modalPresentationCount += 1
        isSheetPresented = modalPresentationCount > 0
    }

    /// Call from a modal's `onDisappear`. Floors at 0 so a stray disappear
    /// (no matching appear) can't underflow the count.
    @MainActor
    static func modalDidDisappear() {
        modalPresentationCount = max(0, modalPresentationCount - 1)
        isSheetPresented = modalPresentationCount > 0
    }

    // MARK: - Checking Tip

    struct CheckingTip: Tip {
        var id: String { "checking-point-control-v2" }

        var title: Text {
            Text("Pointer un mouvement")
        }

        var message: Text? {
            Text("""
                Dès qu'un mouvement est passé sur ton compte, touche le rond devant sa ligne. \
                Pulpe garde le fil de ce qui est réel.
                """)
        }

        var image: Image? {
            Image(systemName: "checkmark.circle")
        }

        // Stops nagging after 3 displays — it kept re-popping on every return
        // to the tab otherwise.
        var options: [Option] {
            [MaxDisplayCount(3)]
        }

        var rules: [Rule] {
            [
                #Rule(ProductTips.$tourDismissed) { $0 == false },
                #Rule(ProductTips.$isSheetPresented) { $0 == false }
            ]
        }
    }

    // MARK: - Pessimistic Check Tip

    struct PessimisticCheckTip: Tip {
        var title: Text {
            Text("Budget protégé")
        }

        var message: Text? {
            Text("Quand tu dépenses moins que prévu, Pulpe garde le montant prévu pour protéger ton budget.")
        }

        var image: Image? {
            Image(systemName: "shield.checkered")
        }

        var rules: [Rule] {
            [
                #Rule(ProductTips.$tourDismissed) { $0 == false },
                #Rule(ProductTips.$isSheetPresented) { $0 == false },
                #Rule(ProductTips.$pessimisticCheckSeen) { $0 == true }
            ]
        }
    }

    // MARK: - Templates Web Parity Tip

    struct TemplatesWebParityTip: Tip {
        var title: Text {
            Text("Modèles : ajouter ou retirer une ligne")
        }

        var message: Text? {
            Text("""
                Ici tu peux modifier les lignes d'un modèle. Pour en ajouter ou en retirer, \
                passe par l'app web.
                """)
        }

        var image: Image? {
            Image(systemName: "laptopcomputer.and.iphone")
        }

        var actions: [Action] {
            [Action(id: "open-web", title: AppLocale.string("Ouvrir sur le web"))]
        }

        var rules: [Rule] {
            [
                #Rule(ProductTips.$isSheetPresented) { $0 == false }
            ]
        }
    }

    // MARK: - Shared Instances

    static let checking = CheckingTip()
    static let pessimisticCheck = PessimisticCheckTip()
    static let templatesWebParity = TemplatesWebParityTip()

    // MARK: - Reset

    @MainActor
    static func resetAllTips() {
        tourDismissed = false
        modalPresentationCount = 0
        isSheetPresented = false
        pessimisticCheckSeen = false
        try? Tips.resetDatastore()
    }
}

// MARK: - Suppression Modifier

private struct SuppressesTipsModifier: ViewModifier {
    func body(content: Content) -> some View {
        content
            .onAppear { ProductTips.modalDidAppear() }
            .onDisappear { ProductTips.modalDidDisappear() }
    }
}

extension View {
    /// Marks this modal's content as tip-suppressing for as long as it's on
    /// screen. Apply to the CONTENT of every sheet/fullScreenCover that can
    /// present over a tip's anchor — every presenter must opt in, since
    /// `ProductTips.isSheetPresented` only reflects modals that call this.
    func suppressesTips() -> some View {
        modifier(SuppressesTipsModifier())
    }

    /// Shared surface for inline `TipView`s: the row-card token, so education
    /// banners lift off the canvas like every other card. TipKit's default
    /// gray fill is near-indistinguishable from `appBackground`.
    func pulpeTipBackground() -> some View {
        tipBackground(Color.surfaceContainerLowest)
    }
}
