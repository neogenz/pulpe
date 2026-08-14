---
status: pending
---

# Instruction: Guides evergreen Suisse romande (3 articles)

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete

```txt
landing/
├── app/guides/
│   ├── budget-mensuel-suisse-exemple/page.tsx       ✅ SERP = PDFs institutionnels ; gap = provisioning interactif jeune actif
│   ├── budgeter-primes-maladie/page.tsx             ✅ ⏰ PUBLIER AVANT DÉBUT SEPTEMBRE 2026 (annonce OFSP fin sept)
│   └── epargner-avec-salaire-suisse/page.tsx        ✅ format à battre = calculsuisse.ch (guide + calculateur hybride)
└── components/guides/guides.ts                      ✏️ 3 entrées registre
```

## Contexte vérifié (recherche adversariale, juillet 2026)

**Chiffres confirmés aux sources primaires (à citer avec lien — E-E-A-T) :**

| Donnée                                   | Valeur vérifiée                                     | Source primaire        |
| ---------------------------------------- | ---------------------------------------------------- | ---------------------- |
| Primes 2026 (annonce OFSP 23.09.2025)    | +4.4 % moyen, CHF 393.30/mois ; jeunes 19-25 : CHF 326.30 (+4.2 %) | OFSP/BAG communiqué    |
| Historique hausses                       | +6.6 % (2023), +8.7 % (2024), +6 % (2025), +4.4 % (2026) | OFSP via RTS           |
| Prévision 2027 (déjà publique)           | +3.7 % (Comparis, mai 2026) ; ~5 % signalé par l'OFSP | Comparis + RTS         |
| Salaire médian brut plein temps           | CHF 7'024/mois (ESS 2024 ; Zurich 7'502 / Tessin 5'708) | OFS/BFS                |
| Loyer net moyen                          | ~CHF 1'412 (2022) → ~1'451 (2023)                    | OFS                    |
| Taux d'épargne ménages                   | ~17.5-20 % du revenu ; quintile inférieur < 5 %       | OFS EBM (relais)       |
| Subsides primes Romandie                 | **32.2 % des Romands ont reçu un subside en 2024** — citer ce taux de recours, PAS « 1 sur 3 y aurait droit sans le savoir » (copy de courtier, non officiel) | stat cantonale relayée |

Non vérifiés (ne pas imprimer sans re-check) : loyer Jura ~981, plafond épargne 1'460/mois.

**Angles gap confirmés (corrigés par les sceptiques) :**
- « exemple budget mensuel suisse » : Budget-conseil Suisse a une app ET couvre jeunes/apprentis/étudiants — le gap n'est PAS « interactif jeune », c'est le **provisioning prospectif** (« combien il te restera dans X mois »), le modèle Pulpe. moneyland.ch (FR disponible, autorité forte, contenu EN-first) est à nommer dans le paysage.
- « primes maladie » : SERP = 100 % comparateurs « change de caisse » + news. **Personne** ne couvre « provisionner la hausse dans son budget mensuel des mois à l'avance » — l'angle Pulpe exact. Prévoir un refresh d'1 h le jour de l'annonce des chiffres 2027.
- « combien épargner salaire suisse » : #1 = calculsuisse.ch (hybride guide + calculateur = le format à battre) ; différencier sur jeune actif premier salaire, pilier 3a, primes comme charge fixe.

## User Journey

```mermaid
flowchart TD
  A[Recherche d'un problème concret: primes, épargne, exemple de budget] --> B[Guide]
  B --> C[Réponse chiffrée, sources officielles OFS/OFSP liées]
  C --> D[Maillage interne: calculateur + autres guides + pages comparatives]
  D --> E[CTA Pulpe: "provisionne ça dans ton budget" — la feature lissage/prévisions]
```

## Tasks to do

### `1)` Rédiger les 3 guides

> ~1200 mots chacun, hiérarchie visuelle > verbosité, tutoiement, chaque chiffre lié à sa source primaire.

1. `budgeter-primes-maladie` **en premier (deadline début septembre)** : structure « provisionner la hausse » (différenciateur), prime jeune CHF 326.30, taux de recours subsides 32.2 %, pont vers le lissage Pulpe. Prévoir la section « chiffres 2027 » à remplir le jour J.
2. `budget-mensuel-suisse-exemple` : 2-3 profils chiffrés (jeune actif Lausanne, couple, étudiant) construits sur les valeurs vérifiées (salaire médian, loyer, primes) ; angle prospectif (12 mois), lien calculateur.
3. `epargner-avec-salaire-suisse` : repères par tranche autour du médian CHF 7'024, méthode payer-toi-d'abord, pilier 3a ; pont vers objectifs d'épargne.
4. Maillage : chaque guide lie le calculateur (phase 3) + 1-2 autres guides.

## Test acceptance criteria

| Task | Acceptance criteria                                                                          |
| ---- | --------------------------------------------------------------------------------------------- |
| 1    | Chaque montant publié figure dans le tableau vérifié ci-dessus OU porte une source primaire fraîche liée ; les 2 chiffres non vérifiés n'apparaissent pas sans re-check |
| 1    | Le guide primes est mergeable avant le 1er septembre 2026 et l'angle est le provisioning, pas le « change de caisse » |
| 1    | Build prod OK, 3 guides au registre/sitemap, ≥ 2 liens internes par guide                      |
