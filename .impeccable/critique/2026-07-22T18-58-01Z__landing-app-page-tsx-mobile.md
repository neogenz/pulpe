---
target: landing page mobile (densité, pairing 3 étapes, fil rouge)
total_score: 27
p0_count: 2
p1_count: 1
timestamp: 2026-07-22T18-58-01Z
slug: landing-app-page-tsx-mobile
---
# Critique — Landing Pulpe, mobile 390×844 (14,1 folds, 1085 mots, 37 médias)

## Design Health Score — 27/40 (Good)

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | Aucun repère de progression sur 14 VH ; jamais de CTA entre hero et FinalCTA |
| 2 | Match System / Real World | 4 | Copie ancrée (impôts de juillet, CHF, loyer), tutoiement parfait |
| 3 | User Control and Freedom | 2 | Lightbox sans affordance tactile (icône en group-hover) ; un tap de scroll peut ouvrir la lightbox |
| 4 | Consistency and Standards | 3 | Tokens cohérents ; sémantique nom/rôle inversée dans Testimonials |
| 5 | Error Prevention | 3 | Peu de surface d'erreur ; ancres propres |
| 6 | Recognition Rather Than Recall | 2 | Pairing image/label HowItWorks exige de retenir le contexte sur 2,6 VH |
| 7 | Flexibility and Efficiency | 3 | Skip-link, ancres, lightbox |
| 8 | Aesthetic and Minimalist Design | 2 | Hero 6 blocs, Solution 3,1 VH d'images, Features 5 cartes — contredit le « maximum breathing room » |
| 9 | Error Recovery | 3 | FAQ préempte les objections |
| 10 | Help and Documentation | 3 | FAQ accordéon, note du créateur, footer support |

## Anti-Patterns Verdict

LLM : majoritairement non coupable. 3 tells : scaffolding numéroté 01/02/03 (HowItWorks), hero-metric template (carte « 926 CHF »), témoignages anonymes répétitifs dont un qui recycle la citation du hero.

Deterministic scan : detect.mjs sur landing/components + landing/app → 0 finding (exit 0, zéro valide : 34 fichiers TSX/CSS scannés, pas d'ignore). Réserve : détecteur regex peu couvrant sur Tailwind v4 + tokens custom.

## Priority Issues

- [P0] Pairing image/étape cassé dans HowItWorks (plainte utilisateur confirmée) : figure (~568 px) rendue AVANT pastille+titre (HowItWorks.tsx:82-88), gap-y-12 entre étapes → la capture N+1 suit le texte N. Fix : StepCopy au-dessus de l'image sur mobile, captures rognées (~420 px), objectif numéro+titre+image dans un même fold.
- [P0] Densité globale : 14,1 VH. Hero 1,8 VH (6 blocs), Solution 3,12 VH image-dominant, Features 2,05 VH, WhyFree 1,62 VH. Benchmark one-idea-per-fold violé 3 fois. Fix : rogner captures, supprimer témoignage dupliqué, tronquer adjustments Features, alléger hero → objectif 10-11 VH.
- [P1] Aucun CTA persistant : ~9 VH sans action primaire entre hero et FinalCTA. Fix : barre CTA sticky bas de viewport (thumb zone) après le hero.
- [P2] Crédibilité témoignages : 2× « Une utilisatrice de Pulpe », rôle = nom de feature, témoignage 3 paraphrase le hero. Fix : prénom + contexte, supprimer le doublon.
- [P2] Screenshots : affordance lightbox invisible au toucher (Screenshot.tsx:161) + email personnel visible dans les captures. Fix : badge « Agrandir » persistant sur <md, régénérer les assets avec un compte démo.

## Persona Red Flags

- Jordan : attribue la capture « Mes budgets » à l'étape 2 alors qu'elle illustre l'étape 3 ; quitte sans comprendre « mois type → projection ».
- Casey : interrompue à mi-Solution, aucun repère ni CTA ; un tap pour stopper le scroll peut ouvrir la lightbox (bouton pleine surface).
- Riley : tap targets OK, reduced-motion respecté ; h2 Poppins bold 36 px = 4-5 lignes de gras à 390 px ; liens footer ≈20-24 px de haut (<44 px).
- Léa (27, Genève, tram — persona projet) : adore hero + PainPoints, décroche sur 3 VH de captures d'app, ferme avant Platforms.

## Minor Observations

- Header fixe 56 px translucide : contenu lisible à travers ; ancre #how-it-works atterrit après le h2, sans contexte.
- « Gratuit · Montants chiffrés · Aucune connexion bancaire » répété sous 3-4 formes (hero, WhyFree, FAQ, FinalCTA) — la réassurance devient du bruit.
- « 01/02/03 » avec zéro initial trop solennel pour 3 étapes.
- Footer mobile : 6 liens sans hiérarchie, cibles <44 px.
- HowItWorks n'a pas de h2 propre (absorbé par Solution) — confusion d'identité de section.
- Badge dev Next.js superposé au contenu (artefact dev-only).

## Questions to Consider

1. Sans les 3 captures de HowItWorks (texte seul), la conversion mobile baisserait-elle vraiment ?
2. Pourquoi la page cesse-t-elle de raconter l'histoire des impôts de juillet au moment où la visiteuse est convaincue ?
3. Deux témoignages anonymes sur trois dont un recyclé : qu'est-ce que ça signale sur la base d'utilisateurs réelle ?
