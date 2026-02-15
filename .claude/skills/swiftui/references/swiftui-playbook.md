# The World-Class SwiftUI UI Playbook

Complete reference for designing and implementing Apple-level SwiftUI interfaces.

---

## 1) Design "Physics" Apple-Level UIs Obey

### Visual Hierarchy via Layout, Not Decoration

With modern Apple UI (especially Liquid Glass), emphasis shifts from borders/backgrounds to **grouping + spacing + structure**.

**Tactics:**
- **Grouping** shows relationship
- **Distance** shows separation
- **Alignment** shows intent
- **Tint** only for meaning/primary action (never decoration)

### Typography Rules

- Prefer semantic styles: `.font(.title)`, `.font(.headline)`, `.font(.body)`
- Avoid hard sizing (`.font(.system(size: 17))`) unless tested with Dynamic Type
- Use sparingly: `.minimumScaleFactor(0.8)`, `.lineLimit(...)`
- Use `.multilineTextAlignment(.leading)` for most reading
- Use `@ScaledMetric` for padding around text-heavy elements

### Spacing Scale

Pick and stick to: **4, 8, 12, 16, 20, 24, 32, 40**

- Larger jumps (24-40) for section breaks
- Small steps (8-16) inside components
- **Spacing communicates hierarchy** as much as font weight

### Shape: Concentricity

Modern Apple UI emphasizes **concentricity**—nested rounded corners sharing centers.

**iOS 26+:** Use `ConcentricRectangle()` for inner surfaces matching outer container shape.

```swift
ZStack {
    ConcentricRectangle()
        .fill(.background)
        .padding(8)
    // inner content...
}
.ignoresSafeArea()
```

---

## 2) Liquid Glass Design System (iOS 26+)

### Core Concept: Content vs Controls Layer

Liquid Glass is a **distinct functional layer** for controls/navigation floating above content.

**Tactics:**
- Avoid controls directly on busy content without separating surface
- For loud content (photos/video): add system material behind controls or reposition content

### Remove Custom Bar Decoration

Remove custom `toolbarBackground`, heavy overlays, manual darkening. Let system scroll edge effects provide legibility.

**Don't:** Stack your own blur/dim layers under toolbars.

### Tinting Rules

Tint only:
- Primary CTA
- State/priority indicators

Don't tint:
- Every toolbar icon
- Every button in a cluster
- Decorative accents

### Scroll Edge Effects

- Use **one** per view/pane
- Soft on iOS/iPadOS; hard on macOS
- Don't apply where no floating UI exists
- Don't mix/stack styles

### Tab Bar Features (iOS 26)

**Minimize on scroll:**
```swift
.tabBarMinimizeBehavior(.onScrollDown)
```

**Bottom accessory for persistent features:**
```swift
.tabViewBottomAccessory { /* playback controls */ }
```

Design rule: Persistent accessory ≠ contextual CTA.

### Search Patterns

**Pattern A: Toolbar search**
- Place `searchable` high in hierarchy
- Use `.searchToolbarBehavior(.minimize)` when secondary

**Pattern B: Dedicated search tab**
- Assign search role to tab
- Search field replaces tab bar when selected

### Sheets

iOS 26 partial sheets are inset with Liquid Glass background. Remove custom sheet backgrounds to let system material work.

### Custom Glass in SwiftUI

```swift
// Basic glass
Text("Label")
    .glassEffect()              // capsule shape default

// Interactive (for controls)
Button("Action") { }
    .glassEffect(.interactive)  // scale/bounce/shimmer

// Custom shape
Text("Badge")
    .glassEffect(in: RoundedRectangle(cornerRadius: 8))

// Glass variants
.glassEffect(.regular)   // Standard translucent
.glassEffect(.clear)     // Minimal, subtle
.glassEffect(.identity)  // No glass (for conditional)

// Group nearby glass
@Namespace private var glassNS

GlassEffectContainer {
    HStack {
        GlassBadge(text: "Gold")
        GlassBadge(text: "Visited")
    }
    .glassEffectID("badges", in: glassNS)
}

// Morphing transitions
.glassEffectID("panel", in: namespace)
```

