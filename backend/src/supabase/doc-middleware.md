Excellente question ! Voici les différences clés entre ces deux middlewares :

## 🔒 `authMiddleware` (Authentification OBLIGATOIRE)

```typescript
export const authMiddleware = createMiddleware(async (c, next) => {
  // Si pas de token → ERREUR 401
  if (!accessToken) {
    return c.json<ErrorResponse>(
      {
        success: false,
        error: "Token d'accès requis",
      },
      401
    );
  }

  // Si token invalide → ERREUR 401
  if (userError || !user) {
    return c.json<ErrorResponse>(
      {
        success: false,
        error: "Token d'accès invalide ou expiré",
      },
      401
    );
  }

  // ✅ Continue SEULEMENT si authentifié
  await next();
});
```

**Usage** : Routes qui nécessitent une connexion

```typescript
userRoutes.get("/me", authMiddleware, async (c) => {
  const user = c.get("user"); // ✅ Garanti d'exister
  // L'utilisateur est forcément connecté ici
});
```

---

## 🔓 `optionalAuthMiddleware` (Authentification OPTIONNELLE)

```typescript
export const optionalAuthMiddleware = createMiddleware(async (c, next) => {
  try {
    const accessToken =
      getCookie(c, "sb-access-token") ||
      c.req.header("Authorization")?.replace("Bearer ", "");

    if (accessToken) {
      // ✅ Si token présent ET valide → ajoute user au contexte
      const supabase = createSupabaseClient(accessToken);
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (!userError && user) {
        // Utilisateur connecté
        c.set("user", authenticatedUser);
        c.set("supabase", supabase);
      }
    }

    // ✅ Continue TOUJOURS (connecté ou pas)
    await next();
  } catch (error) {
    // ✅ En cas d'erreur → continue quand même
    await next();
  }
});
```

**Usage** : Routes qui fonctionnent avec OU sans connexion

```typescript
userRoutes.get("/public-info", optionalAuthMiddleware, async (c) => {
  const user = c.get("user"); // ⚠️ Peut être undefined

  if (user) {
    return c.json({ message: `Bonjour ${user.firstName} !` });
  } else {
    return c.json({ message: "Bonjour visiteur !" });
  }
});
```

## 📊 Comparaison pratique

| Aspect                               | `authMiddleware`     | `optionalAuthMiddleware` |
| ------------------------------------ | -------------------- | ------------------------ |
| **Comportement si pas de token**     | ❌ Erreur 401        | ✅ Continue              |
| **Comportement si token invalide**   | ❌ Erreur 401        | ✅ Continue              |
| **Variable `user` dans le contexte** | ✅ Toujours présente | ⚠️ Peut être `undefined` |
| **Usage typique**                    | Routes privées       | Routes mixtes            |

## 🎯 Cas d'usage concrets

### Routes avec `authMiddleware` :

- `/api/user/me` - Profil utilisateur
- `/api/user/profile` - Mise à jour profil
- `/api/budget/create` - Créer un budget
- `/api/orders/history` - Historique commandes

### Routes avec `optionalAuthMiddleware` :

- `/api/products/list` - Liste produits (prix différents si connecté)
- `/api/blog/posts` - Articles de blog (favoris si connecté)
- `/api/homepage/data` - Page d'accueil personnalisée
- `/api/search/results` - Résultats adaptés au profil

## 💡 Exemple concret d'usage

```typescript
// Route OBLIGATOIREMENT authentifiée
userRoutes.get("/me", authMiddleware, async (c) => {
  const user = c.get("user"); // ✅ Type: AuthenticatedUser
  return c.json({ user }); // Pas besoin de vérifier user
});

// Route avec contenu adapté
productRoutes.get("/catalog", optionalAuthMiddleware, async (c) => {
  const user = c.get("user"); // ⚠️ Type: AuthenticatedUser | undefined

  if (user) {
    // Afficher prix membre + recommandations personnalisées
    const products = await getProductsForUser(user.id);
    return c.json({ products, userType: "member" });
  } else {
    // Afficher prix public + contenu générique
    const products = await getPublicProducts();
    return c.json({ products, userType: "guest" });
  }
});
```

## 🚀 Avantages du système

1. **Flexibilité** : Une route peut fonctionner avec ou sans auth
2. **UX meilleure** : Pas de redirection forcée vers login
3. **Personnalisation** : Contenu adapté selon le statut
4. **Performance** : Pas de double requête d'auth

Cette approche vous permet de créer des expériences utilisateur fluides où certaines fonctionnalités s'enrichissent quand l'utilisateur est connecté, sans pour autant bloquer l'accès au contenu de base ! 🎉
