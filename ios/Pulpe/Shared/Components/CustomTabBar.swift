import SwiftUI

struct CustomTabBar<TabItemView: View>: UIViewRepresentable {
    var size: CGSize
    var activeTint: Color = .primary
    var inActiveTint: Color = .primary.opacity(0.45)
    var barTint: Color = .gray.opacity(0.2)
    @Binding var activeTab: Tab
    @ViewBuilder var tabItemView: (Tab) -> TabItemView

    func makeCoordinator() -> Coordinator {
        Coordinator(parent: self)
    }

    func makeUIView(context: Context) -> UISegmentedControl {
        let items = Tab.allCases.map(\.rawValue)
        let control = UISegmentedControl(items: items)
        control.selectedSegmentIndex = activeTab.index

        for (index, tab) in Tab.allCases.enumerated() {
            let renderer = ImageRenderer(content: tabItemView(tab))
            renderer.scale = 2
            let image = renderer.uiImage
            control.setImage(image, forSegmentAt: index)
        }

        DispatchQueue.main.async {
            for subview in control.subviews {
                if subview is UIImageView && subview != control.subviews.last {
                    subview.alpha = 0
                }
            }
        }

        control.selectedSegmentTintColor = UIColor(barTint)
        control.setTitleTextAttributes([
            .foregroundColor: UIColor(activeTint)
        ], for: .selected)
        control.setTitleTextAttributes([
            .foregroundColor: UIColor(inActiveTint)
        ], for: .normal)

        control.addTarget(context.coordinator, action: #selector(context.coordinator.tabSelected(_:)), for: .valueChanged)
        return control
    }

    func updateUIView(_ uiView: UISegmentedControl, context: Context) {
        uiView.selectedSegmentIndex = activeTab.index

        // Re-render images to reflect current selection colors
        for (index, tab) in Tab.allCases.enumerated() {
            let renderer = ImageRenderer(content: tabItemView(tab))
            renderer.scale = 2
            if let image = renderer.uiImage {
                uiView.setImage(image, forSegmentAt: index)
            }
        }
    }

    func sizeThatFits(_ proposal: ProposedViewSize, uiView: UISegmentedControl, context: Context) -> CGSize? {
        return size
    }

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
