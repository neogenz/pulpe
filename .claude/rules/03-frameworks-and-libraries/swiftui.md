---
description: "SwiftUI view patterns, state management, and iOS 26 features"
paths: "ios/**/*.swift"
---

# SwiftUI

Standard SwiftUI composition applies as written. The layer structure, store injection and
navigation shape live in `ios-architecture.md`. What follows is what this project has been
bitten by.

## FORBIDDEN Wrappers

- `@StateObject` → `@State` with `@Observable`
- `@ObservedObject` → `@Environment` or `@Bindable`
- `@EnvironmentObject` → `@Environment(Type.self)`
- `@Published` → `@Observable` properties directly

## Sheet Presentation (iOS 26 Liquid Glass)

All sheets **must** have an explicit presentation background. Without one, iOS 26 Liquid
Glass transparency bleeds through:

```swift
// Good — the shared modifier (detents + drag indicator + corner radius + background)
.standardSheetPresentation()
.standardSheetPresentation(detents: [.medium, .large])

// Good — custom background (gradient sheets like RecoveryKeySheet)
.presentationBackground { Color.loginGradientBackground }

// Bad — glass bleeds through
.sheet(isPresented: $show) { MyView() }
```

A partial detent is **required** for the glass appearance: `.presentationDetents([.medium, .large])`.

## Liquid Glass (Navigation Layer Only)

Deployment target is **iOS 18.0** (`ios/project.yml`), so `glassEffect` is never called bare
— it is always gated, with a `.ultraThinMaterial` fallback, inside a shared modifier:

```swift
// Shared/Styles/GlassBackgroundModifier.swift — the real shape
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
```

**Rules:**
- Never call `.glassEffect()` from a view `body` — only from inside a `ViewModifier` that carries the gate and the fallback. `.glassCapsuleBackground(tint:)` and `.pulpeFloatingGlass(cornerRadius:)` cover the common cases; a feature-local modifier is fine when the rendering differs, as `HeroBalanceCard` does
- New glass site: gate with `#if compiler(>=6.2)` + `if #available(iOS 26.0, *)` and always ship a pre-26 fallback
- Apply glass ONLY to navigation elements (toolbars, tabs, floating buttons), NEVER to content (lists, cards, text)
- Remove explicit backgrounds that block glass transparency

## NavigationLink Gesture Conflicts (iOS 26)

iOS 26 refactored gesture recognizers — NavigationLink now swallows child gestures:

```swift
NavigationLink { destination } label: { content }
    .buttonStyle(.plain)              // Unlock child gestures
    .highPriorityGesture(myGesture)   // Win priority over nav
    .contentShape(Rectangle())        // Proper hit testing
```

## Animations

- Use `DesignTokens.Animation` springs for all animations, never hard-coded `.easeInOut`
- `gentleSpring` for soft confirmations, `bouncySpring` for playful interactions
- Always respect `@Environment(\.accessibilityReduceMotion)` for spring/bouncy animations

**Post-animation callbacks** must be tied to the animation lifecycle, never to a guessed delay:

```swift
// Good — iOS 17+ completion handler, handles reduced motion automatically
withAnimation(.spring(response: 0.5, dampingFraction: 0.8)) {
    isChecked = true
} completion: {
    onToggle()
}

// Bad — fragile, not tied to animation duration
DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) { onToggle() }
Task { try? await Task.sleep(for: .seconds(0.5)); onToggle() }
```

**SF Symbols:** `.contentTransition(.symbolEffect(.replace))` when the symbol *name* changes;
`.symbolEffect(.bounce, value:)` for a state-driven effect on the same symbol.

**Haptics:** `.sensoryFeedback(.success, trigger:)`, never `UIImpactFeedbackGenerator`.

## Safe Area Modifiers

### `.ignoresSafeArea` BEFORE `.frame`

`.ignoresSafeArea(edges:)` must apply **before** `.frame(height:)` for the view to extend into
the safe area. If `.frame` locks the height first, `.ignoresSafeArea` has nothing to extend.

```swift
// Good — extends into the safe area
VariableBlurView(maxBlurRadius: 8, direction: .blurredBottomClearTop)
    .allowsHitTesting(false)
    .ignoresSafeArea(edges: .bottom)
    .frame(height: 80)

// Bad — height already fixed by the time ignoresSafeArea runs
    .frame(height: 80)
    .ignoresSafeArea(edges: .bottom)
```

When a component applies `.frame` internally (like `ProgressiveBlurEdge`), inline the
underlying view and reorder the modifiers.

### Separate Overlays for Different Safe Area Behaviour

An overlay that needs `.ignoresSafeArea` and a sibling that must stay inside it need **two
separate `.overlay()` modifiers** — a shared ZStack absorbs `.ignoresSafeArea` and neither
child extends:

```swift
// Good
.overlay(alignment: .bottom) { BlurView().ignoresSafeArea(edges: .bottom) }
.overlay(alignment: .bottomTrailing) { FloatingButton().padding(.bottom, 16) }
```

## Anti-Patterns

| Don't | Do |
|-------|-----|
| `@StateObject` / `@ObservedObject` | `@State` / `@Environment` with `@Observable` |
| `ObservableObject` + `@Published` | `@Observable` macro |
| `.onAppear { Task { } }` | `.task { }` modifier |
| `NavigationView` | `NavigationStack(path:)` |
| Inline date/number formatters | Shared `Formatters/` singleton |
| Glass on content views | Glass on navigation elements only |
| `AsyncImage` without caching | NSCache wrapper or Nuke/Kingfisher |
| `DispatchQueue.main.asyncAfter` / `Task.sleep` for animation delay | `withAnimation { } completion: { }` |
| Hard-coded `.easeInOut(duration:)` | `DesignTokens.Animation` springs |
| `UIImpactFeedbackGenerator` | `.sensoryFeedback()` modifier |