**Key rule:** Glass can't sample other glass—use `GlassEffectContainer` for nearby elements.

### Button Styles (iOS 26)

```swift
// Glass button styles
Button("Action") { }
    .buttonStyle(.glass)              // Liquid Glass styling
    .buttonStyle(.glassProminent)     // Prominent glass variant

// Close button role (X mark with glass in toolbars)
Button(role: .close) { dismiss() }
```

### Liquid Glass Sheets

Partial detents are **required** for Liquid Glass sheet appearance:

```swift
.sheet(isPresented: $show) {
    InfoView()
        .presentationDetents([.medium, .large])  // Required for glass
        // Remove custom backgrounds — let system material work
}
```

---

## 3) Design System Implementation

### Token System Structure

```swift
struct AppTheme {
    var spacing = Spacing()
    var radius = Radius()
    var motion = Motion()
}

extension AppTheme {
    struct Spacing {
        let xxs: CGFloat = 4
        let xs: CGFloat  = 8
        let sm: CGFloat  = 12
        let md: CGFloat  = 16
        let lg: CGFloat  = 24
        let xl: CGFloat  = 32
        let xxl: CGFloat = 40
    }

    struct Radius {
        let sm: CGFloat = 10
        let md: CGFloat = 16
        let lg: CGFloat = 24
    }

    struct Motion {
        let quick = Animation.snappy(duration: 0.2)
        let standard = Animation.snappy(duration: 0.35)
        let emphasize = Animation.bouncy(duration: 0.45)
    }
}

private struct ThemeKey: EnvironmentKey {
    static let defaultValue = AppTheme()
}

extension EnvironmentValues {
    var theme: AppTheme {
        get { self[ThemeKey.self] }
        set { self[ThemeKey.self] = newValue }
    }
}

extension View {
    func theme(_ theme: AppTheme) -> some View {
        environment(\.theme, theme)
    }
}
```

### Scaled Spacing Pattern

```swift
struct Card: ViewModifier {
    @ScaledMetric(relativeTo: .body) private var padding: CGFloat = 16
    func body(content: Content) -> some View {
        content.padding(padding)
    }
}
```

### Semantic Colors and Materials

- Prefer: `.primary`, `.secondary`, `.tertiary`, `.quaternary`
- Use: `.background`, `.secondarySystemBackground`
- For glass: use `Material`, `glassEffect` (not custom blurs)

---

## 4) Layout Patterns

### Adaptive Structure

Design "anatomy" once, let it scale. Use:
- `NavigationSplitView` for iPad/Mac hierarchical
- `TabView` for top-level switching
- `NavigationStack` for deep flows

### Container Selection

| Container | Best For |
|-----------|----------|
| `List` | Large dynamic datasets, selection, swipe, edit mode, accessibility |
| `ScrollView` + `LazyVStack` | Custom surfaces, cards, mixed content |
| `Grid` | Forms, settings, dense structured |
| `LazyVGrid` | Responsive galleries |

### Stable Identity

```swift
// Good
ForEach(items, id: \.id) { item in ... }

// Bad - regenerates each render
ForEach(items, id: \.self) { item in ... }

// Never do
ForEach(items) { item in
    Row().id(UUID())  // Resets state every render
}
```

### Dynamic Type-Proof Layouts

```swift
// Switch layout based on fit
ViewThatFits {
    HStack { content }
    VStack { content }
}

// Priority for important text
HStack {
    Text(title).layoutPriority(1)
    Spacer()
    badge
}

// Force multi-line expansion
Text(longTitle)
    .fixedSize(horizontal: false, vertical: true)
```

### Safe Area Patterns

```swift
// Floating CTA bar
.safeAreaInset(edge: .bottom) {
    PrimaryCTABar()
}

// Background extension (iOS 26)
.backgroundExtensionEffect()  // Extends behind sidebars with mirror+blur
```

