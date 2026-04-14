import OSLog
import SwiftUI
import UIKit

// MARK: - Public SwiftUI entry

/// Attaches a dedicated overlay `UIWindow` on the active `UIWindowScene` so toasts sit above
/// SwiftUI `.sheet` presentations (which live above ancestor `overlay` in the main window).
struct ToastOverlayWindowHost: View {
    @Bindable var toastManager: ToastManager

    var body: some View {
        ToastOverlayWindowRepresentable(toastManager: toastManager)
            .frame(width: 0, height: 0)
            .accessibilityHidden(true)
            .allowsHitTesting(false)
            // Subscribe to toast changes so `UIViewControllerRepresentable.updateUIViewController` runs.
            .onChange(of: toastManager.currentToast?.id) { _, _ in }
    }
}

// MARK: - UIViewControllerRepresentable

private struct ToastOverlayWindowRepresentable: UIViewControllerRepresentable {
    @Bindable var toastManager: ToastManager

    func makeUIViewController(context: Context) -> UIViewController {
        let vc = UIViewController()
        vc.view.isUserInteractionEnabled = false
        vc.view.backgroundColor = .clear
        return vc
    }

    func updateUIViewController(_ uiViewController: UIViewController, context: Context) {
        context.coordinator.scheduleSync(anchor: uiViewController, toastManager: toastManager)
    }

    static func dismantleUIViewController(_ uiViewController: UIViewController, coordinator: Coordinator) {
        coordinator.cancelPendingSync()
        ToastOverlayWindowController.shared.detachIfNeeded()
    }

    func makeCoordinator() -> Coordinator {
        Coordinator()
    }

    @MainActor
    final class Coordinator {
        private var pending: Task<Void, Never>?

        func scheduleSync(anchor: UIViewController, toastManager: ToastManager) {
            if let scene = anchor.view.window?.windowScene {
                pending?.cancel()
                pending = nil
                ToastOverlayWindowController.shared.sync(scene: scene, toastManager: toastManager)
                return
            }

            pending?.cancel()
            let capturedAnchor = anchor
            let manager = toastManager
            pending = Task { @MainActor in
                for _ in 0 ..< 12 {
                    guard !Task.isCancelled else { return }
                    if let scene = capturedAnchor.view.window?.windowScene {
                        ToastOverlayWindowController.shared.sync(scene: scene, toastManager: manager)
                        return
                    }
                    try? await Task.sleep(for: .milliseconds(50))
                }
                #if DEBUG
                Logger.ui.warning(
                    // swiftlint:disable:next line_length
                    "ToastOverlayWindowHost: UIWindowScene introuvable après ~600ms; l'overlay toast risque de ne pas s'afficher."
                )
                #endif
            }
        }

        func cancelPendingSync() {
            pending?.cancel()
            pending = nil
        }
    }
}

// MARK: - Overlay window

/// Forwards touches that only hit the hosting container through to windows below (e.g. sheet content).
private final class ToastOverlayWindow: UIWindow {
    override var canBecomeKey: Bool { false }

    override func hitTest(_ point: CGPoint, with event: UIEvent?) -> UIView? {
        guard !isHidden else { return nil }
        guard let hit = super.hitTest(point, with: event),
              let rootView = rootViewController?.view
        else { return nil }
        return hit === rootView ? nil : hit
    }
}

// MARK: - Controller

@MainActor
final class ToastOverlayWindowController {
    static let shared = ToastOverlayWindowController()

    private var overlayWindow: ToastOverlayWindow?
    private var hostingController: UIHostingController<ToastOverlayRootView>?

    private init() {}

    func sync(scene: UIWindowScene, toastManager: ToastManager) {
        if overlayWindow?.windowScene !== scene {
            tearDown()
            buildWindow(scene: scene, toastManager: toastManager)
        }
        overlayWindow?.isHidden = toastManager.currentToast == nil
    }

    func detachIfNeeded() {
        tearDown()
    }

    private func buildWindow(scene: UIWindowScene, toastManager: ToastManager) {
        let window = ToastOverlayWindow(windowScene: scene)
        window.backgroundColor = .clear
        window.windowLevel = .init(rawValue: UIWindow.Level.normal.rawValue + 1)
        window.isUserInteractionEnabled = true

        let rootView = ToastOverlayRootView(manager: toastManager)
        let hosting = UIHostingController(rootView: rootView)
        hosting.view.backgroundColor = .clear

        window.rootViewController = hosting
        window.isHidden = toastManager.currentToast == nil

        overlayWindow = window
        hostingController = hosting
    }

    private func tearDown() {
        overlayWindow?.isHidden = true
        overlayWindow?.rootViewController = nil
        overlayWindow = nil
        hostingController = nil
    }
}

// MARK: - SwiftUI root (même layout que `View.toastOverlay`)

private struct ToastOverlayRootView: View {
    @Bindable var manager: ToastManager

    var body: some View {
        ZStack(alignment: .top) {
            Color.clear
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .allowsHitTesting(false)

            if let toast = manager.currentToast {
                ToastView(
                    toast: toast,
                    onDismiss: { manager.dismiss() },
                    onUndo: toast.hasUndo ? { manager.executeUndo() } : nil
                )
                .safeAreaPadding(.top)
                .padding(.top, DesignTokens.Spacing.sm)
                .transition(.move(edge: .top).combined(with: .opacity))
            }
        }
        .animation(DesignTokens.Animation.defaultSpring, value: manager.currentToast)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}
