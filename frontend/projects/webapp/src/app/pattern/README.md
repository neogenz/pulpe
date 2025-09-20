# Pattern Architecture

The `pattern/` directory contains reusable, state-aware, cross-cutting pieces of functionality that are more complex than UI components but smaller than full features.

## Purpose & Content

**Purpose**: Implement cross-cutting business features that combine UI and state logic, consumed via "drop-in" components instead of routes.

**Content**:

- Pre-packaged combination of standalones and injectables
- Self-contained functionality that can inject services from `core/`
- Reusable across multiple features
- More complex than `ui/` but smaller than `feature/`

**Loading**: Not loaded via routing - "dropped in" to a feature's template.

## What Belongs in Pattern

### ✅ Include

- Document managers
- Approval workflows
- Audit logs / Change history
- Comments / Notes systems
- Complex search with state
- File upload with progress tracking
- Data export utilities
- Notification centers
- Shopping carts
- Chat widgets

### ❌ Exclude

- Pure presentational components (use `ui/`)
- Feature-specific logic (keep in `feature/`)
- Headless services only (use `core/`)
- Full routed pages (use `feature/`)
- Simple stateless components (use `ui/`)

## Core Characteristics

Patterns are:

- **State-aware**: Can inject and use services from `core/`
- **Self-contained**: Include both UI and business logic
- **Drop-in ready**: Consumed via component selector, not routing
- **Cross-cutting**: Implement functionality needed across features
- **Reusable**: Used by multiple features or sub-features
- **More than UI**: Combine multiple standalones with services

## Folder Structure

```
pattern/
├── document-manager/
│   ├── document-manager.component.ts    # Main drop-in component
│   ├── document.service.ts              # Pattern-specific service
│   ├── document.model.ts                # Pattern-specific models
│   └── components/
│       ├── document-list.component.ts
│       └── document-upload.component.ts
├── approval-widget/
│   ├── approval-widget.component.ts
│   ├── approval.service.ts
│   └── approval.state.ts
├── audit-log/
│   ├── audit-log.component.ts
│   ├── audit.service.ts
│   └── components/
│       └── log-entry.component.ts
└── comments/
    ├── comments.component.ts
    ├── comments.service.ts
    └── comment.model.ts
```

## Example Implementation

### Document Manager Pattern

```typescript
// pattern/document-manager/document.service.ts
@Injectable()
export class DocumentService {
  private readonly http = inject(HttpClient);
  private readonly documents = signal<Document[]>([]);

  readonly documents$ = this.documents.asReadonly();

  uploadDocument(file: File, context: string): Observable<Document> {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("context", context);

    return this.http.post<Document>("/api/documents", formData).pipe(tap((doc) => this.documents.update((docs) => [...docs, doc])));
  }

  deleteDocument(id: string): Observable<void> {
    return this.http.delete<void>(`/api/documents/${id}`).pipe(tap(() => this.documents.update((docs) => docs.filter((d) => d.id !== id))));
  }
}

// pattern/document-manager/document-manager.component.ts
@Component({
  selector: "app-pattern-document-manager",

  imports: [CommonModule, FileUploadModule, ButtonModule, UiCardComponent],
  providers: [DocumentService], // Pattern-scoped service
  template: `
    <app-ui-card>
      <h3>Documents</h3>

      <p-fileUpload (onUpload)="handleUpload($event)" [multiple]="true" [maxFileSize]="maxFileSize()"> </p-fileUpload>

      <div class="document-list">
        @for (doc of documentService.documents$(); track doc.id) {
          <div class="document-item">
            <span>{{ doc.name }}</span>
            <p-button icon="pi pi-trash" severity="danger" (onClick)="deleteDocument(doc)"> </p-button>
          </div>
        }
      </div>
    </app-ui-card>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DocumentManagerComponent {
  readonly context = input.required<string>(); // Context from parent feature
  readonly maxFileSize = input<number>(10000000);
  readonly documentsChanged = output<Document[]>();

  protected readonly documentService = inject(DocumentService);

  handleUpload(event: any): void {
    const file = event.files[0];
    this.documentService.uploadDocument(file, this.context()).subscribe(() => {
      this.documentsChanged.emit(this.documentService.documents$());
    });
  }

  deleteDocument(doc: Document): void {
    this.documentService.deleteDocument(doc.id).subscribe(() => {
      this.documentsChanged.emit(this.documentService.documents$());
    });
  }
}
```

## Pattern vs Other Architecture Types

### Pattern vs UI

- **UI**: Stateless, only inputs/outputs, no service injection
- **Pattern**: Stateful, can inject services from `core/`, combines UI + logic

### Pattern vs Core

- **Core**: Headless logic only, no UI components
- **Pattern**: Has UI components + business logic

### Pattern vs Feature

- **Feature**: Accessed via routing, represents a page/flow
- **Pattern**: Dropped into features via component selector

| Aspect                   | UI  | Pattern | Feature | Core |
| ------------------------ | --- | ------- | ------- | ---- |
| Has UI                   | ✅  | ✅      | ✅      | ❌   |
| Can inject services      | ❌  | ✅      | ✅      | ✅   |
| Accessed via routing     | ❌  | ❌      | ✅      | ❌   |
| Reusable across features | ✅  | ✅      | ❌      | ✅   |

## Usage in Features

```typescript
// feature/orders/orders.component.ts
import { DocumentManagerComponent } from "@app/pattern/document-manager/document-manager.component";
import { ApprovalWidgetComponent } from "@app/pattern/approval-widget/approval-widget.component";
import { AuditLogComponent } from "@app/pattern/audit-log/audit-log.component";