### NSViewRepresentable Layout Pitfalls (macOS)

Wrapping SwiftUI in NSViewRepresentable introduces different sizing. Use native `isMovableByWindowBackground` and surgically disable on specific elements. See [gotchas.md](gotchas.md) for the full pattern.

### Swift ViewBuilder vs TableColumnBuilder Ambiguity

Swift's `Group` has multiple initializers and the compiler may pick `TableColumnBuilder` instead of `ViewBuilder` in complex contexts. See [gotchas.md](gotchas.md) for the fix.

---

## 5) Toolbars and Navigation

### Toolbar Grouping

- Group by **function and frequency**
- Remove items or move secondary to menu if crowded
- Don't group symbols with text (reads as one button)

### ToolbarSpacer

```swift
.toolbar(id: "main") {
    ToolbarItem(id: "tag") { TagButton() }
    ToolbarItem(id: "share") { ShareButton() }

    ToolbarSpacer(.fixed)

    ToolbarItem(id: "more") { MoreButton() }
}
```

### Hide Shared Background

For items that shouldn't participate in grouped glass:

```swift
.toolbar {
    ToolbarItem(placement: .principal) {
        Avatar()
    }
    .sharedBackgroundVisibility(.hidden)
}
```

### Badges on Toolbar Items

Use for "something changed" indicators. Keep rare—too many becomes noise.

---

## 6) Lists and Scroll Effects

### Signature Effect Pattern

Use `scrollTransition` for scroll-driven motion. Pick **one** effect per surface.

```swift
.scrollTransition(axis: .horizontal) { content, phase in
    content
        .rotationEffect(.degrees(phase.value * 2.5))
        .offset(y: phase.isIdentity ? 0 : 8)
}
```

### Visual Effect (Geometry-Aware)

```swift
.visualEffect { content, proxy in
    content
        .opacity(proxy.frame(in: .scrollView).minY > 0 ? 1 : 0.5)
}
```

Great for: subtle parallax, fade near edges, depth shifts.

### Scroll Edge Effect Tuning

```swift
.scrollEdgeEffectStyle(.soft)  // iOS/iPadOS typical
.scrollEdgeEffectStyle(.hard)  // macOS for stronger separation
```

---

## 7) Animation Patterns

### State-Driven Animation

```swift
// Model state
@State private var isExpanded = false

// Animate between states
Button("Toggle") {
    withAnimation(.snappy) {
        isExpanded.toggle()
    }
}

// Or implicit
.animation(.snappy, value: isExpanded)
```

### Custom Transition

```swift
struct SlideAndFade: Transition {
    func body(content: Content, phase: TransitionPhase) -> some View {
        content
            .offset(y: phase.isIdentity ? 0 : 20)
            .opacity(phase.isIdentity ? 1 : 0)
    }
}

// Usage
.transition(SlideAndFade())
```

Use for: onboarding reveals, mode switches, panel show/hide.
Avoid for: simple list updates, frequent toggles.

### Hero Transitions with matchedGeometryEffect

Match only the container shape and crossfade the content -- applying `matchedGeometryEffect` to entire view hierarchies causes jitter. See [gotchas.md](gotchas.md) for the correct pattern and code.

### Origin-Based Modal Animation

Animate a modal expanding from (and collapsing to) a specific trigger location. Requires separating visibility state from animation state to handle `onAppear` and exit animations. See [gotchas.md](gotchas.md) for the full implementation pattern.

### @Animatable Macro (iOS 26)

Simplifies custom animatable properties — no more manual `animatableData`:

```swift
@Animatable
struct PulseModifier: ViewModifier {
    var scale: CGFloat = 1.0

    func body(content: Content) -> some View {
        content.scaleEffect(scale)
    }
}
```

### SF Symbols 7 Animations

```swift
// Draw-on animation (symbol draws itself)
Image(systemName: "checkmark.circle")
    .symbolEffect(.drawOn)

// Draw-off (reverse)
Image(systemName: "xmark.circle")
    .symbolEffect(.drawOff)
```

