import { Hono } from "hono";
import {
  authMiddleware,
  optionalAuthMiddleware,
} from "../supabase/auth-middleware";

interface ErrorResponse {
  readonly success: false;
  readonly error: string;
}

const userRoutes = new Hono();

userRoutes.get("/me", authMiddleware, async (c) => {
  try {
    const user = c.get("user");

    return c.json(
      {
        success: true as const,
        user: {
          id: user.id,
          email: user.email,
          ...(user.firstName && { firstName: user.firstName }),
          ...(user.lastName && { lastName: user.lastName }),
        },
      },
      200
    );
  } catch (error) {
    console.error("Erreur récupération profil:", error);
    return c.json(
      {
        success: false as const,
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
      return c.json(
        {
          success: false as const,
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
      return c.json(
        {
          success: false as const,
          error: "Erreur lors de la mise à jour du profil",
        },
        500
      );
    }

    return c.json(
      {
        success: true as const,
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
      },
      200
    );
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

userRoutes.put("/onboarding-completed", authMiddleware, async (c) => {
  try {
    const supabase = c.get("supabase");

    // Récupérer les données utilisateur actuelles pour obtenir les métadonnées
    const { data: currentUserData, error: getUserError } =
      await supabase.auth.getUser();

    if (getUserError || !currentUserData.user) {
      return c.json(
        {
          success: false as const,
          error: "Erreur lors de la récupération des données utilisateur",
        },
        500
      );
    }

    // Mise à jour des user_metadata pour marquer l'onboarding comme terminé
    const { data: updatedUser, error } = await supabase.auth.updateUser({
      data: {
        ...currentUserData.user.user_metadata,
        onboardingCompleted: true,
      },
    });

    if (error || !updatedUser.user) {
      return c.json(
        {
          success: false as const,
          error: "Erreur lors de la mise à jour du statut d'onboarding",
        },
        500
      );
    }

    return c.json(
      {
        success: true as const,
        message: "Onboarding marqué comme terminé",
      },
      200
    );
  } catch (error) {
    console.error("Erreur mise à jour onboarding:", error);
    return c.json<ErrorResponse>(
      {
        success: false,
        error: "Erreur lors de la mise à jour du statut d'onboarding",
      },
      500
    );
  }
});

userRoutes.get("/onboarding-status", authMiddleware, async (c) => {
  try {
    const supabase = c.get("supabase");

    // Récupérer les données utilisateur actuelles pour obtenir les métadonnées
    const { data: currentUserData, error: getUserError } =
      await supabase.auth.getUser();

    if (getUserError || !currentUserData.user) {
      return c.json(
        {
          success: false as const,
          error: "Erreur lors de la récupération des données utilisateur",
        },
        500
      );
    }

    const isOnboardingCompleted =
      currentUserData.user.user_metadata?.onboardingCompleted === true;

    return c.json(
      {
        success: true as const,
        onboardingCompleted: isOnboardingCompleted,
      },
      200
    );
  } catch (error) {
    console.error("Erreur récupération statut onboarding:", error);
    return c.json(
      {
        success: false as const,
        error: "Erreur lors de la récupération du statut d'onboarding",
      },
      500
    );
  }
});

export { userRoutes };
