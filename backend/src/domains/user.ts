import { Hono } from "hono";
import {
  authMiddleware,
  optionalAuthMiddleware,
} from "../supabase/auth-middleware";

interface UserResponse {
  readonly success: boolean;
  readonly user: {
    readonly id: string;
    readonly email: string;
    readonly firstName?: string;
    readonly lastName?: string;
  };
}

interface ErrorResponse {
  readonly success: false;
  readonly error: string;
}

const userRoutes = new Hono();

userRoutes.get("/me", authMiddleware, async (c) => {
  try {
    const user = c.get("user");

    return c.json<UserResponse>({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        ...(user.firstName && { firstName: user.firstName }),
        ...(user.lastName && { lastName: user.lastName }),
      },
    });
  } catch (error) {
    console.error("Erreur récupération profil:", error);
    return c.json<ErrorResponse>(
      {
        success: false,
        error: "Erreur lors de la récupération du profil",
      },
      500
    );
  }
});

userRoutes.put("/profile", authMiddleware, async (c) => {
  try {
    const user = c.get("user");
    const supabase = c.get("supabase");

    const { firstName, lastName } = await c.req.json();

    if (!firstName?.trim() || !lastName?.trim()) {
      return c.json<ErrorResponse>(
        {
          success: false,
          error: "Le prénom et nom sont requis",
        },
        400
      );
    }

    // Mise à jour des user_metadata via Supabase Auth
    const { data: updatedUser, error } = await supabase.auth.updateUser({
      data: {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
      },
    });

    if (error || !updatedUser.user) {
      return c.json<ErrorResponse>(
        {
          success: false,
          error: "Erreur lors de la mise à jour du profil",
        },
        500
      );
    }

    return c.json<UserResponse>({
      success: true,
      user: {
        id: updatedUser.user.id,
        email: updatedUser.user.email!,
        ...(updatedUser.user.user_metadata?.firstName && {
          firstName: updatedUser.user.user_metadata.firstName,
        }),
        ...(updatedUser.user.user_metadata?.lastName && {
          lastName: updatedUser.user.user_metadata.lastName,
        }),
      },
    });
  } catch (error) {
    console.error("Erreur mise à jour profil:", error);
    return c.json<ErrorResponse>(
      {
        success: false,
        error: "Erreur lors de la mise à jour du profil",
      },
      500
    );
  }
});

userRoutes.get("/public-info", optionalAuthMiddleware, async (c) => {
  const user = c.get("user");

  if (user) {
    return c.json({
      success: true,
      message: `Bonjour ${user.firstName || "utilisateur"} !`,
      authenticated: true,
    });
  }

  return c.json({
    success: true,
    message: "Bonjour visiteur !",
    authenticated: false,
  });
});

export { userRoutes };
