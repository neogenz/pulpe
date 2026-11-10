import XCTest

/// The folded iPhone Duo has neither a top navigation bar nor a bottom tab bar: its page
/// controls stand in a vertical bar beside the page, its tabs in a side rail. These read the
/// chrome wherever the layout put it.
extension XCUIApplication {
    /// Where a page's content may start: under the navigation bar, or the window's top when
    /// there is none.
    var contentTopY: CGFloat {
        let bar = navigationBars.firstMatch
        return bar.exists ? bar.frame.maxY : windows.firstMatch.frame.minY
    }

    /// A pushed page's back button, in the navigation bar or the Duo's vertical bar.
    var backButton: XCUIElement { buttons["BackButton"].firstMatch }

    /// The four root tabs (Patrimoine stays off: no flag in UI tests), in the tab bar or the
    /// Duo's rail. The schemes run in French.
    var rootTabButtons: XCUIElementQuery {
        let bar = tabBars.firstMatch
        if bar.exists { return bar.buttons }
        return buttons.matching(NSPredicate(format: "label IN %@", ["Accueil", "Budgets", "Objectifs", "Modèles"]))
    }
}
