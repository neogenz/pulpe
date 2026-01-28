---
description: TypeScript import organization rules for Angular components
paths: "frontend/**/*.ts"
---

# Import Organization

```typescript
// 1. Angular core
import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

// 2. Angular ecosystem
import { MatButtonModule } from '@angular/material/button';
import { RouterLink } from '@angular/router';

// 3. Third-party
import { z } from 'zod';

// 4. Project aliases (@app, @core, @ui)
import { BudgetApiService } from '@core/budget';
import { ButtonComponent } from '@ui/button';

// 5. Relative imports (same feature only)
import { BudgetFormComponent } from './budget-form.component';
```

## Rules

- Use path aliases (`@core/`, `@ui/`) over deep relative paths
- Group imports with blank line between sections
- No barrel exports within features (avoid circular deps)
