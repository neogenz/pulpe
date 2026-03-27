---
description: "Never use raw design values (colors, spacing, opacity, radii, typography) — always use DesignTokens or shared modifiers"
paths: "ios/**/*.swift"
---

# No Magic Design Values in iOS

## Rule

**NEVER write raw numeric values for visual properties.** Always use the corresponding `DesignTokens` enum or shared modifier.

Before writing any visual value, check `DesignTokens.swift` for an existing token.

## Checklist

| Property | Wrong | Right |
|----------|-------|-------|
| Spacing/padding | `.padding(16)` | `.padding(DesignTokens.Spacing.lg)` |
| Corner radius | `.cornerRadius(12)` | `DesignTokens.CornerRadius.lg` |
| Opacity | `.opacity(0.5)` | `DesignTokens.Opacity.heavy` |
| Font | `.font(.system(size: 17))` | `.font(PulpeTypography.body)` |
| Color | `Color(hex: 0xF0EDE9)` | `Color.surfaceContainerHigh` |
| Background | `.background(Color.surfaceContainerLowest)` | `.pulpeCardBackground()` |
| Border width | `lineWidth: 2` | `DesignTokens.BorderWidth.medium` |
| Animation | `.easeInOut(duration: 0.3)` | `DesignTokens.Animation.defaultSpring` |

## Where to look

| Need | Source file |
|------|-----------|
| Spacing, radii, borders, opacity, animation | `Shared/Design/DesignTokens.swift` |
| Colors | `Shared/Extensions/Color+Pulpe.swift` |
| Typography | `Shared/Design/PulpeTypography.swift` |
| Card/sheet backgrounds | `Shared/Extensions/View+Extensions.swift` (`pulpeCardBackground()`, `standardSheetPresentation()`) |
| Button styles | `Shared/Design/PrimaryButtonStyle.swift` |

## If no token exists

If no existing token matches your need, **do not invent a magic number**. Instead, add a named token to the appropriate `DesignTokens` enum first, then use it.
