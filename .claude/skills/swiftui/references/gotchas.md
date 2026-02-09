# SwiftUI Gotchas & Debugging Patterns

Hard-won debugging lessons and non-obvious pitfalls encountered in SwiftUI development.

---

## NSViewRepresentable Layout Pitfalls (macOS)

Wrapping SwiftUI views in `NSViewRepresentable` (via `NSHostingView`) introduces different sizing behavior that can break layout unexpectedly.

**Common mistake:** Creating custom window drag areas with `Color.clear.frame(maxWidth: .infinity, maxHeight: .infinity)` wrapped in NSViewRepresentable.

**What happens:** The `maxHeight: .infinity` constraint propagates through the NSHostingView wrapper differently than pure SwiftUI, causing parent containers (VStack, HStack) to expand incorrectly and push content out of position.

**Correct pattern for window dragging:**

```swift
// In App.swift / WindowGroup configuration
window.isMovableByWindowBackground = true  // Let macOS handle it natively

// Only prevent on elements that need drag-and-drop
final class NonDraggableHostingView<Content: View>: NSHostingView<Content> {
    override var mouseDownCanMoveWindow: Bool { false }
}

struct PreventWindowDrag<Content: View>: NSViewRepresentable {
    let content: Content

    func makeNSView(context: Context) -> NonDraggableHostingView<Content> {
        NonDraggableHostingView(rootView: content)
    }

    func updateNSView(_ nsView: NonDraggableHostingView<Content>, context: Context) {
        nsView.rootView = content
    }
}

extension View {
    func preventWindowDrag() -> some View {
        PreventWindowDrag(content: self)
    }
}

// Usage on draggable cards
ProjectCardView(...)
    .preventWindowDrag()  // Only this card won't trigger window drag
```

**Rule:** Don't fight macOS—use native `isMovableByWindowBackground` and surgically disable on specific elements, rather than trying to create custom drag areas with SwiftUI views wrapped in NSViewRepresentable.

---

## Swift ViewBuilder vs TableColumnBuilder Ambiguity

**Problem:** Compiler error about `Group` or unexpected behavior when using `Group { }` in certain contexts.

**Root cause:** Swift's `Group` has multiple initializers. In some contexts (especially with complex nested views), the compiler may pick `TableColumnBuilder` instead of `ViewBuilder`.

**Solution:** Explicitly specify the content parameter or annotate with `@ViewBuilder`:

```swift
// Option 1: Explicit content parameter
Group(content: {
    SectionA()
    SectionB()
})

// Option 2: @ViewBuilder annotation on computed property
@ViewBuilder
var body: some View {
    Group {
        SectionA()
        SectionB()
    }
}
```

---

## Hero Transitions with matchedGeometryEffect

**Common mistake:** Applying `matchedGeometryEffect` to entire view hierarchies with different content structures causes jittery animations—SwiftUI can't interpolate between incompatible layouts.

**Correct pattern:** Match only the container shape, crossfade the content.

```swift
@Namespace private var namespace
@State private var isExpanded = false

ZStack(alignment: .topLeading) {
    // Background shape morphs (position, size, corner radius)
    RoundedRectangle(cornerRadius: isExpanded ? 12 : 10, style: .continuous)
        .fill(isExpanded ? Color.card : Color.white.opacity(0.05))
        .matchedGeometryEffect(id: "container", in: namespace)

    // Content crossfades (no matchedGeometryEffect)
    if isExpanded {
        expandedContent
            .transition(.opacity.combined(with: .scale(scale: 0.98, anchor: .top)))
    } else {
        collapsedContent
            .transition(.opacity)
    }
}
.animation(.spring(response: 0.4, dampingFraction: 0.85), value: isExpanded)
```

**Why this works:** The background shape has consistent geometry (just different sizes), so SwiftUI interpolates smoothly. The content—which has incompatible structures—simply crossfades.

This is how Apple implements App Store card transitions.

---

## Origin-Based Modal Animation

Animate a modal expanding from (and collapsing to) a specific trigger location.