Three playback styles: whole symbol, offset layers, reveal-by-layer. Automatic gradients from single colors.

### Text Renderer (Advanced)

Line-by-line or glyph-by-glyph animation via `TextRenderer`. Use only for marketing-quality onboarding or key value proposition emphasis.

### Shaders

Use `layerEffect` with `keyframeAnimator` for:
- Touch ripples
- Subtle texture fills
- "Premium" interactions

Always: Reduce Motion fallback, rare and meaningful.

### Effect Modifier Order: Blur and Clip

Blur extends the rendered area beyond view bounds. Apply `.clipShape()` AFTER `.blur()`, not before. See [gotchas.md](gotchas.md) for details and related `.ignoresSafeArea()` caveat.

### Overlay Technique for Drag-and-Drop Reordering

Declarative `.animation()` conflicts with imperative `DragGesture` control. Render the dragged item in a separate overlay layer to isolate it from the list's animation system. See [gotchas.md](gotchas.md) for the full implementation and macOS floating window caveat.

---

## 8) Data Flow Architecture

### Identity, Lifetime, Dependencies

- **Identity** determines if view is "same thing" across updates (changing resets state)
- **Lifetime** affects when state created/destroyed (mis-scoped @StateObject causes repeated loads)
- **Dependencies** drive invalidation (reduce in expensive subtrees)

### Observation Pattern

```swift
@Observable
class ViewModel {
    var items: [Item] = []
    var isLoading = false
}

// View only re-renders when accessed properties change
struct ItemList: View {
    var viewModel: ViewModel

    var body: some View {
        List(viewModel.items) { item in
            ItemRow(item: item)
        }
    }
}
```

### Static Singleton Initialization Deadlock

A static singleton's initializer referencing a computed property that accesses the same singleton causes a `dispatch_once` deadlock. Use raw values in singleton property initializers. See [gotchas.md](gotchas.md) for the pattern and debugging tip.

### Architecture Selection

- **MVVM**: Simple and effective for most features
- **Unidirectional (TCA-style)**: Complex navigation + async + lots of state + edge cases

### Compose Small Views

Extract: row rendering, headers, cards, toolbars. Keep each focused and previewable.

---

## 9) Performance

### SwiftUI Instrument (Instruments 26)

1. Reproduce hitch/hang
2. Record with SwiftUI template
3. Check: **Long View Body Updates**, **Update Groups**, representable updates
4. Use **Cause & Effect Graph** to visualize state → view update chains
5. Identify triggering state changes
6. Reduce dependency scope or move work off main thread

Color coding: orange/red = higher likelihood of hitches/hangs.

### Body Must Be Cheap

**Don't do in body:**
- Sorting/filtering large arrays
- Date formatting in loops
- Image decoding
- Any synchronous I/O

**Do:**
- Precompute in model layer
- Cache derived values
- Move formatting to precomputed strings

### Dependency Hygiene

- Keep `@State` local to smallest subtree
- Pass `Binding` or derived values, not whole model
- Use `Equatable` conformance where it helps
- Ensure stable `id` in lists

### Equatable Conformance

SwiftUI diffs views using reflection by default. Equatable conformance enables faster, direct comparison.

```swift
struct TransactionRow: View, Equatable {
    let transaction: Transaction

    static func == (lhs: Self, rhs: Self) -> Bool {
        lhs.transaction.id == rhs.transaction.id
            && lhs.transaction.amount == rhs.transaction.amount
    }

    var body: some View { /* ... */ }
}
```

Use on frequently-rendered rows in scrollable lists.

### List Performance (iOS 26)

- 6x faster loading for 100,000+ items
- 16x faster updates
- Prefer `List` over `LazyVStack` for very large datasets — `List` recycles views like `UITableView`

### Canvas for Complex Drawing

Use `Canvas` instead of composing many views for data visualizations or particle effects:

```swift
Canvas { context, size in
    for point in dataPoints {
        context.fill(
            Circle().path(in: CGRect(origin: point, size: CGSize(width: 6, height: 6))),
            with: .color(.blue)
        )
    }
}
```

