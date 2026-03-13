import SwiftUI

struct GlassBackgroundModifier: ViewModifier {
    let tint: Color?

    func body(content: Content) -> some View {
        #if compiler(>=6.2)
        if #available(iOS 26.0, *) {
            let glass: Glass = if let tint { .regular.tint(tint) } else { .regular }
            content.glassEffect(glass, in: .capsule)
        } else {
            content.background(.ultraThinMaterial, in: Capsule())
        }
        #else
        content.background(.ultraThinMaterial, in: Capsule())
        #endif
    }
}

extension View {
    func glassCapsuleBackground(tint: Color? = nil) -> some View {
        modifier(GlassBackgroundModifier(tint: tint))
    }
}
