# Navigation Icons - Filled Effect Demo

## How it works

The navigation icons now use Material Symbols Outlined with the `FILL` variable font axis. This allows smooth transitions between outlined and filled states.

### CSS Classes Applied:

1. **Default state (outlined)**:
   - Icon uses `FILL: 0` (outlined version)
   - Text color: `--mat-sys-on-surface-variant`
   - Scale: 1 (normal size)

2. **Hover state**:
   - Class `group-hover:icon-filled` applies `FILL: 1`
   - Class `group-hover:scale-110` scales icon to 110%
   - Icon smoothly transitions to filled version with slight enlargement
   - Background changes to `--mat-sys-surface-container-highest`

3. **Active/Selected state**:
   - Class `icon-filled` applies `FILL: 1`
   - Icon is permanently filled (no scale effect)
   - Returns to normal size (scale: 1)
   - Background: `--mat-sys-secondary-container`
   - Text color: `--mat-sys-on-secondary-container`

### Technical Implementation:

```css
/* From _tailwind.css */
.icon-filled {
  font-variation-settings: "FILL" 1;
}

/* From main-layout.ts */
mat-icon {
  transition: font-variation-settings 200ms ease-in-out,
              transform 200ms ease-in-out;
}
```

### Navigation Items:
- **today** → "Mois en cours" (Current Month)
- **calendar_month** → "Mes budgets" (My Budgets)
- **description** → "Modèles" (Templates)

All these Material Symbols icons support both outlined (FILL: 0) and filled (FILL: 1) variants, providing a smooth visual feedback for user interactions.

## Visual States:

1. **Default**: Outlined icon, muted colors, normal size
2. **Hover**: Icon fills up and scales to 110%, background highlights
3. **Active**: Filled icon at normal size with accent colors

### Animation Details:

- **Fill transition**: Smooth morphing from outlined to filled using `FILL` variable font axis
- **Scale animation**: Icon grows by 10% on hover only, returns to normal when active
- **Duration**: 200ms with ease-in-out timing for natural movement
- **Performance**: Uses `will-change: transform` for optimized GPU acceleration

This creates a clear visual hierarchy and improves user experience by providing immediate feedback on interactive elements. The combination of fill and scale animations makes the navigation feel more responsive and modern.