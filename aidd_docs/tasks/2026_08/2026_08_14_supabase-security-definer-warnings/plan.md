---
objective: "Les RPC utilisateur s'appuient sur RLS dès que possible, les points d'entrée privilégiés restants sont explicitement justifiés et les 15 alertes Supabase sont ramenées aux seules exceptions nécessaires."
status: implemented
---

# Plan: Réduire les alertes SECURITY DEFINER Supabase

## Overview

| Field      | Value                                                                                                                                                       |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Goal**   | Passer 9 RPC en `SECURITY INVOKER`, fermer 1 ancien point d'entrée et conserver seulement 5 fonctions privilégiées contrôlées.                             |
| **Source** | Export Supabase Security Advisor joint le 14 août 2026 (`pasted-text.txt`), contenant 15 alertes `0029_authenticated_security_definer_function_executable`. |

## Phases

| #   | Phase                                                                   | File                         |
| --- | ----------------------------------------------------------------------- | ---------------------------- |
| 1   | Fermer le point d'entrée legacy et figer le contrat ACL                 | [`phase-1.md`](./phase-1.md) |
| 2   | Basculer les RPC de pointage et de lecture vers RLS                     | [`phase-2.md`](./phase-2.md) |
| 3   | Basculer les RPC atomiques de modèles et d'étalement vers RLS           | [`phase-3.md`](./phase-3.md) |
| 4   | Basculer les mutations d'objectifs compatibles et borner les exceptions | [`phase-4.md`](./phase-4.md) |

## Resources

| Source                                                                          | Verified                                                                                                                   |
| ------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| https://supabase.com/docs/guides/database/database-advisors                     | L'alerte `0029` est une alerte de sécurité sur l'exécution de fonctions `SECURITY DEFINER`, pas une alerte de performance. |
| https://supabase.com/docs/guides/database/functions#security-definer-vs-invoker | Supabase recommande `SECURITY INVOKER`; un definer nécessaire doit garder un `search_path` vide.                           |
| https://supabase.com/docs/guides/database/functions#function-privileges         | Les droits `EXECUTE` doivent être révoqués par défaut puis accordés explicitement.                                         |
| https://supabase.com/docs/guides/database/postgres/row-level-security           | RLS et `(SELECT auth.uid())` fournissent l'isolation utilisateur déjà utilisée par les tables concernées.                  |

## Decisions

| Decision                                                              | Why                                                                                                                                                           |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Conserver le client Supabase authentifié par JWT                      | Passer les données utilisateur au `service_role` contournerait RLS et contredirait ADR-0006/0013/0014.                                                        |
| Modifier les attributs et ACL des fonctions sans réécrire leurs corps | `ALTER FUNCTION ... SECURITY INVOKER` est le plus petit changement qui réactive RLS sans toucher à l'atomicité ni aux signatures.                             |
| Révoquer l'accès direct à `apply_savings_goal_plan`                   | Le backend courant appelle uniquement `apply_savings_goal_plan_with_destinations`; l'ancienne fonction reste un helper indirect.                              |
| Conserver 5 fonctions en `SECURITY DEFINER`                           | Quatre wrappers appellent des helpers internes; la réconciliation lit le jour de paie autoritaire dans `auth.users`, inaccessible sous RLS.                   |
| Rendre le DML `service_role` explicite sur les retraits planifiés     | Un reset frais prouve que la table créée tardivement n'hérite pas du contrat admin attendu; aucun droit supplémentaire n'est accordé aux rôles API.           |
