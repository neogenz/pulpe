# iOS Versioning

## Clés Apple

| Clé Info.plist | Variable Xcode | Affichage |
|----------------|----------------|-----------|
| `CFBundleShortVersionString` | `MARKETING_VERSION` | App Store, utilisateur |
| `CFBundleVersion` | `CURRENT_PROJECT_VERSION` | TestFlight, interne |

## Alignement avec la version produit

iOS `MARKETING_VERSION` s'aligne sur la **version produit** (root `package.json`) quand du code iOS est modifié.

Si seul le web ou le backend change, iOS ne bouge pas. iOS peut donc sauter des versions :

```
Produit v1.7.0 → iOS bumpé à 1.7.0 (code iOS modifié)
Produit v1.8.0 → iOS inchangé (web only)
Produit v1.9.0 → iOS inchangé (backend only)
Produit v1.10.0 → iOS bumpé à 1.10.0 (code iOS modifié)
```

Apple impose des versions strictement croissantes — la version produit garantit cette contrainte puisqu'elle ne fait qu'avancer.

## Convention

```
MARKETING_VERSION = 1.7.0    # Alignée sur la version produit
CURRENT_PROJECT_VERSION = 1  # Entier, reset à 1 pour chaque nouvelle version
```

**Cycle type :**
```
1.7.0 build 1 → build 2 → build 3 (release)
                              ↓
                        1.10.0 build 1 (prochaine release iOS)
```

## Script

```bash
cd ios

./scripts/bump-version.sh           # Affiche version courante
./scripts/bump-version.sh major     # X.0.0, build reset à 1
./scripts/bump-version.sh minor     # X.Y.0, build reset à 1
./scripts/bump-version.sh patch     # X.Y.Z, build reset à 1
./scripts/bump-version.sh build     # build N+1
./scripts/bump-version.sh set X.Y.Z # Aligner sur une version produit spécifique

xcodegen generate                   # Après bump, régénérer le projet
```

**Note :** Le bump iOS lors d'une release ne se fait pas via major/minor/patch mais via `set` pour s'aligner directement sur la version produit.

## Règles App Store Connect

1. **Version croissante** — Chaque soumission doit avoir une version marketing supérieure ou égale à la précédente
2. **Build number croissant** — Pour une même version, chaque upload doit avoir un build supérieur
3. **Reset autorisé** — Quand la version change, le build peut repartir à 1
4. **Jamais décroissant** — Un build/version déjà soumis ne peut pas être réutilisé

## Référence

[Apple Technical Note TN2420](https://developer.apple.com/library/archive/technotes/tn2420/_index.html) — Version Numbers and Build Numbers
