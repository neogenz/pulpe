---
objective: "Le graphique de l’accueil iOS situe immédiatement la trajectoire projetée par rapport au solde final prévu, sans perdre sa lecture minimaliste."
status: implemented
---

# Plan: Repère du plan dans le graphique d’accueil iOS

## Overview

| Field      | Value |
| ---------- | ----- |
| **Goal**   | Ajouter au graphique de solde une référence horizontale minimale et sémantiquement correcte. |
| **Source** | Texte utilisateur du 29 juillet 2026 : conserver le graphique minimal et rendre visible la limite issue du budget. |

## Phases

| #   | Phase | File |
| --- | ----- | ---- |
| 1   | Référence du solde prévu | [`phase-1.md`](./phase-1.md) |

## Resources

| Source | Verified |
| ------ | -------- |
| [Emil Kowalski — Apple Design](https://github.com/emilkowalski/skills/blob/main/skills/apple-design/SKILL.md) | La simplicité n’est pas l’absence de contexte : un repère peut simplifier la lecture s’il a un but unique, reste subordonné et porte un libellé spécifique. Les exemples d’API web ne s’appliquent pas au SwiftUI. |
| [Emil Kowalski — Design Engineering](https://github.com/emilkowalski/skills/blob/main/skills/emil-design-eng/SKILL.md) | Une visualisation consultée fréquemment ne reçoit aucune animation décorative ; chaque mouvement doit expliquer un état ou répondre à une interaction. |

## Decisions

| Decision | Why |
| -------- | --- |
| La ligne horizontale représente `BalanceTrajectory.plannedBalance`, donc le solde final prévu, et non un « budget maximal ». | Le graphique mesure un solde restant au fil du mois. Une enveloppe maximale de dépenses utiliserait une autre grandeur et rendrait la comparaison trompeuse. |
| La référence porte le libellé spécifique « Solde prévu » sans répéter son montant. | Le libellé évite l’ambiguïté de « Prévu » seul ; la projection et le montant du plan sont déjà explicités au-dessus. |
| La référence et les courbes n’introduisent aucune animation propre au graphique. | Le graphique est consulté à chaque passage sur l’accueil et n’est pas interactif ; une animation ne transmettrait aucun état supplémentaire. |
