import Foundation
@testable import Pulpe
import Testing

@Suite("MainTabView floating tab bar layout")
struct MainTabViewLayoutTests {
    @Test("Floating tab bar hide requests are reference counted")
    func floatingTabBarHideRequestsAreReferenceCounted() {
        let envelopePageID = UUID()
        let formPageID = UUID()
        var requests = FloatingTabBarHideRequests()

        #expect(!requests.isHidden)

        requests.setHidden(true, for: envelopePageID)
        requests.setHidden(true, for: formPageID)
        #expect(requests.isHidden)

        requests.setHidden(false, for: formPageID)
        #expect(requests.isHidden)

        requests.setHidden(false, for: envelopePageID)
        #expect(!requests.isHidden)
    }

    @Test("Budgets drill-down hides floating tab bar via navigation path depth MainTabView")
    func budgetsDrillDownUsesBudgetPathForFloatingTabBar() throws {
        let source = try Self.source(
            "Pulpe",
            "App",
            "MainTabView.swift"
        )
        let compact = source.filter { !$0.isWhitespace }

        #expect(
            compact.contains("state.selectedTab==.budgets&&state.budgetPath.count>1"),
            """
            MainTabView should hide the floating tab bar when Budgets tab
            has pushed routes (envelope / tx forms) using budgetPath depth.
            """
        )
    }

    @Test("Floating tab bar ignores keyboard safe area")
    func floatingTabBarIgnoresKeyboardSafeArea() throws {
        let source = try Self.source(
            "Pulpe",
            "App",
            "MainTabView.swift"
        )
        let compact = source.filter { !$0.isWhitespace }

        #expect(compact.contains(".overlay{floatingTabBarOverlay("))
        #expect(compact.contains("ZStack(alignment:.bottom)"))
        #expect(compact.contains(".frame(maxWidth:.infinity,maxHeight:.infinity,alignment:.bottom)"))
        #expect(compact.contains(".ignoresSafeArea(.keyboard,edges:.bottom)"))
    }

    @Test("Sticky CTA can ignore keyboard at the safeAreaInset host level")
    func stickyCTAIgnoresKeyboardAtSafeAreaInsetHostLevel() throws {
        let source = try Self.source(
            "Pulpe",
            "Shared",
            "Extensions",
            "View+Extensions.swift"
        )
        let compact = source.filter { !$0.isWhitespace }

        let expectedFragment = "}else{content.safeAreaInset(edge:.bottom,spacing:0)"
            + "{stickyBottomCTAChrome}.ignoresSafeArea(.keyboard,edges:.bottom)}"
        #expect(
            compact.contains(expectedFragment),
            """
            `avoidsKeyboard: false` must apply `.ignoresSafeArea(.keyboard)`
            after the `safeAreaInset`; applying it to the content inside
            the inset is too late.
            """
        )
    }

    @Test("Envelope detail CTA opts out of keyboard avoidance")
    func envelopeDetailCTAOptsOutOfKeyboardAvoidance() throws {
        let source = try Self.source(
            "Pulpe",
            "Features",
            "Budgets",
            "BudgetDetails",
            "BudgetLineDetailPage.swift"
        )
        let compact = source.filter { !$0.isWhitespace }

        #expect(
            compact.contains(
                ".pulpeStickyBottomCTA(avoidsKeyboard:false){addTransactionButton(line:line)}"
            )
        )
    }

    @Test("Transaction forms clear focus on disappear")
    func transactionFormsClearFocusOnDisappear() throws {
        let formPaths = [
            ["Pulpe", "Features", "Budgets", "BudgetDetails", "AddAllocatedTransactionPage.swift"],
            ["Pulpe", "Features", "Budgets", "BudgetDetails", "EditTransactionPage.swift"]
        ]

        for path in formPaths {
            let source = try Self.source(path)
            let compact = source.filter { !$0.isWhitespace }

            #expect(compact.contains(".onDisappear{focusedField=nil}"))
        }
    }

    @Test("Visible floating tab bar is pinned with overlay, not safeAreaInset")
    func visibleFloatingTabBarUsesOverlay() throws {
        let source = try Self.source(
            "Pulpe",
            "App",
            "MainTabView.swift"
        )
        let compact = source.filter { !$0.isWhitespace }
        let usesOverlay = compact.contains(".overlay{floatingTabBarOverlay(")
        let usesSafeAreaInsetForVisibleBar = compact.contains(
            ".safeAreaInset(edge:.bottom,spacing:0){floatingTabBar("
        )

        #expect(
            usesOverlay,
            "The visible floating tab bar must be an overlay so it stays pinned after a push/pop."
        )
        #expect(
            !usesSafeAreaInsetForVisibleBar,
            "safeAreaInset can re-anchor the floating tab bar inside BudgetDetails after push/pop."
        )
    }

    private static func source(_ pathComponents: [String]) throws -> String {
        var url = URL(fileURLWithPath: #filePath)
        url = url.deletingLastPathComponent() // App/
        url = url.deletingLastPathComponent() // PulpeTests/
        url = url.deletingLastPathComponent() // ios/

        for pathComponent in pathComponents {
            url = url.appendingPathComponent(pathComponent)
        }

        return try String(contentsOf: url, encoding: .utf8)
    }

    private static func source(_ pathComponents: String...) throws -> String {
        try source(pathComponents)
    }
}
