---
description: Zod runtime imports, default error locale, and bundle verification
paths:
  - "shared/**/*.ts"
  - "frontend/**/*.ts"
---

# Zod 4 Runtime Imports

- Use namespace imports in runtime code.
- Keep default Zod errors English.
- Never configure Zod locales.
- Remeasure bundles after Zod/esbuild upgrades.

```typescript
import * as z from "zod";
```
