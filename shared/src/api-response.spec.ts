import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createListResponse, createSuccessResponse } from './api-response.js';

const itemSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
});

const manualSuccessSchema = z.object({
  success: z.literal(true),
  data: itemSchema,
});

const manualListSchema = z.object({
  success: z.literal(true),
  data: z.array(itemSchema),
});

const factorySuccessSchema = createSuccessResponse(itemSchema);
const factoryListSchema = createListResponse(itemSchema);

type ManualSuccess = z.infer<typeof manualSuccessSchema>;
type FactorySuccess = z.infer<typeof factorySuccessSchema>;
type ManualList = z.infer<typeof manualListSchema>;
type FactoryList = z.infer<typeof factoryListSchema>;

// Compile-time contract: inferred types must stay identical before/after factory migration.
const _successTypeIsEquivalent: ManualSuccess = {} as FactorySuccess;
const _successTypeIsEquivalentReverse: FactorySuccess = {} as ManualSuccess;
const _listTypeIsEquivalent: ManualList = {} as FactoryList;
const _listTypeIsEquivalentReverse: FactoryList = {} as ManualList;

void _successTypeIsEquivalent;
void _successTypeIsEquivalentReverse;
void _listTypeIsEquivalent;
void _listTypeIsEquivalentReverse;

describe('api-response factories', () => {
  it('createSuccessResponse should match legacy schema behavior', () => {
    const payload = {
      success: true as const,
      data: {
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Loyer',
      },
    };

    expect(factorySuccessSchema.parse(payload)).toEqual(
      manualSuccessSchema.parse(payload),
    );
  });

  it('createListResponse should match legacy schema behavior', () => {
    const payload = {
      success: true as const,
      data: [
        {
          id: '550e8400-e29b-41d4-a716-446655440000',
          name: 'Loyer',
        },
        {
          id: '550e8400-e29b-41d4-a716-446655440001',
          name: 'Salaire',
        },
      ],
    };

    expect(factoryListSchema.parse(payload)).toEqual(
      manualListSchema.parse(payload),
    );
  });

  it('factories should reject invalid payloads the same way as manual schemas', () => {
    const invalidPayload = {
      success: true as const,
      data: {
        id: 'not-a-uuid',
        name: '',
      },
    };

    const factoryResult = factorySuccessSchema.safeParse(invalidPayload);
    const manualResult = manualSuccessSchema.safeParse(invalidPayload);

    expect(factoryResult.success).toBe(false);
    expect(manualResult.success).toBe(false);

    if (!factoryResult.success && !manualResult.success) {
      expect(factoryResult.error.issues).toEqual(manualResult.error.issues);
    }
  });
});
