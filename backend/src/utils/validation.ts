import type { Context } from "hono";
import { z } from "zod";

export interface ValidationErrorResponse {
  readonly success: false;
  readonly error: string;
  readonly details?: string[];
}

export function createValidationError(
  zodError: z.ZodError
): ValidationErrorResponse {
  const details = zodError.errors.map((error) => {
    const path = error.path.join(".");
    return `${path}: ${error.message}`;
  });

  return {
    success: false,
    error: "Données invalides",
    details,
  };
}

export async function validateRequestBody<T>(
  c: Context,
  schema: z.ZodSchema<T>
): Promise<
  { success: true; data: T } | { success: false; response: Response }
> {
  try {
    const body = await c.req.json();
    const validatedData = schema.parse(body);

    return {
      success: true,
      data: validatedData,
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorResponse = createValidationError(error);
      return {
        success: false,
        response: c.json(errorResponse, 400),
      };
    }

    // Erreur inattendue
    return {
      success: false,
      response: c.json(
        {
          success: false,
          error: "Erreur de validation inattendue",
        },
        500
      ),
    };
  }
}
