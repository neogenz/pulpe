---
name: swiftui
description: Use when building SwiftUI interfaces for iOS, iPadOS, macOS, or visionOS. Triggers on Liquid Glass adoption, SwiftUI animation/transitions, layout patterns, state management, design tokens, performance optimization, accessibility in SwiftUI, or creating "Apple-level" UI quality.
---

# SwiftUI Excellence Playbook

Tactical guide for designing and building world-class SwiftUI interfaces—the kind that feel at home next to Apple's own apps.

## Six Non-Negotiables

1. **Content first** — UI is a frame, not the painting
2. **System components unless measured reason not to** — buy accessibility, platform behavior, design updates for free
3. **Design for states, not screens** — every screen handles: loading, empty, error, offline, partial, permission denied
4. **Accessibility is a constraint** — Dynamic Type, VoiceOver, Reduce Motion/Transparency, Increased Contrast
5. **Performance is a feature** — "feels instant" interactions, instrument when hitches occur
6. **Coherence over cleverness** — best interfaces feel inevitable

## Quick Reference: ADA Rubric

| Category | Requirement |
|----------|-------------|
| **Delight** | Micro-delight at success moments only, never reduces clarity |
| **Innovation** | In discovery, state communication, simplifying complexity |
| **Interaction** | Predictable, direct, forgiving, platform-appropriate |
| **Inclusivity** | Dynamic Type XXL+, VoiceOver, no color-only meaning, reduced motion |
| **Visuals** | Consistent rhythm, coherent materials, restrained tint |

## Design Workflow (Step-by-Step)

1. **Define experience** — 10-line spec: goal, primary action, states, edge cases, platforms
2. **Sketch IA** — TabView vs NavigationSplitView vs deep navigation
3. **Design hierarchy** — one hero, one primary CTA per moment, progressive disclosure
4. **Build tokens first** — spacing, radius, typography, motion, colors
5. **Build components** — cards, rows, buttons, empty states, filters
6. **Integrate structure** — NavigationStack, NavigationSplitView, TabView, Sheets
7. **Add motion** — only what improves comprehension and causality
8. **Accessibility + performance pass** — Dynamic Type, VoiceOver, Instruments

## Liquid Glass Quick Rules (iOS 26+)

**Do:**
- Use glass for navigation/control layer floating above content
- Group nearby glass in `GlassEffectContainer`
- Use `glassEffect(.interactive)` for custom controls
- Use `glassEffectID` for morphing transitions

**Don't:**
- Glass on content layer (tables, documents)
- Glass on glass stacking
- Tint everything — only primary actions/meaning
- Custom backgrounds behind toolbars (let system handle scroll edge effects)

**Sheets:** Require `.presentationDetents([.medium])` for Liquid Glass appearance.
**Buttons:** Use `.buttonStyle(.glass)` or `.buttonStyle(.glassProminent)` for glass controls.

## Layout Essentials

| Container | Use For |
|-----------|---------|
| `List` | Large datasets, selection, swipe actions, edit mode |
| `ScrollView` + `LazyVStack` | Custom surfaces, cards, mixed content |
| `Grid` | Forms, settings, dense structured layouts |
| `LazyVGrid` | Responsive galleries |
| `NavigationSplitView` | iPad/Mac hierarchical apps |
| `NavigationStack` | Deep navigation flows |

## Animation Principles

- Motion communicates **causality**, **hierarchy**, **continuity**
- State-driven animation, not imperative choreography
- Springs for organic UI, ease-in/out for fades
- Custom transitions for signature moments only
- Always provide Reduce Motion fallback

## Performance Rules

| Rule | Implementation |
|------|----------------|
| Body must be cheap | No sorting, filtering, formatting, I/O in body |
| Stable identity | `ForEach(items, id: \.id)` not `\.self`, no UUID() in body |
| Dependency hygiene | Keep @State local, pass Binding not whole model |
| Equatable on rows | Conform scrollable list rows to `Equatable` for faster diffing |
| AsyncImage caching | AsyncImage does NOT cache — use NSCache/Nuke for production |
| Instrument | Use SwiftUI instrument (Instruments 26) + Cause & Effect Graph |

## Accessibility Checklist

- [ ] System text styles, no clipping at XXL+
- [ ] Layout adapts (stacks turn vertical, rows multi-line)
- [ ] VoiceOver labels/hints on non-obvious controls
- [ ] Focus order matches reading order
- [ ] 44×44pt minimum touch targets
- [ ] Reduced Motion removes parallax, uses opacity
- [ ] Reduced Transparency increases separation (solid bg instead of glass)
- [ ] Color contrast meets WCAG AA (4.5:1 text, 3:1 UI)
- [ ] accessibilityElement grouping on composite views
- [ ] Header traits on section titles
- [ ] @AccessibilityFocusState for modal dismiss flows
- [ ] AccessibilityNotification for dynamic updates
- [ ] Haptic feedback on key interactions (.sensoryFeedback)

## Component Primitives (Build These)

1. Screen scaffold
2. Section header
3. Card surface
4. List row
5. Primary/secondary/icon buttons
6. Empty state
7. Loading skeleton
8. Error banner
9. Form field row
10. Chip/tag/pill

## Full Reference

For complete implementation patterns, code recipes, design tokens, Liquid Glass details, and the full ADA review checklist:

See: [swiftui-playbook.md](swiftui-playbook.md)
