# iOS Versioning

## Clés Apple

| Clé Info.plist | Variable Xcode | Affichage |
|----------------|----------------|-----------|
| `CFBundleShortVersionString` | `MARKETING_VERSION` | App Store, utilisateur |
| `CFBundleVersion` | `CURRENT_PROJECT_VERSION` | TestFlight, interne |

## Convention

```
MARKETING_VERSION = 1.2.0    # Semantic Versioning (X.Y.Z)
CURRENT_PROJECT_VERSION = 1  # Entier, reset à 1 pour chaque nouvelle version
```

**Cycle type:**
```
1.0.0 build 1 → build 2 → build 3 (release)
                              ↓
                        1.1.0 build 1 (nouvelle version, reset)
```

## Script

```bash
cd ios

./scripts/bump-version.sh           # Affiche version courante
./scripts/bump-version.sh major     # 1.0.0 → 2.0.0, build reset à 1
./scripts/bump-version.sh minor     # 1.0.0 → 1.1.0, build reset à 1
./scripts/bump-version.sh patch     # 1.0.0 → 1.0.1, build reset à 1
./scripts/bump-version.sh build     # build 1 → 2

xcodegen generate                   # Après bump, régénérer le projet
```

## Règles App Store Connect

1. **Build number croissant** - Pour une même version marketing, chaque upload doit avoir un build number supérieur
2. **Reset autorisé** - Quand la version marketing change, le build peut repartir à 1
3. **Jamais décroissant** - Un build déjà soumis ne peut pas être réutilisé

## Workflow Release

1. Développement sur `1.0.0 build 1, 2, 3...`
2. TestFlight: upload chaque build pour test
3. Release: soumettre le dernier build stable
4. Nouvelle version: `./scripts/bump-version.sh minor` → `1.1.0 build 1`

## Référence

[Apple Technical Note TN2420](https://developer.apple.com/library/archive/technotes/tn2420/_index.html) - Version Numbers and Build Numbers