Metal-backed, GPU-accelerated. Use `drawingGroup()` for complex layered compositions that don't need Canvas.

### AsyncImage Caching Caveat

`AsyncImage` does **not** cache images between re-renders. For image-heavy apps:
- Use `NSCache` wrapper or third-party (Nuke, Kingfisher)
- Never rely on `AsyncImage` alone for production scrollable lists

---

## 10) Accessibility

### Dynamic Type

- System text styles only (`.title`, `.body`, `.caption`, etc.)
- Don't clip large text — use `.fixedSize(horizontal: false, vertical: true)`
- Layout adapts: stacks turn vertical, rows multi-line
- Toolbars use menus when crowded
- Use `@ScaledMetric` for custom spacing near text
- Test at XXL+ accessibility sizes

```swift
// Adaptive layout based on text size
@Environment(\.sizeCategory) var sizeCategory

var body: some View {
    if sizeCategory.isAccessibilityCategory {
        VStack { content }
    } else {
        HStack { content }
    }
}
```

### VoiceOver

- Use `Label` and `LabeledContent` (better semantics)
- Add `.accessibilityLabel`, `.accessibilityValue`, `.accessibilityHint`
- Focus order matches reading order
- Hide decorative elements: `.accessibility(hidden: true)`
- Group related content: `.accessibilityElement(children: .combine)`

### Accessibility Element Grouping

```swift
// Combine children into one VoiceOver element
HStack {
    Image(systemName: "star.fill")
    Text("4.8")
    Text("(230 reviews)")
}
.accessibilityElement(children: .combine)

// Ignore children, provide custom label
HStack { /* complex layout */ }
.accessibilityElement(children: .ignore)
.accessibilityLabel("Rating: 4.8 out of 5, 230 reviews")
```

Options: `.combine` (join labels), `.ignore` (custom label), `.contain` (container)

### Accessibility Traits

```swift
Text("Budget Overview")
    .accessibility(addTraits: .isHeader)  // VoiceOver can skip to headers

Button { } label: { customView }
    .accessibility(removeTraits: .isButton)  // Remove if misleading
```

Key traits: `.isHeader`, `.isButton`, `.isLink`, `.isSummaryElement`, `.updatesFrequently`, `.isSearchField`

### Focus Management

```swift
@AccessibilityFocusState private var focusedField: Field?

enum Field { case name, amount }

TextField("Name", text: $name)
    .accessibilityFocused($focusedField, equals: .name)

// Move focus programmatically after action
Button("Save") {
    if validate() { save() }
    else { focusedField = .name }
}
```

### Custom Actions

```swift
// Add VoiceOver swipe-up/down actions
TransactionRow(transaction: tx)
    .accessibilityAction(named: "Supprimer") { delete(tx) }
    .accessibilityAction(named: "Modifier") { edit(tx) }

// Adjustable elements (slider-like)
.accessibilityAdjustableAction { direction in
    switch direction {
    case .increment: value += 1
    case .decrement: value -= 1
    @unknown default: break
    }
}
```

### Accessibility Rotor

```swift
// Quick navigation by category
ScrollView {
    content
}
.accessibilityRotor("Catégories") {
    ForEach(categories) { cat in
        AccessibilityRotorEntry(cat.name, id: cat.id) {
            scrollProxy.scrollTo(cat.id)
        }
    }
}
```

### Custom Content (AXCustomContent)

```swift
// Additional info read on demand by VoiceOver
BudgetCard(budget: budget)
    .accessibilityCustomContent("Restant", budget.formattedRemaining)
    .accessibilityCustomContent("Dépensé", budget.formattedSpent, importance: .high)
```

Importance `.high` = read immediately. `.default` = user must swipe for more info.

### Large Content Viewer

```swift
// Long-press shows enlarged content (toolbar items, small controls)
ToolbarItem {
    Button { } label: { Image(systemName: "gear") }
        .accessibilityShowsLargeContentViewer {
            Label("Paramètres", systemImage: "gear")
        }
}
```

