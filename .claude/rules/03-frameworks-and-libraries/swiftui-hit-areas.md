---
description: SwiftUI hit area standards — contentShape, minimum tap targets, shared ButtonStyles
paths: "ios/**/*.swift"
---

# SwiftUI Hit Area Standards

## Minimum Tap Target

Every interactive element must have a **minimum 44×44pt** tap area (Apple HIG).

## Shared ButtonStyles

All shared styles live in `ios/Pulpe/Shared/Design/PrimaryButtonStyle.swift`.

| Style | Use Case | Tap Target |
|-------|----------|------------|
| `PrimaryButtonStyle` | Full-width CTA | Full width × 54pt |
| `SecondaryButtonStyle` | Cancel/back CTA | Full width × 54pt |
| `DestructiveButtonStyle` | Danger CTA | Full width × 54pt |
| `IconButtonStyle` | Icon-only (eye toggle, dismiss X, delete, chart) | 44×44pt min |
| `TextLinkButtonStyle` | Text links (forgot password, create account, back) | 44pt min height |

### Usage

```swift
// Icon-only buttons
Button { toggle() } label: {
    Image(systemName: "eye.fill")
}
.iconButtonStyle()

// Text links
Button("Mot de passe oublié ?") { showReset() }
.textLinkButtonStyle()
```

## `.contentShape()` Rule

**Every button using `.buttonStyle(.plain)` MUST have a `.contentShape()`** on the label or the button itself. Without it, only the visible pixels are tappable.

```swift
// Good — contentShape ensures full area is tappable
Button { action() } label: {
    Text("Tap me")
        .frame(maxWidth: .infinity)
        .contentShape(Rectangle())
}
.buttonStyle(.plain)

// Bad — only the text pixels are tappable
Button { action() } label: {
    Text("Tap me")
        .frame(maxWidth: .infinity)
}
.buttonStyle(.plain)
```

## TextField / SecureField in Custom Containers

SwiftUI TextFields only respond to taps on the text line, not the full container.
`.contentShape(.interaction, Rectangle())` expands the hit area but does NOT auto-focus — pair it with `.onTapGesture` + `@FocusState`.

| Pattern | Fix |
|---------|-----|
| TextField in fixed-height HStack | `.contentShape(.interaction, Rectangle())` on container + `.onTapGesture { focus = true }` |
| TextField with padding + background | Same: `.contentShape(.interaction, Rectangle())` + `.onTapGesture` after `.clipShape()` |
| Use `FormTextField` component | Already includes focus-forwarding tap target |

## Anti-Patterns

| Don't | Do |
|-------|-----|
| `Button` with `.buttonStyle(.plain)` and no `contentShape` | Add `.contentShape()` or use a shared ButtonStyle |
| Icon-only button without minimum frame | Use `.iconButtonStyle()` |
| Text link without minimum height | Use `.textLinkButtonStyle()` |
| `frame(width: 32, height: 32)` for icon buttons | `frame(width: 44, height: 44)` minimum |
| Custom padding for tap area | Use shared ButtonStyle that guarantees 44pt |
