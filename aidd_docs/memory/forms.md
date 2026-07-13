# Forms

## Approach
- Angular is hybrid: newer business forms use Signal Forms; older/auth forms use Reactive Forms. Zod validates at the form→store/API boundary.
- Form/wire divergence uses a colocated `*.schema.ts` transform; shared DTO schemas stay in `pulpe-shared`.
- iOS uses SwiftUI bindings plus feature-local observable view models and shared field/validation primitives; landing has no submission form.

## Conventions
- Show errors after touch/submit, block duplicate submission, and parse before mutation.
- Follow `.claude/rules/03-frameworks-and-libraries/frontend-form-schemas.md`; never create wrapper form types for 1:1 wire shapes.
