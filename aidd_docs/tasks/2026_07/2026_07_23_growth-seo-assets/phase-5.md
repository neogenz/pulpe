---
status: pending
---

# Instruction: Kit distribution — listicles, communautés, directories

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete

```txt
aidd_docs/tasks/2026_07/2026_07_23_growth-seo-assets/
├── outreach-listicles.md      ✅ cibles vérifiées avec contacts réels + email d'outreach par cible
├── outreach-communautes.md    ✅ stratégie answer-first + 2 slots sanctionnés + drafts
└── outreach-directories.md    ✅ fiches de soumission prêtes, avec déclencheur par cible
```

## Contexte vérifié (recherche adversariale, juillet 2026)

Les cibles ci-dessous ont été vérifiées : la page existe, le contact est réel (fetch du formulaire/de l'email). Corrections notables vs plan initial : **comparis n'a aucun article apps budget** (retiré), **mustachianpost n'a pas de listicle et ferme les emails** (→ forum), **r/SuisseFinance n'existe pas** (retiré), forum-de-l-immobilier / frenchmobile introuvables (retirés), Discord non viable (retiré).

## Tasks to do

### `1)` `outreach-listicles.md` — cibles vérifiées, tiering réel

> Un email copiable par cible, avec le contact vérifié et l'angle qui matche leur ligne éditoriale.

1. **Quick wins** : meilleur-achat.ch (formulaire avec dropdown « Suggestion de comparatif », contact@meilleur-achat.ch — bar éditorial bas, valeur SEO faible, 5 min) · jowi.fr (formulaire, listicle MAJ 11.05.2026, France/EUR) · alao.ch (support@alao.ch — article FR de 2023 MAJ nov. 2024, titre réel « …pour couples et célibataires » : pitcher un **refresh 2026**, pas un simple ajout).
2. **Haute valeur éditoriale** : thepoorswiss.com (formulaire contact — ethos exact : gratuit + suisse + privacy sans sync bancaire ; article cible MAJ mars 2024, pitcher une review, pas un ajout) · Swisscom blog FR (via service presse — ils ont déjà featuré Budget bleu, startup suisse en waitlist) · magicheidi.ch (via help center /fr/tutorials ou Calendly du fondateur Nathan — positionner Pulpe comme complémentaire à leur produit facturation freelance).
3. **Long shots documentés** : moneyland.ch (viser leur page « Swiss comparison websites and apps list », PAS un listicle inexistant ; lire l'email sur moneyland.ch/en/contact manuellement — 403 automatisé) · budgethub.ch (info@budgethub.ch — concurrent direct, leur modèle SEO vit des pages « vs » ; espérance faible, coût nul) · accrodubudget.com (formulaire, France).
4. Chaque fiche : URL du listicle, date de fraîcheur constatée, contact vérifié, angle, email rédigé, probabilité.

### `2)` `outreach-communautes.md` — answer-first + 2 slots sanctionnés

> Toutes les communautés à forte valeur interdisent le self-promo à froid. Le kit encode la stratégie conforme, pas une campagne de posts.

1. **Les 2 seuls slots sanctionnés** : r/Suisse (~54k, FR — Règle 6 : pub interdite SAUF « intérêt public » ; rédiger le message aux mods AVANT tout post, puis le post calculateur gratuit) · Mustachian Post Community (forum le plus actif de Suisse, catégorie « Café francophone » — self-promo interdite SAUF **thread mensuel du dernier mercredi** ; rédiger le post pour ce thread).
2. **Comment-only** (drafts de réponses types, jamais de post outil) : r/SwissPersonalFinance (~44k — anglais uniquement, bans « self advertisements of any kind » ET sondages ET non-anglais ; le thread promo épinglé = codes promo uniquement, pas un slot) · r/askswitzerland (~237k — Règle 7 anti-promo, sondages sur pré-approbation mod) · r/vosfinances (~425k, France/frontaliers, secondaire).
3. **Facebook (vérification manuelle requise — règles login-walled)** : « Bons plans en Suisse romande », « Les Français en Suisse », « Frontaliers France – Suisse » — la fiche dit : rejoindre, lire les règles épinglées, contacter l'admin avant tout partage.
4. Caveat encodé dans le doc : les règles Reddit ont été vérifiées sur snapshots Wayback (Reddit bloque l'accès anonyme) — re-vérifier depuis un compte connecté avant de poster.

### `3)` `outreach-directories.md` — fiches prêtes + déclencheurs

> Levier 12 adapté : halo de plateformes existantes, préparé maintenant, déclenché selon le gate.

1. **AlternativeTo (passif → immédiat)** : action J+0 = créer le compte (gate d'âge ~1 semaine avant soumission) ; fiche de listing calée sur leurs facettes (iPhone, Web, freemium, EU-based) ; étape « suggest as alternative » sur la page YNAB (~398 alternatives) ; claim ownership via support@alternativeto.net (email depuis le domaine pulpe.app). Jamais d'upvotes incités (pénalisé).
2. **Product Hunt (burst → différé post-gate rétention)** : self-post officiel, AUCUN hunter à chercher ; fiche = tagline, description ≤ 260 car., thumbnail 240×240, ≥ 2 visuels 1270×760 (screenshots App Store existants), 1er commentaire maker, lancement mar-jeu 12:01 PST ; cadrer comme play backlink/crédibilité (audience anglophone, pas l'ICP romand).
3. **Directories suisses re-scopés** : Les Pépites Tech (formulaire gratuit, section Suisse — cible principale FR) · startupticker.ch (news@startupticker.ch, gratuit, MAIS critères : société incorporée + fondateur full-time — ne pitcher que sur un vrai milestone, flaguer le risque d'éligibilité) · swiss made software (optionnel, CHF 120/an tarif startup, nécessite entité légale — noter, ne pas soumettre). Retirés : SICTIC/digitalswitzerland (acteurs d'écosystème, pas d'apps), Venturelab TOP 100 (jury, pas de soumission).

## Test acceptance criteria

| Task | Acceptance criteria                                                                             |
| ---- | ------------------------------------------------------------------------------------------------ |
| 1    | Chaque cible listicle a un contact vérifié par fetch (ou l'instruction explicite de lecture manuelle pour les sites en 403) et un email prêt à envoyer |
| 2    | Chaque communauté porte ses règles réelles citées (avec la source snapshot) ; aucune tactique ne viole une règle constatée ; les 2 slots sanctionnés ont leur draft complet (message mods + post) |
| 3    | Les fiches directories sont complètes au point qu'aucune rédaction ne reste au moment de soumettre ; chaque fiche porte son déclencheur (immédiat / milestone / post-gate rétention) |
