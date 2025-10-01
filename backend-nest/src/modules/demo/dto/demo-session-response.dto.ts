import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

/**
 * Response schema for demo session creation
 * Returns a real Supabase session that can be used immediately
 */
export const DemoSessionResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    session: z.object({
      access_token: z.string(),
      token_type: z.string(),
      expires_in: z.number(),
      expires_at: z.number(),
      refresh_token: z.string(),
      user: z.object({
        id: z.string(),
        email: z.string(),
        created_at: z.string(),
      }),
    }),
  }),
  message: z.string(),
});

export class DemoSessionResponseDto extends createZodDto(
  DemoSessionResponseSchema,
) {}

export type DemoSessionResponse = z.infer<typeof DemoSessionResponseSchema>;
