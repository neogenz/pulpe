import SwiftUI

/// Custom tab bar using UISegmentedControl for full layout control
/// Allows placing action buttons at the same level as tab items
struct CustomTabBar<Content: View>: UIViewRepresentable {
    var size: CGSize
    var barTint: Color = .gray.opacity(0.3)
    @Binding var activeTab: Tab
    @ViewBuilder var content: (Tab) -> Content

    func makeCoordinator() -> Coordinator {
        Coordinator(parent: self)
    }

    func makeUIView(context: Context) -> UISegmentedControl {
        let items = Tab.allCases.map(\.rawValue)
        let control = UISegmentedControl(items: items)
        control.selectedSegmentIndex = Tab.allCases.firstIndex(of: activeTab) ?? 0

        // Render SwiftUI views as images for each segment
        for (index, tab) in Tab.allCases.enumerated() {
            let renderer = ImageRenderer(content: content(tab))
            renderer.scale = 2
            if let image = renderer.uiImage {
                control.setImage(image, forSegmentAt: index)
            }
        }

        // Hide only background ImageViews (keep selection indicator)
        DispatchQueue.main.async {
            for subview in control.subviews {
                if subview is UIImageView && subview != control.subviews.last {
                    subview.alpha = 0
                }
            }
        }

        control.selectedSegmentTintColor = UIColor(barTint)

        control.addTarget(
            context.coordinator,
            action: #selector(Coordinator.tabSelected(_:)),
            for: .valueChanged
        )

        return control
    }

    func updateUIView(_ uiView: UISegmentedControl, context: Context) {
        uiView.selectedSegmentIndex = Tab.allCases.firstIndex(of: activeTab) ?? 0

        // Re-render images to update colors based on selection
        for (index, tab) in Tab.allCases.enumerated() {
            let renderer = ImageRenderer(content: content(tab))
            renderer.scale = 2
            if let image = renderer.uiImage {
                uiView.setImage(image, forSegmentAt: index)
            }
        }
    }

    func sizeThatFits(_ proposal: ProposedViewSize, uiView: UISegmentedControl, context: Context) -> CGSize? {
        size
    }

    class Coordinator: NSObject {
        var parent: CustomTabBar

        init(parent: CustomTabBar) {
            self.parent = parent
        }

        @objc func tabSelected(_ control: UISegmentedControl) {
            withAnimation(.smooth) {
                parent.activeTab = Tab.allCases[control.selectedSegmentIndex]
            }
        }
    }
}
