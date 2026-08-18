# Review: Captures iOS pour l’App Store

- **Verdict**: approve
- **Diff**: `d85bd55368b7e0275fca4f6dfe41cc7b02b55c56...HEAD`
- **Axes run**: code, functional, relevancy
- **Date**: 2026_08_16
- **Findings**: 0 critical, 0 warning, 0 minor

## Phases

### Phase 1 — Préparer la session locale déterministe

- [x] Le backend local attendu est contrôlé sans démarrer, arrêter ni réinitialiser Supabase — `.agents/skills/refresh-pulpe-app-store-captures/scripts/refresh.sh:9`, `.agents/skills/refresh-pulpe-app-store-captures/SKILL.md:69`
- [x] La configuration et le runner ciblent l’iPhone 17 Pro Max iOS 26.5, le français et le mode clair — `.agents/skills/refresh-pulpe-app-store-captures/references/routes.json:4`, `.agents/skills/refresh-pulpe-app-store-captures/scripts/capture.py:132`
- [x] Le runner gère onboarding, connexion démo et PIN avec des identifiants stables ; `axe` remplace NoQA conformément à la décision utilisateur postérieure au plan — `.agents/skills/refresh-pulpe-app-store-captures/scripts/capture.py:110`

### Phase 2 — Capturer et contrôler les huit écrans

- [x] Les huit sorties inspectées sont en français, CHF, mode clair, à 09:41 et sans état transitoire ou élément parasite — `appstore-screenshots/*.png`, `.agents/skills/refresh-pulpe-app-store-captures/scripts/capture.py:199`
- [x] Le roster contient les huit écrans demandés et couvre les destinations des planches 1 à 5 — `.agents/skills/refresh-pulpe-app-store-captures/references/routes.json:9`
- [x] Les huit PNG sont lisibles, opaques, mesurent 1320 × 2868 et le dossier est ignoré par Git — `.agents/skills/refresh-pulpe-app-store-captures/scripts/capture.py:157`, `.gitignore:158`

## Findings

None.

## Verification

| Metric        | Value |
| ------------- | ----- |
| Verified      | 100% (6/6) |
| Files checked | `.agents/skills/refresh-pulpe-app-store-captures/{SKILL.md,agents/openai.yaml,references/routes.json,scripts/capture.py,scripts/refresh.sh,scripts/test_capture.py}`, `.gitignore`, les 9 fichiers Swift modifiés, `plan.md`, `phase-1.md`, `phase-2.md`, `appstore-screenshots/*.png` |
| Unchecked     | none |
| Unplanned     | Skill de rafraîchissement réutilisable, fixture marketing DEBUG et identifiants d’accessibilité — demandés explicitement après le plan initial |
