# iOS Versioning

## Clés Apple

| Clé Info.plist               | Variable Xcode            | Affichage              |
| ---------------------------- | ------------------------- | ---------------------- |
| `CFBundleShortVersionString` | `MARKETING_VERSION`       | App Store, utilisateur |
| `CFBundleVersion`            | `CURRENT_PROJECT_VERSION` | TestFlight, interne    |

## Indépendance de la version produit

iOS `MARKETING_VERSION` suit la SemVer propre à l'app publiée sur l'App Store ; elle
ne copie jamais la version produit du `package.json` racine. Une release web/backend
laisse iOS inchangé. Pour du code iOS, `/release` propose :

- `build` pour un changement technique sans nouvelle version visible ;
- `patch` pour une correction utilisateur ;
- `minor` pour une fonctionnalité utilisateur.

La décision et le numéro de build exact sont approuvés avant toute modification.

## Convention

```
MARKETING_VERSION = 1.3.2    # Version App Store indépendante
CURRENT_PROJECT_VERSION = 3  # Build ; supérieur à tout build déjà uploadé
```

**Cycle type :**

```
1.3.2 build 1 → build 2 → build 3 (release)
                              ↓
                         1.3.3 build 1 (prochaine correction iOS)
```

## Script

```bash
cd ios

./scripts/bump-version.sh           # Affiche version courante
./scripts/bump-version.sh major     # X.0.0, build reset à 1
./scripts/bump-version.sh minor     # X.Y.0, build reset à 1
./scripts/bump-version.sh patch     # X.Y.Z, build reset à 1
./scripts/bump-version.sh build     # build N+1
./scripts/bump-version.sh set X.Y.Z # Définir une version iOS explicite

xcodegen generate                   # Après bump, régénérer le projet
```

Avant un bump de build, consulter App Store Connect : le dépôt peut être en retard sur
un build TestFlight déjà uploadé. `/release` applique le numéro exact approuvé, puis
régénère le projet avec `xcodegen`.

## Règles App Store Connect

1. **Version croissante** — Chaque soumission doit avoir une version marketing supérieure ou égale à la précédente
2. **Build number croissant** — Pour une même version, chaque upload doit avoir un build supérieur
3. **Reset autorisé** — Quand la version change, le build peut repartir à 1
4. **Jamais décroissant** — Un build/version déjà soumis ne peut pas être réutilisé

## Référence

[Apple Technical Note TN2420](https://developer.apple.com/library/archive/technotes/tn2420/_index.html) — Version Numbers and Build Numbers