### Accessibility Notifications

```swift
// Announce dynamic changes to VoiceOver
AccessibilityNotification.Announcement("Élément ajouté").post()

// After layout changes
AccessibilityNotification.LayoutChanged(nil).post()
```

### Motion and Transparency

```swift
@Environment(\.accessibilityReduceMotion) private var reduceMotion
@Environment(\.accessibilityReduceTransparency) private var reduceTransparency

// Reduce Motion: replace animation with crossfade
.animation(reduceMotion ? nil : .spring(), value: isExpanded)

// Reduce Transparency: solid background instead of glass/blur
.background(reduceTransparency ? Color(.systemBackground) : .clear)
```

### Color Contrast (WCAG)

| Standard | Normal text | Large text (14pt bold / 18pt+) | UI components |
|----------|-------------|-------------------------------|---------------|
| **AA (minimum)** | 4.5:1 | 3:1 | 3:1 |
| **AAA (enhanced)** | 7:1 | 4.5:1 | — |

Critical with Liquid Glass: test contrast on translucent surfaces. Use Accessibility Inspector in Xcode.

### Touch Targets

Minimum 44×44pt. For small icons:

```swift
Button {
    // action
} label: {
    Image(systemName: "star")
        .padding(12)  // Expands touch target
}
.contentShape(Rectangle())
```

### Accessibility Nutrition Labels (iOS 26)

Declare supported accessibility features in App Store Connect:
- VoiceOver, Voice Control, Larger Text, Sufficient Contrast, Reduced Motion, Captions

Currently voluntary, becoming **mandatory** for app submissions. Evaluate with WWDC25 session "Evaluate your app for Accessibility Nutrition Labels".

---

## 11) Haptic Feedback

### .sensoryFeedback() (iOS 17+, preferred)

```swift
// Declarative — preferred in SwiftUI
Button("Valider") { submit() }
    .sensoryFeedback(.success, trigger: isSubmitted)

// Impact on value change
Toggle("Activer", isOn: $isEnabled)
    .sensoryFeedback(.impact(weight: .light), trigger: isEnabled)
```

| Feedback | Use Case |
|----------|----------|
| `.success` | Completed action, saved |
| `.warning` | Caution, destructive action about to happen |
| `.error` | Failed validation, error |
| `.impact(weight:)` | Button taps, toggles, selection |
| `.selection` | Picker value change, tab switch |
| `.increase` / `.decrease` | Volume, slider adjustment |

### Rules

- Use sparingly — haptics lose meaning when overused
- Match intensity to action importance
- Always pair with visual feedback
- Test on device (simulator has no haptics)

---

## 12) Implementation Recipes

### Screen Scaffold

```swift
struct Screen<Content: View>: View {
    let title: String
    @ViewBuilder var content: Content

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                content
            }
            .padding(.horizontal, 16)
            .padding(.top, 12)
        }
        .navigationTitle(title)
    }
}
```

### Liquid Glass Badge (iOS 26+)

```swift
struct GlassBadge: View {
    let text: String

    var body: some View {
        Text(text)
            .font(.caption.weight(.semibold))
            .padding(.horizontal, 10)
            .padding(.vertical, 6)
            .glassEffect()
    }
}
```

### Empty State

```swift
struct EmptyState: View {
    let icon: String
    let title: String
    let message: String
    let action: (() -> Void)?
    let actionLabel: String?

    var body: some View {
        ContentUnavailableView {
            Label(title, systemImage: icon)
        } description: {
            Text(message)
        } actions: {
            if let action, let label = actionLabel {
                Button(label, action: action)
            }
        }
    }
}
```

---

## 13) ADA-Level Review Checklist

### Visual Hierarchy
- [ ] One clear hero element
- [ ] One primary action per moment
- [ ] Secondary actions grouped or in menus
- [ ] No unnecessary decoration behind toolbars/tab bars

