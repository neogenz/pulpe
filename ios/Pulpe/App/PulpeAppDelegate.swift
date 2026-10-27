import UIKit

/// Lets the open iPhone Duo follow the device into landscape while every other window
/// (any other iPhone, the closed Duo) stays portrait. A portrait-only Info.plist pins
/// the inner display to whichever orientation it was entered in.
final class PulpeAppDelegate: NSObject, UIApplicationDelegate {
    private let observedWindows = NSHashTable<UIWindow>.weakObjects()

    func application(
        _ application: UIApplication,
        supportedInterfaceOrientationsFor window: UIWindow?
    ) -> UIInterfaceOrientationMask {
        guard let window else { return .portrait }
        if !observedWindows.contains(window) {
            observedWindows.add(window)
            // Closing the Duo in landscape shrinks the window to compact without asking
            // again: without this nudge the outer display would stay sideways.
            window.registerForTraitChanges(
                [UITraitHorizontalSizeClass.self, UITraitVerticalSizeClass.self]
            ) { (window: UIWindow, _) in
                window.rootViewController?.setNeedsUpdateOfSupportedInterfaceOrientations()
            }
        }
        // Both classes regular: a large iPhone held sideways is regular-width too, but its
        // height drops to compact, so launching it in landscape never unlocks rotation.
        let traits = window.traitCollection
        let isLargeDisplay = traits.horizontalSizeClass == .regular && traits.verticalSizeClass == .regular
        return isLargeDisplay ? .allButUpsideDown : .portrait
    }
}
