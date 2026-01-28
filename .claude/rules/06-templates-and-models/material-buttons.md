---
description: Material 21 button directive patterns for Angular templates
paths:
  - "frontend/**/*.html"
  - "frontend/**/*.ts"
---

# Material 21 Buttons

Use the new Material 21 button directives:

```html
matButton            <!-- text button -->
matButton="filled"   <!-- primary action -->
matButton="outlined" <!-- secondary action -->
matIconButton        <!-- icon only -->
```

## Examples

```html
<!-- Primary action -->
<button matButton="filled" (click)="save()">Save</button>

<!-- Secondary action -->
<button matButton="outlined" (click)="cancel()">Cancel</button>

<!-- Text button -->
<button matButton (click)="learnMore()">Learn more</button>

<!-- Icon button -->
<button matIconButton aria-label="Close">
  <mat-icon>close</mat-icon>
</button>
```
