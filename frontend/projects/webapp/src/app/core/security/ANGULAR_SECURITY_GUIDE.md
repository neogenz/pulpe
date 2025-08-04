# Angular Security Guide - XSS Prevention

## Angular's Built-in XSS Protection

Angular automatically protects against XSS attacks by:

### 1. **Automatic Sanitization in Templates**

```typescript
// ✅ SAFE - Angular escapes HTML entities automatically
template: `<p>{{ userInput }}</p>`

// ✅ SAFE - Angular sanitizes HTML content
template: `<div [innerHTML]="userContent"></div>`

// ✅ SAFE - Angular sanitizes style values
template: `<div [style]="userStyle"></div>`

// ✅ SAFE - Angular sanitizes URLs
template: `<a [href]="userUrl">Link</a>`
```

### 2. **When to Use DomSanitizer**

Only use DomSanitizer when you need to:
- Trust HTML content from a trusted source (e.g., CMS)
- Embed iframes or object/embed tags
- Use dynamic styles with `url()` values

```typescript
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

// Only for trusted content!
trustedHtml = computed<SafeHtml>(() => {
  const content = this.cmsContent();
  return this.sanitizer.bypassSecurityTrustHtml(content);
});
```

### 3. **Form Input Security**

Angular reactive forms are already secure:

```typescript
// ✅ CORRECT - Let Angular handle security
templateForm = this.fb.group({
  name: ['', [Validators.required, Validators.maxLength(100)]],
  description: ['', [Validators.maxLength(500)]],
});

onSubmit() {
  if (this.templateForm.valid) {
    // Send raw values - Angular already prevents XSS when displaying
    const data = this.templateForm.value;
    this.apiService.create(data);
  }
}
```

### 4. **What NOT to Do**

```typescript
// ❌ WRONG - Manual DOM manipulation
const temp = document.createElement('div');
temp.textContent = input;
return temp.innerHTML;

// ❌ WRONG - Regex-based validation for XSS
const dangerousPatterns = [/<script/i, /javascript:/i];
return dangerousPatterns.test(value);

// ❌ WRONG - Using [innerHTML] for user input without reason
template: `<div [innerHTML]="userComment"></div>`
// Use text interpolation instead:
// ✅ CORRECT
template: `<div>{{ userComment }}</div>`
```

## Best Practices for Pulpe Application

### 1. **Trust Angular's Default Behavior**
- Use text interpolation `{{ }}` for displaying user content
- Don't add custom sanitization in forms
- Let the backend handle business validation

### 2. **Backend Validation**
The backend should:
- Validate business rules (max length, required fields)
- Store user input as-is (no HTML encoding)
- Only sanitize when generating HTML emails or PDFs

### 3. **Display User Content Safely**
```typescript
// In template-card.ts
template: `
  <!-- ✅ Safe - Angular escapes automatically -->
  <mat-card-title>{{ template().name }}</mat-card-title>
  <p>{{ template().description }}</p>
`
```

### 4. **Content Security Policy (CSP)**
Add CSP headers in your backend:
```typescript
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"], // Angular needs inline styles
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));
```

## Summary

1. **Remove** all custom XSS validators from forms
2. **Remove** manual sanitization functions
3. **Trust** Angular's automatic protection
4. **Use** simple text interpolation for user content
5. **Keep** backend sanitization for data integrity
6. **Add** CSP headers for defense in depth

Angular's security model is battle-tested and sufficient for 99% of use cases. Don't reinvent the wheel!