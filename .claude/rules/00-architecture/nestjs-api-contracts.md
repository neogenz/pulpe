---
description: Mandatory Zod-based API contracts for all NestJS endpoints
paths: "backend-nest/src/modules/**/*.controller.ts"
---

# API Contracts — Zod DTOs (Mandatory)

## Rule

**Every** controller endpoint **MUST** use Zod-based DTOs for request bodies and response types. Inline `body: { ... }` type annotations are **forbidden**.

## How It Works

```
shared/schemas.ts → createZodDto (nestjs-zod) → Controller @Body() dto
```

1. **Define schemas** in `shared/schemas.ts` (single source of truth)
2. **Export** from `shared/index.ts` (schema + inferred type)
3. **Create DTO class** in `backend-nest/src/modules/[domain]/dto/[domain]-swagger.dto.ts`
4. **Use DTO** in controller with `@Body() dto: MyRequestDto`
5. **Add response type** to `@ApiResponse({ type: MyResponseDto })`

## Schema Naming Convention

```typescript
// Request: [domain][Action]RequestSchema
export const encryptionChangePinRequestSchema = z.object({ ... });
export type EncryptionChangePinRequest = z.infer<typeof encryptionChangePinRequestSchema>;

// Response: [domain][Action]ResponseSchema
export const encryptionChangePinResponseSchema = z.object({ ... });
export type EncryptionChangePinResponse = z.infer<typeof encryptionChangePinResponseSchema>;
```

## DTO Naming Convention

```typescript
// Request DTO: [Domain][Action]RequestDto
export class EncryptionChangePinRequestDto extends createZodDto(encryptionChangePinRequestSchema) {}

// Response DTO: [Domain][Action]ResponseDto
export class EncryptionChangePinResponseDto extends createZodDto(encryptionChangePinResponseSchema) {}
```

## Controller Usage

```typescript
// CORRECT — Zod DTO with Swagger type
@ApiResponse({ status: 200, type: ChangePinResponseDto })
async changePin(@Body() body: ChangePinRequestDto): Promise<ChangePinResponse> { ... }

// WRONG — inline type, no validation, no Swagger schema
async changePin(@Body() body: { oldKey: string; newKey: string }): Promise<{ success: boolean }> { ... }
```

## Checklist for New Endpoints

- [ ] Schema defined in `shared/schemas.ts`
- [ ] Schema + type exported from `shared/index.ts`
- [ ] `shared` rebuilt (`pnpm build:shared`)
- [ ] DTO class in `modules/[domain]/dto/[domain]-swagger.dto.ts`
- [ ] Controller uses DTO class for `@Body()`
- [ ] `@ApiResponse` includes `type: ResponseDto`

## Why

- `ZodValidationPipe` (global) auto-validates request bodies
- Swagger docs auto-generated from Zod schemas
- Frontend and backend share the same contract via `pulpe-shared`
- Type safety end-to-end: schema → DTO → controller → service
