import SwiftUI

/// Custom tab bar using UISegmentedControl for selection logic only.
/// Visual content should be provided via SwiftUI overlay.
struct CustomTabBar: UIViewRepresentable {
    var size: CGSize
    var barTint: Color = .gray.opacity(0.2)
    @Binding var activeTab: Tab

    func makeCoordinator() -> Coordinator {
        Coordinator(parent: self)
    }

    func makeUIView(context: Context) -> UISegmentedControl {
        // Empty items - visual content provided by SwiftUI overlay
        let items = Tab.allCases.map { _ in "" }
        let control = UISegmentedControl(items: items)
        control.selectedSegmentIndex = activeTab.index

        // Hide background image views asynchronously (after view hierarchy is set up)
        DispatchQueue.main.async {
            for subview in control.subviews {
                if subview is UIImageView && subview != control.subviews.last {
                    subview.alpha = 0
                }
            }
        }

        control.selectedSegmentTintColor = UIColor(barTint)
        control.addTarget(context.coordinator, action: #selector(context.coordinator.tabSelected(_:)), for: .valueChanged)
        return control
    }

    func updateUIView(_ uiView: UISegmentedControl, context: Context) {
        // Sync only for programmatic changes (user taps are already handled by UIKit)
        // When user taps: UIKit updates selectedSegmentIndex BEFORE valueChanged fires,
        // so indices match and we skip the update (no double animation)
        // When programmatic: indices differ, so we update without animation to avoid
        // conflicting with Liquid Glass
        guard uiView.selectedSegmentIndex != activeTab.index else { return }

        CATransaction.begin()
        CATransaction.setDisableActions(true)
        uiView.selectedSegmentIndex = activeTab.index
        CATransaction.commit()
    }

    func sizeThatFits(_ proposal: ProposedViewSize, uiView: UISegmentedControl, context: Context) -> CGSize? {
        return size
    }

    @MainActor
    class Coordinator: NSObject {
        var parent: CustomTabBar
        init(parent: CustomTabBar) {
            self.parent = parent
        }

        @objc func tabSelected(_ control: UISegmentedControl) {
            parent.activeTab = Tab.allCases[control.selectedSegmentIndex]
        }
    }
}
