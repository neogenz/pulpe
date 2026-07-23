# Review: Continuité visuelle, contraste et cadence de la landing

- **Verdict**: approve
- **Diff**: `origin/preview...codex/landing-mobile-borumi-fade`
- **Axes run**: code, functional, relevancy
- **Date**: 2026_07_19
- **Findings**: 0 critical, 0 warning, 0 minor

## Phases

### Phase 1 — Continuité visuelle et narrative sur mobile

- [x] Les contrats de régression distinguent l'ancien fond global, le clipping des halos, l'ancienne hiérarchie des preuves et l'espacement desktop détaché du rendu attendu — `landing/app/accessibility.test.tsx:113`, `landing/app/accessibility.test.tsx:178`
- [x] Le hero et `PainPoints` portent chacun deux ellipses mobiles `40vw × 60vh`, tournées à `-30deg`, floutées à `150px`, avec une opacité de `0.4`; elles débordent entre les sections et sont coupées uniquement par `#main-content` — `landing/app/globals.css:140`
- [x] Le raccord mobile vaut `72px`, le récit suit les preuves après `40px` et le raccord dashboard → preuves est borné à `112px` à partir de `lg`, sans modifier le palier `md` — `landing/components/sections/Hero.tsx:86`, `landing/app/globals.css:147`, `landing/components/sections/PainPoints.tsx:27`, `landing/components/sections/PainPoints.tsx:47`
- [x] Les preuves utilisent la hiérarchie `value → label`, une grille mobile bornée et la rangée existante dès `sm` — `landing/components/sections/PainPoints.tsx:4`, `landing/components/sections/PainPoints.tsx:29`
- [x] Le contrat landing décrit les halos verts sectionnels, leur débordement interne, le clipping au canvas et maintient l'interdiction de la grille et du verre sur le contenu — `landing/DESIGN.md:29`, `landing/DESIGN.md:80`
- [x] Le breakpoint mobile s'arrête à `767px`, le fond desktop reste distinct et les tests couvrent le champ diffus, le raccord desktop et la structure responsive sans nouvelle dépendance — `landing/app/globals.css:140`, `landing/components/sections/Hero.tsx:86`, `landing/app/accessibility.test.tsx:113`, `landing/app/accessibility.test.tsx:178`
- [x] Le sous-texte du CTA final utilise le texte principal à 80 % d'opacité pour rester lisible sur le champ ambiant, avec un contrat de régression dédié — `landing/components/sections/FinalCTA.tsx:18`, `landing/app/accessibility.test.tsx:357`
- [x] La primitive partage la frontière entre sections avec `40px` par côté sur mobile et `60px` à partir de `lg`; le contrat interdit le retour aux valeurs doublées et la documentation exprime la distance cumulée — `landing/components/ui/Section.tsx:23`, `landing/app/accessibility.test.tsx:205`, `landing/DESIGN.md:70`

## Findings

None.

## Verification

| Metric | Value |
| --- | --- |
| Verified | 100% (8/8) |
| Files checked | `landing/app/globals.css`, `landing/components/sections/Hero.tsx`, `landing/components/sections/PainPoints.tsx`, `landing/components/sections/FinalCTA.tsx`, `landing/components/ui/Section.tsx`, `landing/app/accessibility.test.tsx`, `landing/DESIGN.md` |
| Unchecked | none |
| Unplanned | none |