@Component({
  imports: [
    CommonModule,
    DocumentManagerComponent, // Pattern drop-in
    ApprovalWidgetComponent, // Pattern drop-in
    AuditLogComponent, // Pattern drop-in
  ],
  template: `
    <div class="order-details">
      <h2>Order #{{ orderId() }}</h2>

      <!-- Feature-specific content -->
      <div class="order-info">...</div>

      <!-- Drop-in pattern components -->
      <app-pattern-document-manager [context]="'order-' + orderId()" (documentsChanged)="handleDocumentsChange($event)" />

      <app-pattern-approval-widget [entityId]="orderId()" [entityType]="'order'" (approved)="handleApproval($event)" />

      <app-pattern-audit-log [entityId]="orderId()" [entityType]="'order'" />
    </div>
  `,
})
export class OrderDetailsComponent {
  readonly orderId = input.required<string>();

  handleDocumentsChange(documents: Document[]): void {
    // Feature-specific handling
  }

  handleApproval(result: ApprovalResult): void {
    // Feature-specific handling
  }
}
```

## When to Create a Pattern

Create a pattern when you answer YES to these questions:

1. **Is the behavior similar across features?**
2. **Is the UI similar across features?**
3. **Does it need state management or services?**
4. **Is it a cross-cutting concern?**

### Decision Matrix

| Behavior  | UI        | Solution                                    |
| --------- | --------- | ------------------------------------------- |
| Different | Different | Keep in separate features (isolation)       |
| Similar   | Different | Extract behavior to `core/`, UI in features |
| Different | Similar   | Extract UI to `ui/`, behavior in features   |
| Similar   | Similar   | Extract to `pattern/`                       |

### Common Pattern Examples

- **Document Manager**: Upload, display, delete documents
- **Approval Process**: Multi-step approval workflows
- **Audit Log**: Track and display entity changes
- **Comments/Notes**: Add and manage comments
- **Export Widget**: Export data in various formats
- **Advanced Search**: Search with filters and state
- **Notification Center**: Display and manage notifications

## Dependency Rules

Patterns can import from:

- ✅ `core/` - Services, guards, interceptors
- ✅ `ui/` - Generic presentational components
- ✅ Angular framework and third-party libraries

Patterns CANNOT import from:

- ❌ `feature/` - Maintain independence
- ❌ Other `pattern/` - Avoid coupling between patterns
- ❌ `layout/` - Patterns are consumed, not consumers

## Sharing Logic Between Patterns

When patterns need to share logic:

- **UI components**: Extract to `ui/`
- **Services/state**: Extract to `core/`
- **Wait for 3+ occurrences** before extracting (isolation > DRY)

## Using @defer with Patterns

Patterns can be lazy-loaded within features using `@defer`:

```typescript
@defer (on interaction) {
  <app-pattern-document-manager [context]="context" />
} @placeholder {
  <p-button label="Load Documents" />
}
```

Consider deferring patterns when:

- They have large bundle size (charts, editors)
- They're not immediately visible
- They're used after specific user interaction

## Testing Patterns

Pattern testing should cover:

- **Service logic**: Test pattern services in isolation
- **Component integration**: Test UI + service interaction
- **Input/Output contracts**: Verify all combinations
- **State management**: Test state changes and side effects
- **Error handling**: Test failure scenarios
