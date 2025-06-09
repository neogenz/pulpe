import { Hono } from "hono";
import { authMiddleware } from "../supabase/auth-middleware";

interface AuthResponse {
  readonly success: true;
  readonly user: {
    readonly id: string;
    readonly email: string;
  };
}

interface AuthError {
  readonly success: false;
  readonly error: string;
}

const authRoutes = new Hono();

// Route pour valider le token et récupérer les infos utilisateur
authRoutes.get("/validate", authMiddleware, async (c) => {
  try {
    const user = c.get("user");

    return c.json(
      {
        success: true as const,
        user: {
          id: user.id,
          email: user.email,
        },
      },
      200
    );
  } catch (error) {
    console.error("Erreur validation token:", error);
    return c.json(
      {
        success: false as const,
        error: "Token invalide",
      },
      401
    );
  }
});

export { authRoutes };