### Motion & Feedback
- [ ] Motion communicates causality
- [ ] Effects rare and purposeful
- [ ] Reduce Motion fallback exists
- [ ] Haptic feedback on key interactions (.sensoryFeedback)

### Liquid Glass (iOS 26+)
- [ ] Glass for navigation/control layer only
- [ ] No glass-on-glass clutter
- [ ] Tint only for meaning/primary actions
- [ ] Scroll edge effects only where appropriate
- [ ] Nearby glass grouped in `GlassEffectContainer`
- [ ] Partial detent set for Liquid Glass sheets

### Accessibility
- [ ] Dynamic Type works at XXL+
- [ ] VoiceOver labels/hints on non-obvious controls
- [ ] Contrast meets WCAG AA (4.5:1 text, 3:1 UI)
- [ ] 44×44pt touch targets
- [ ] accessibilityElement grouping on composite views
- [ ] Header traits on section titles
- [ ] Focus management after modal dismiss (@AccessibilityFocusState)
- [ ] Reduce Transparency fallback for glass effects
- [ ] AccessibilityNotification for dynamic content changes

### Performance
- [ ] No heavy work in body
- [ ] Stable identity in lists
- [ ] Equatable conformance on frequently-rendered rows
- [ ] Instrumented if any hitch

---

## 14) LLM Output Structure

When generating SwiftUI UI, structure output as:

1. **UX Intent** — goal, primary action, states
2. **Hierarchy & Layout** — hero, grouping, navigation
3. **Design Tokens** — spacing/radius/type used
4. **Interaction Spec** — tap/drag/scroll behaviors
5. **Animation Plan** — where, why, fallbacks
6. **Accessibility Plan**
7. **Performance Notes**
8. **SwiftUI Code** — componentized, previewable

---

## Source References

### WWDC25 Sessions
- [Instruments for SwiftUI (306)](https://developer.apple.com/videos/play/wwdc2025/306/)
- [Get to know the new design system (356)](https://developer.apple.com/videos/play/wwdc2025/356/)
- [Build a SwiftUI app with the new design (323)](https://developer.apple.com/videos/play/wwdc2025/323/)
- [Meet Liquid Glass (219)](https://developer.apple.com/videos/play/wwdc2025/219/)
- [What's new in SwiftUI (256)](https://developer.apple.com/videos/play/wwdc2025/256/)
- [What's new in SF Symbols 7 (337)](https://developer.apple.com/videos/play/wwdc2025/337/)
- [Evaluate your app for Accessibility Nutrition Labels (224)](https://developer.apple.com/videos/play/wwdc2025/224/)
- [Customize your app for Assistive Access (238)](https://developer.apple.com/videos/play/wwdc2025/238/)

### WWDC23-24 Sessions
- [WWDC24: Create custom visual effects](https://developer.apple.com/videos/play/wwdc2024/10151/)
- [WWDC24: Catch up on accessibility in SwiftUI](https://developer.apple.com/videos/play/wwdc2024/10073/)
- [WWDC23: Discover Observation](https://developer.apple.com/videos/play/wwdc2023/10149/)
- [WWDC21: Demystify SwiftUI](https://developer.apple.com/videos/play/wwdc2021/10022/)

### Apple Documentation
- [Applying Liquid Glass to custom views](https://developer.apple.com/documentation/SwiftUI/Applying-Liquid-Glass-to-custom-views)
- [ConcentricRectangle](https://developer.apple.com/documentation/swiftui/concentricrectangle)
- [ToolbarSpacer](https://developer.apple.com/documentation/swiftui/toolbarspacer)
- [Accessibility Modifiers Reference](https://developer.apple.com/documentation/swiftui/view-accessibility)
- [Accessibility Nutrition Labels](https://developer.apple.com/help/app-store-connect/manage-app-accessibility/overview-of-accessibility-nutrition-labels/)
- [Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines/)
- [Apple Design Awards 2025](https://www.apple.com/newsroom/2025/06/apple-unveils-winners-and-finalists-of-the-2025-apple-design-awards/)
