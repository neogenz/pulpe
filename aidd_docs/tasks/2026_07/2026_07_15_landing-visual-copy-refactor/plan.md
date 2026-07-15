---
objective: "La landing Pulpe transpose la structure de conversion, les fonds diffus et la navbar de Borumi dans l'identité Pulpe, avec un copywriting cohérent et un responsive mobile validé."
status: implemented
---

# Plan: Refonte visuelle et éditoriale de la landing Pulpe

## Overview

| Field      | Value                                                        |
| ---------- | ------------------------------------------------------------ |
| **Goal**   | Recomposer toute la landing autour d'un récit plus direct.   |
| **Source** | Demande utilisateur du 15 juillet 2026 + https://borumi.com/ |

## Phases

| #   | Phase                                              | File                         |
| --- | -------------------------------------------------- | ---------------------------- |
| 1   | Fondation visuelle, navbar et hero                 | [`phase-1.md`](./phase-1.md) |
| 2   | Récit principal et parcours en trois étapes       | [`phase-2.md`](./phase-2.md) |
| 3   | Bénéfices, plateformes et roadmap                  | [`phase-3.md`](./phase-3.md) |
| 4   | Confiance, conversion finale et cohérence SEO      | [`phase-4.md`](./phase-4.md) |

## Resources

| Source                         | Verified                                                                 |
| ------------------------------ | ------------------------------------------------------------------------ |
| https://borumi.com/            | Structure desktop/mobile, navbar, fonds diffus et pattern de copywriting |
| http://localhost:3001/         | Landing Pulpe actuelle, contrôlée à 1440×900 et 390×844                  |
| PRODUCT.md + DESIGN.md         | Positionnement, ton, identité et contraintes visuelles Pulpe             |
| landing/DESIGN.md + HEADLINE.md | Extensions landing et promesse éditoriale existante                      |

## Decisions

| Decision | Why |
| -------- | --- |
| Transposer l'architecture narrative de Borumi, pas sa typographie ni sa palette | Pulpe doit rester Poppins, calme, chaude et sémantique |
| Réutiliser les sections, primitives et captures existantes | Évite une nouvelle dépendance ou une seconde architecture de composants |
| Réserver l'effet vitré à la navbar | La transparence y exprime sa fonction flottante sans transformer chaque bloc en carte de verre |
| Produire des champs colorés radiaux et tonals en CSS/Tailwind, sans grille décorative ni grain ajouté | Préserve les performances et évite un motif générique sans valeur produit |
| Garder le contenu visible par défaut et limiter le mouvement aux séquences qui expliquent le produit | Évite qu'une animation tardive masque la preuve principale et respecte le mouvement réduit |
| Alterner composition éditoriale, preuve produit et surfaces asymétriques | Évite la répétition de grilles de cartes identiques observée sur la landing actuelle |
| Appliquer le pattern situation vécue → contraste Pulpe → résultat, avec une cadence variée | Reprend l'efficacité du copywriting de référence sans répéter une question ou un kicker à chaque section |
| N'utiliser que des preuves établies | Aucun faux avis, score, volume d'utilisateurs ou chiffre marketing ne sera inventé |
| Garder la roadmap dans le parcours, après les bénéfices et plateformes | Sa transparence sert la confiance sans interrompre la promesse initiale |
