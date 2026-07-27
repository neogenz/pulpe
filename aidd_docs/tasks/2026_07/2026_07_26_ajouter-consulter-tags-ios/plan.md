---
objective: "Les utilisateurs iOS peuvent créer, sélectionner et consulter jusqu’à dix tags sur les prévisions, réels et lignes de modèle sans perdre les associations lors d’une modification inchangée."
status: in-progress
---

# Plan: Ajouter et consulter les tags sur iOS

## Overview

| Field      | Value                   |
| ---------- | ----------------------- |
| **Goal**   | Rendre les tags utilisables de bout en bout dans les formulaires et lignes iOS existants |
| **Source** | Ticket Linear `PUL-294` |

## Phases

| #   | Phase                                  | File                         |
| --- | -------------------------------------- | ---------------------------- |
| 1   | Contrat iOS et catalogue utilisateur   | [`phase-1.md`](./phase-1.md) |
| 2   | Sélection, création et mutations       | [`phase-2.md`](./phase-2.md) |
| 3   | Consultation sur les surfaces de ligne | [`phase-3.md`](./phase-3.md) |

## Decisions

| Decision | Why |
| -------- | --- |
| Porter le catalogue dans un `TagStore` applicatif réinitialisé à la déconnexion | Les formulaires, Budget Details, Mois en cours et modèles doivent résoudre les mêmes ids sans multiplier les chargements ni exposer les tags d’un utilisateur précédent |
| Garder `tagIds` optionnel dans les modèles de lecture et les DTO PATCH | Les réponses de projection peuvent omettre le champ; côté PATCH, `nil` préserve les tags et `[]` les détache explicitement |
| Couvrir les six formulaires réels plutôt que les trois noms historiques du ticket | La création d’un réel lié et l’édition d’un réel ont été séparées en pages distinctes; les ignorer laisserait CA3 partiellement faux |
| Ne pas rattacher des tags après un lissage par une rafale de PATCH | `POST /budget-lines/spread` n’accepte pas `tagIds`; une compensation client serait non atomique et contredirait le hors-périmètre backend |