**Key challenges solved:**
- `onChange(of:)` doesn't fire on initial mount—need `onAppear` for initial state
- Conditional rendering (`if isPresented`) removes view immediately—no exit animation
- Nested `scaleEffect` with different anchors conflict

**Implementation pattern:**

```swift
// 1. Named coordinate space at container level
ContentView()
    .coordinateSpace(name: "container")

// 2. Capture trigger frame in that space
Button(action: { action(buttonFrame) }) { ... }
    .background(GeometryReader { geo in
        Color.clear.preference(key: FramePreferenceKey.self,
                               value: geo.frame(in: .named("container")))
    })
    .onPreferenceChange(FramePreferenceKey.self) { buttonFrame = $0 }

// 3. Modal: separate visibility state from animation state
@State private var isVisible = false    // Tree presence
@State private var animatedIn = false   // Animation driver

var anchorPoint: UnitPoint {
    guard let origin = originFrame, origin != .zero else { return .center }
    return UnitPoint(x: origin.midX / containerSize.width,
                     y: origin.midY / containerSize.height)
}

var body: some View {
    ZStack {
        if isVisible {
            content
                .scaleEffect(animatedIn ? 1 : 0.3, anchor: anchorPoint)
                .opacity(animatedIn ? 1 : 0)
        }
    }
    .onAppear {
        if isPresented {  // Handle already-true on mount
            isVisible = true
            withAnimation(.spring(response: 0.35, dampingFraction: 0.8)) {
                animatedIn = true
            }
        }
    }
    .onChange(of: isPresented) { _, show in
        if show {
            isVisible = true
            withAnimation(.spring(response: 0.35, dampingFraction: 0.8)) {
                animatedIn = true
            }
        } else {
            withAnimation(.spring(response: 0.28, dampingFraction: 0.9)) {
                animatedIn = false
            } completion: {
                isVisible = false  // Remove after animation
            }
        }
    }
}
```

**Why this works:**
- Named coordinate space ensures consistent measurements between trigger and modal
- `isVisible` keeps view in tree during exit animation
- `animatedIn` provides state that changes (unlike `isPresented` already true on mount)
- `completion:` sequences removal after animation finishes

---

## Effect Modifier Order: Blur and Clip

**Problem:** Content with blur applied extends beyond rounded corners, causing visual overflow.

**Why:** Gaussian blur samples neighboring pixels, expanding the rendered area beyond the original view bounds. A clip applied *before* blur constrains the input, but the blur output still extends past the boundary.

**Correct pattern:** Apply `.clipShape()` AFTER `.blur()` to trim the output.

```swift
// Wrong - blur extends beyond clip
.clipShape(RoundedRectangle(cornerRadius: 22))
.blur(radius: 8)

// Correct - blur output is trimmed
.blur(radius: 8)
.clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
```

**Related caveat:** `.ignoresSafeArea()` can override ancestor clip shapes. If content still pokes out corners after clipping, check for safe area modifiers on child views.

---

## Overlay Technique for Drag-and-Drop Reordering

**Problem:** SwiftUI's declarative `.animation()` modifier conflicts with imperative `DragGesture` control. When you have a list that animates on reorder AND a dragged item following the cursor, both systems fight—causing jitter, bouncing, or erratic behavior.

**Root cause:** `withAnimation` and `.animation()` modifiers affect ALL state changes within their scope. When a drag gesture continuously updates position while the list is also animating reorder changes, SwiftUI tries to animate both simultaneously with conflicting intent.

**Solution: The Overlay Technique**

Render the dragged item in a separate overlay layer, completely isolated from the list's animation system.

