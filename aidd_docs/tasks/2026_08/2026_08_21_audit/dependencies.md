# Audit Android — Dependencies

- Date : 2026-08-21
- Périmètre : `android/package.json`, lockfile pnpm, compatibilité Expo et advisories npm
- Santé : **correcte côté runtime, dette connue dans la toolchain**

## Findings

| Sev | Category     | Location                  | Issue                                                                                                                                                                                                                                            | Suggested fix                                                                                                                                        | Effort |
| --- | ------------ | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| 🟡  | Supply chain | `android/package.json:29` | `pnpm audit` remonte 18 advisories Android : 11 high, 6 moderate, 1 low. Les chemins observés sont build/test/lint (`Expo/Metro`, Jest, ESLint), pas le bundle runtime; deux high `image-size` via Metro n'ont pas de version corrigée annoncée. | Mettre à niveau par une release Expo compatible, éviter les overrides isolés, puis rejouer export, tests et audit; suivre spécialement `image-size`. | M      |

## Top actions

1. Traiter les advisories avec la prochaine montée coordonnée Expo/Jest/ESLint.
2. Ne pas forcer les majors React Native/Skia hors matrice Expo uniquement pour réduire `outdated`.

## Coverage

- Vérifiés le 2026-08-21 : audit npm réseau, `pnpm outdated`, export production et `expo install --check` (ce dernier a utilisé la carte locale et signale sa validation offline comme moins fiable).
- Résultat `outdated` : écarts surtout patch/SDK et majors incompatibles; aucun package direct marqué deprecated.
- Limite : `pnpm licenses list --json` a échoué sur un index de package manquant dans le store pnpm; l'inventaire de licences reste à produire dans un environnement d'installation frais.
