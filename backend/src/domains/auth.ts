// backend/routes/auth.ts
import { Hono } from "hono";
import { setCookie } from "hono/cookie";
import { supabaseAdmin } from "../supabase/client";

interface SignupRequest {
  readonly email: string;
  readonly password: string;
  readonly firstName: string;
  readonly lastName: string;
}

interface SigninRequest {
  readonly email: string;
  readonly password: string;
}

interface UserProfile {
  readonly id: string;
  readonly email: string;
  readonly firstName: string;
  readonly lastName: string;
}

interface AuthResponse {
  readonly success: boolean;
  readonly message: string;
  readonly user?: UserProfile;
  readonly session?: {
    readonly accessToken: string;
    readonly refreshToken: string;
    readonly expiresAt: number;
  };
}

interface ErrorResponse {
  readonly success: false;
  readonly error: string;
}

const authRoutes = new Hono();

const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const validatePassword = (password: string): boolean => {
  return password.length >= 8;
};

const validateName = (name: string): boolean => {
  return name.trim().length >= 2;
};

// Inscription
authRoutes.post("/signup", async (c) => {
  try {
    const body = (await c.req.json()) as SignupRequest;
    const { email, password, firstName, lastName } = body;

    if (!email || !password || !firstName || !lastName) {
      return c.json<ErrorResponse>(
        {
          success: false,
          error: "Tous les champs sont requis",
        },
        400
      );
    }

    if (!validateEmail(email)) {
      return c.json<ErrorResponse>(
        {
          success: false,
          error: "Format d'email invalide",
        },
        400
      );
    }

    if (!validatePassword(password)) {
      return c.json<ErrorResponse>(
        {
          success: false,
          error: "Le mot de passe doit contenir au moins 8 caractères",
        },
        400
      );
    }

    if (!validateName(firstName) || !validateName(lastName)) {
      return c.json<ErrorResponse>(
        {
          success: false,
          error: "Le prénom et nom doivent contenir au moins 2 caractères",
        },
        400
      );
    }

    const { data: authData, error: authError } =
      await supabaseAdmin.auth.admin.createUser({
        email: email.toLowerCase().trim(),
        password,
        email_confirm: true,
        user_metadata: {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
        },
      });

    if (authError) {
      if (authError.message.includes("already registered")) {
        return c.json<ErrorResponse>(
          {
            success: false,
            error: "Un compte existe déjà avec cette adresse email",
          },
          409
        );
      }

      return c.json<ErrorResponse>(
        {
          success: false,
          error: authError.message,
        },
        400
      );
    }

    if (!authData.user) {
      return c.json<ErrorResponse>(
        {
          success: false,
          error: "Impossible de créer le compte utilisateur",
        },
        500
      );
    }

    return c.json<AuthResponse>(
      {
        success: true,
        message: "Compte créé avec succès",
        user: {
          id: authData.user.id,
          email: authData.user.email!,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
        },
      },
      201
    );
  } catch (error) {
    console.error("Erreur signup:", error);
    return c.json<ErrorResponse>(
      {
        success: false,
        error: "Erreur interne du serveur",
      },
      500
    );
  }
});

// Connexion
authRoutes.post("/signin", async (c) => {
  try {
    const body = (await c.req.json()) as SigninRequest;
    const { email, password } = body;

    if (!email || !password) {
      return c.json<ErrorResponse>(
        {
          success: false,
          error: "Email et mot de passe requis",
        },
        400
      );
    }

    const { data: authData, error: authError } =
      await supabaseAdmin.auth.signInWithPassword({
        email: email.toLowerCase().trim(),
        password,
      });

    if (authError) {
      return c.json<ErrorResponse>(
        {
          success: false,
          error: "Email ou mot de passe incorrect",
        },
        401
      );
    }

    if (!authData.user || !authData.session) {
      return c.json<ErrorResponse>(
        {
          success: false,
          error: "Erreur lors de la connexion",
        },
        500
      );
    }

    // Configuration des cookies sécurisés
    setCookie(c, "sb-access-token", authData.session.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "Lax",
      maxAge: 60 * 60 * 24 * 7, // 7 jours
      path: "/",
    });

    setCookie(c, "sb-refresh-token", authData.session.refresh_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "Lax",
      maxAge: 60 * 60 * 24 * 30, // 30 jours
      path: "/",
    });

    return c.json<AuthResponse>(
      {
        success: true,
        message: "Connexion réussie",
        user: {
          id: authData.user.id,
          email: authData.user.email!,
          firstName: authData.user.user_metadata?.firstName || "",
          lastName: authData.user.user_metadata?.lastName || "",
        },
        session: {
          accessToken: authData.session.access_token,
          refreshToken: authData.session.refresh_token,
          expiresAt: authData.session.expires_at || 0,
        },
      },
      200
    );
  } catch (error) {
    console.error("Erreur signin:", error);
    return c.json<ErrorResponse>(
      {
        success: false,
        error: "Erreur interne du serveur",
      },
      500
    );
  }
});

// Déconnexion
authRoutes.post("/signout", async (c) => {
  try {
    // Suppression des cookies
    setCookie(c, "sb-access-token", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "Lax",
      maxAge: 0,
      path: "/",
    });

    setCookie(c, "sb-refresh-token", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "Lax",
      maxAge: 0,
      path: "/",
    });

    return c.json<AuthResponse>({
      success: true,
      message: "Déconnexion réussie",
    });
  } catch (error) {
    console.error("Erreur signout:", error);
    return c.json<ErrorResponse>(
      {
        success: false,
        error: "Erreur lors de la déconnexion",
      },
      500
    );
  }
});

export { authRoutes };