```swift
@State private var draggingId: String?
@State private var dragPosition: CGPoint = .zero
@State private var containerFrame: CGRect = .zero
@State private var isAnimatingRelease = false

var body: some View {
    ZStack(alignment: .topLeading) {
        // Layer 1: The list (items animate freely)
        listContent
            .background(GeometryReader { geo in
                Color.clear.onAppear { containerFrame = geo.frame(in: .global) }
            })

        // Layer 2: Dragged item overlay (follows cursor directly)
        if let item = draggingItem {
            ItemRow(item: item)
                .frame(height: rowHeight)
                .scaleEffect(isAnimatingRelease ? 1.0 : 1.03)
                .shadow(color: .black.opacity(isAnimatingRelease ? 0 : 0.3),
                        radius: isAnimatingRelease ? 0 : 12, y: 4)
                .position(x: containerFrame.width / 2,
                          y: dragPosition.y - containerFrame.minY)
                .animation(.spring(response: 0.3, dampingFraction: 1.0), value: dragPosition)
                .allowsHitTesting(false)
        }
    }
}

private var listContent: some View {
    VStack(spacing: rowSpacing) {
        ForEach(items) { item in
            ItemRow(item: item)
                .opacity(draggingId == item.id ? 0 : 1)  // Hide original
                .gesture(DragGesture(coordinateSpace: .global)
                    .onChanged { handleDrag(item: item, position: $0.location) }
                    .onEnded { _ in handleDragEnd() })
        }
    }
    // Safe to animate—dragged item is in overlay, not here
    .animation(.spring(response: 0.3, dampingFraction: 0.9), value: items.map(\.id))
}

private func handleDragEnd() {
    guard let id = draggingId else { return }
    let targetIndex = items.firstIndex { $0.id == id } ?? 0
    let targetY = containerFrame.minY + (CGFloat(targetIndex) * (rowHeight + rowSpacing)) + (rowHeight / 2)

    // Animate overlay to final position
    isAnimatingRelease = true
    dragPosition = CGPoint(x: dragPosition.x, y: targetY)

    // Clean up after animation
    DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
        draggingId = nil
        dragPosition = .zero
        isAnimatingRelease = false
    }
}
```

**Why this works:**
1. **List items** use `.animation()` modifier—declarative, animates when array identity changes
2. **Overlay item** uses `.position()` following cursor—imperative, updates directly
3. **No conflict** because they're in separate layers; SwiftUI never tries to animate both
4. **Release animation**: Animate `dragPosition` to target slot before hiding overlay

**macOS floating window caveat:** When `window.isMovableByWindowBackground = true`, background clicks move the window—intercepting drag gestures. Wrap draggable content in an `NSViewRepresentable` that returns `false` from `mouseDownCanMoveWindow`:

```swift
private struct NonMovableBackground: NSViewRepresentable {
    private class NonMovableNSView: NSView {
        override var mouseDownCanMoveWindow: Bool { false }
    }
    func makeNSView(context: Context) -> NSView {
        let view = NonMovableNSView()
        view.wantsLayer = true
        return view
    }
    func updateNSView(_ nsView: NSView, context: Context) {}
}

// Usage: wrap each draggable row
ItemRow(item: item)
    .background(NonMovableBackground())
```

---

## Static Singleton Initialization Deadlock

**Problem:** App crashes with `EXC_BREAKPOINT` in `dispatch_once_wait` during static singleton initialization.

**Root cause:** A static singleton's initializer references a computed property that accesses the same singleton, creating a circular dependency during `dispatch_once`.

**Example of the bug:**
```swift
class GlassConfig: ObservableObject {
    static let shared = GlassConfig()  // Triggers init()

    // BAD: .statusWorking accesses GlassConfig.shared -> deadlock
    @Published var vignetteColor: Color = .statusWorking
}

extension Color {
    static var statusWorking: Color {
        let config = GlassConfig.shared  // Deadlock here!
        return Color(hue: config.workingHue, ...)
    }
}
```

**Solution:** Use raw values in singleton property initializers, never computed properties that might reference the singleton:

```swift
// GOOD: Raw value, no external dependencies
@Published var vignetteColor: Color = Color(hue: 0.103, saturation: 1.0, brightness: 1.0)
```

**Debugging tip:** LLDB backtrace will show the circular call pattern clearly:
```
frame #2: GlassConfig.shared.unsafeMutableAddressor()
frame #3: static Color.statusWorking.getter()
frame #4: GlassConfig.init()
frame #6: one-time initialization function for shared()
```
