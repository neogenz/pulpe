---
name: reconcile-sheet-surfaces
description: Reconcile sheets (ReconcileSheet) render on two surfaces; a bg-surface-container-low card vanishes in the phone bottom sheet, and the 560px dialog footer fits two buttons, not three
metadata:
  type: reference
---

`ReconcileSheet` opens the same body as a MatBottomSheet (phone) or MatDialog (desktop). The bottom sheet's own background matches `bg-surface-container-low`, so a card with that background is invisible on 390px while it reads fine on desktop (dialog is surface-container-high). Give such cards `border border-outline-variant`.

The step-2 footer of the reconcile dialog (560px, 28px padding) fits a text button and a 190px primary side by side; a third button wraps every label onto two lines. Stack the extra button inside `.note-action` under the primary instead.

**How to apply:** check both frames in screenshots before calling a reconcile sheet or footer done.
