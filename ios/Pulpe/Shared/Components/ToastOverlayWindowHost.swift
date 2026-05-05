import OSLog
import SwiftUI
import UIKit

// MARK: - Public SwiftUI entry point

/// Zero-size anchor that lives in the main window.
/// Creates a dedicated `UIWindow` above all presentations (sheets, alerts)
/// and drives its content by explicitly pushing `ToastManager` state into
/// the separate `UIHostingController` on every change.
struct ToastOverlayWindowHost: View {
    @Bindable var toastManager: ToastManager

    var body: some View {
        ToastOverlayBridge(toastManager: toastManager)
            .frame(width: 0, height: 0)
            .allowsHitTesting(false)
            .accessibilityHidden(true)
    }
}

// MARK: - Bridge (UIViewControllerRepresentable)

private struct ToastOverlayBridge: UIViewControllerRepresentable {
    @Bindable var toastManager: ToastManager

    func makeUIViewController(context: Context) -> UIViewController {
        let vc = UIViewController()
        vc.view.isUserInteractionEnabled = false
        vc.view.backgroundColor = .clear
        return vc
    }

    func updateUIViewController(_ anchor: UIViewController, context: Context) {
        let controller = ToastOverlayWindowController.shared

        if controller.needsWindow {
            if let scene = anchor.view.window?.windowScene {
                controller.attach(to: scene, toastManager: toastManager)
            } else {
                context.coordinator.waitForScene(anchor: anchor, toastManager: toastManager)
            }
        }

        controller.push(toastManager.currentToast)
    }

    static func dismantleUIViewController(_: UIViewController, coordinator: Coordinator) {
        coordinator.cancel()
        ToastOverlayWindowController.shared.detach()
    }

    func makeCoordinator() -> Coordinator { Coordinator() }

    @MainActor
    final class Coordinator {
        private var task: Task<Void, Never>?

        func waitForScene(anchor: UIViewController, toastManager: ToastManager) {
            task?.cancel()
            task = Task { @MainActor [weak anchor] in
                for _ in 0 ..< 12 {
                    guard !Task.isCancelled, let anchor else { return }
                    if let scene = anchor.view.window?.windowScene {
                        ToastOverlayWindowController.shared.attach(to: scene, toastManager: toastManager)
                        return
                    }
                    try? await Task.sleep(for: .milliseconds(50))
                }
                #if DEBUG
                Logger.ui.warning("ToastOverlayWindowHost: UIWindowScene introuvable après ~600 ms")
                #endif
            }
        }

        func cancel() { task?.cancel(); task = nil }
    }
}

// MARK: - Pass-through UIWindow

/// Returns `super.hitTest` only when the tap lands inside `activeToastFrame`.
/// For every other point the window returns `nil` so touches fall through.
private final class PassthroughWindow: UIWindow {
    override var canBecomeKey: Bool { false }
    var activeToastFrame: CGRect = .zero

    override func hitTest(_ point: CGPoint, with event: UIEvent?) -> UIView? {
        guard activeToastFrame != .zero else { return nil }
        let global = convert(point, to: nil)
        guard activeToastFrame.contains(global) else { return nil }
        return super.hitTest(point, with: event)
    }
}

// MARK: - Window controller (singleton, @MainActor)

@MainActor
final class ToastOverlayWindowController {
    static let shared = ToastOverlayWindowController()
    private init() {}

    private var window: PassthroughWindow?
    private var hosting: UIHostingController<ToastContent>?

    var needsWindow: Bool { window == nil }

    func attach(to scene: UIWindowScene, toastManager: ToastManager) {
        guard window?.windowScene !== scene else { return }
        detach()

        let overlay = PassthroughWindow(windowScene: scene)
        overlay.backgroundColor = .clear
        overlay.windowLevel = .init(rawValue: UIWindow.Level.statusBar.rawValue + 1)
        overlay.isUserInteractionEnabled = true
        overlay.isHidden = false

        let content = ToastContent(
            toast: nil,
            dismiss: { toastManager.dismiss() },
            undo: { toastManager.executeUndo() }
        )
        let hostingController = UIHostingController(rootView: content)
        hostingController.view.backgroundColor = .clear

        overlay.rootViewController = hostingController
        window = overlay
        hosting = hostingController
    }

    /// Called on every SwiftUI update cycle — pushes the latest toast into the hosting controller.
    func push(_ toast: ToastManager.Toast?) {
        guard let hosting else { return }
        var root = hosting.rootView
        root.toast = toast
        hosting.rootView = root
    }

    func setFrame(_ frame: CGRect) {
        window?.activeToastFrame = frame
    }

    func detach() {
        window?.isHidden = true
        window?.rootViewController = nil
        window = nil
        hosting = nil
    }
}

// MARK: - Pure SwiftUI content rendered inside the overlay window

/// Stateless SwiftUI content whose only input is the current `Toast?`.
/// The `dismiss` / `undo` closures are captured once at creation and never change.
private struct ToastContent: View {
    var toast: ToastManager.Toast?
    let dismiss: () -> Void
    let undo: () -> Void

    var body: some View {
        ZStack(alignment: .top) {
            Color.clear
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .allowsHitTesting(false)

            if let toast {
                ToastView(
                    toast: toast,
                    onDismiss: dismiss,
                    onUndo: toast.hasUndo ? undo : nil
                )
                .safeAreaPadding(.top)
                // Marge sous encoche + respiration avant barre titre / gros en-têtes (évite le chevauchement visuel).
                .padding(.top, DesignTokens.Spacing.lg)
                .background(toastFrameReader)
                .transition(.move(edge: .top).combined(with: .opacity))
            }
        }
        .animation(DesignTokens.Animation.defaultSpring, value: toast)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .onChange(of: toast == nil) { _, isNil in
            if isNil { ToastOverlayWindowController.shared.setFrame(.zero) }
        }
    }

    private var toastFrameReader: some View {
        GeometryReader { geo in
            Color.clear
                .onAppear { ToastOverlayWindowController.shared.setFrame(geo.frame(in: .global)) }
                .onChange(of: geo.frame(in: .global)) { _, frame in
                    ToastOverlayWindowController.shared.setFrame(frame)
                }
        }
    }
}
