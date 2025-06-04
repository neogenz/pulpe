import { createMiddleware } from "hono/factory";
import { getCookie } from "hono/cookie";
import {
  createSupabaseClient,
  type AuthenticatedSupabaseClient,
} from "./client";

interface AuthenticatedUser {
  readonly id: string;
  readonly email: string;
  readonly firstName?: string;
  readonly lastName?: string;
}

interface ErrorResponse {
  readonly success: false;
  readonly error: string;
}

export const authMiddleware = createMiddleware<{
  Variables: {
    user: AuthenticatedUser;
    supabase: AuthenticatedSupabaseClient;
  };
}>(async (c, next) => {
  try {
    const accessToken =
      getCookie(c, "sb-access-token") ||
      c.req.header("Authorization")?.replace("Bearer ", "");

    if (!accessToken) {
      return c.json<ErrorResponse>(
        {
          success: false,
          error: "Token d'accès requis",
        },
        401
      );
    }

    const supabase = createSupabaseClient(accessToken);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return c.json<ErrorResponse>(
        {
          success: false,
          error: "Token d'accès invalide ou expiré",
        },
        401
      );
    }

    const authenticatedUser: AuthenticatedUser = {
      id: user.id,
      email: user.email!,
      firstName: user.user_metadata?.firstName,
      lastName: user.user_metadata?.lastName,
    };

    c.set("user", authenticatedUser);
    c.set("supabase", supabase);

    await next();
  } catch (error) {
    console.error("Erreur middleware auth:", error);
    return c.json<ErrorResponse>(
      {
        success: false,
        error: "Erreur d'authentification",
      },
      500
    );
  }
});

export const optionalAuthMiddleware = createMiddleware<{
  Variables: {
    user?: AuthenticatedUser;
    supabase?: AuthenticatedSupabaseClient;
  };
}>(async (c, next) => {
  try {
    const accessToken =
      getCookie(c, "sb-access-token") ||
      c.req.header("Authorization")?.replace("Bearer ", "");

    if (accessToken) {
      const supabase = createSupabaseClient(accessToken);
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (!userError && user) {
        const authenticatedUser: AuthenticatedUser = {
          id: user.id,
          email: user.email!,
          firstName: user.user_metadata?.firstName,
          lastName: user.user_metadata?.lastName,
        };

        c.set("user", authenticatedUser);
        c.set("supabase", supabase);
      }
    }

    await next();
  } catch (error) {
    console.error("Erreur middleware auth optionnel:", error);
    await next();
  }
});
