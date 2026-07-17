---
status: done
---

# Instruction: Linear ops — PUL-138 résidu, PUL-186 décision de copy

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete

```txt
(aucun fichier repo — opérations Linear via MCP)
```

## Tasks to do

### `1)` Rouvrir PUL-138 avec la liste explicite du résidu

> L'issue est Done alors que ~13/20 items sont non shippés, contre la reco de son propre audit.

1. Commenter PUL-138 avec la liste vérifiée à HEAD (review 2026-07-16): **restants** ADD-8, ADD-10, ADD-11, #11, #12, #13, #14, #15, #16, #17, #18, **#19 (OWASP A07 — à prioriser)**, #21, #22, G1 (partiel), G2 (test ordre manquant); **shippés par #508**: G3 + dedup signOut + init-retry + public-guard.spec; **skip/defer actés**: #10, M1, M2.
2. Repasser le statut de PUL-138 à Todo (ou Backlog si l'utilisateur préfère — demander en une ligne au moment de l'op).

### `2)` Documenter la décision de copy PUL-186 (CA3)

1. Commenter PUL-186: copy shippée = header « Nouveau dans Pulpe » + « Version X.Y.Z » et CTA « C'est parti » (vs « Nouveautés de la version X.Y.Z » / « Compris » spécifiés); champ `title` du payload conservé pour compat binaire des apps déployées, non rendu côté iOS. Décision actée, pas de changement de code prévu.

## Test acceptance criteria

| Task | Acceptance criteria |
| ---- | ------------------- |
| 1 | PUL-138 n'est plus `Done`, son dernier commentaire liste item par item le résidu/shippé/défert, #19 marqué sécurité |
| 2 | PUL-186 porte un commentaire actant la déviation de copy et la conservation du champ `title` |
