# Pulpe

<!-- impeccable:product-schema 1 -->

## Platform

adaptive

## Users

Pulpe s'adresse aux personnes en Suisse et en France qui sont stressées par leur budget tout en aimant rester organisées. Elles veulent comprendre où part leur argent, décider ce qu'elles en font et anticiper leurs finances ou leurs projets financiers sans devenir expertes en comptabilité.

Elles utilisent Pulpe pour des vérifications rapides au quotidien et pour des sessions de planification plus approfondies à l'échelle du mois ou de l'année.

## Product Purpose

Pulpe aide à organiser l'avenir financier plutôt qu'à analyser uniquement le passé. Le produit permet de préparer son année, de transformer ses intentions en budgets mensuels et de savoir à tout moment ce qui reste disponible, ce qui peut être épargné et si un projet futur tient dans le budget.

Le succès est un sentiment concret de clarté et de soulagement : l'utilisateur voit venir ses dépenses, comprend ses choix et peut agir avant qu'un problème n'arrive.

## Positioning

Pulpe est un outil de planification budgétaire prospective. Son mécanisme distinctif est un plan annuel construit à partir de modèles mensuels réutilisables, puis confronté progressivement aux dépenses réelles. Là où les outils de suivi racontent surtout ce qui s'est déjà passé, Pulpe montre ce qui arrive et aide à décider en avance.

## Operating Context

- L'application authentifiée existe sur le web avec Angular, sur iOS avec SwiftUI et sur Android avec Expo/React Native.
- Le landing Next.js présente le produit, ses bénéfices, ses plateformes et ses preuves.
- Ces surfaces partagent la même vérité produit et le même vocabulaire, tout en respectant les conventions propres à chaque plateforme.
- L'interface est en français et utilise toujours le tutoiement.
- Les montants sont principalement exprimés en CHF ou en EUR.

## Capabilities and Constraints

- Planification annuelle à partir de budgets mensuels.
- Jusqu'à cinq modèles mensuels réutilisables par utilisateur, dont un peut servir de modèle par défaut.
- Distinction entre les prévisions et les transactions réelles, avec report du solde entre les mois.
- Objectifs d'épargne et planification de projets financiers futurs.
- Saisie manuelle des transactions ; aucune synchronisation bancaire.
- Conversion CHF/EUR avec conservation du taux utilisé au moment de la saisie.
- Les montants financiers sont chiffrés avant leur écriture en base de données.
- Les règles de calcul doivent rester cohérentes entre les implémentations TypeScript et Swift.

Vocabulaire utilisateur durable :

- `budget_line` / `budgetLines` : « prévision » ; `fixed` : « Mensuel » ; `one_off` : « Ponctuel ». Ces termes décrivent la cadence, pas la provenance : l'interface distingue « Issu du modèle » (`templateLineId` présent) de « Ajouté à ce budget ».
- `transaction` ne se traduit jamais tel quel : « Réel » quand c'est l'agrégat qui fait face à « Prévu », « Mouvements » quand c'est une collection, la nature (« dépense », « revenu », « épargne ») ou un verbe quand c'est un objet seul. Le verbe porte le temps, le nom porte la nature : on **prévoit** une dépense, on **note** une dépense.
- `income` : « Revenu » ; `expense` : « Dépense » ; `saving` : « Épargne ».
- `checked` : « Pointé » ; `unchecked` : « À pointer ».
- Libellés de référence : « Disponible à dépenser », « Épargne prévue », « Fréquence ».

## Brand Commitments

Pulpe doit rester chaleureux, clair et ancré dans le quotidien. La marque vend du soulagement face au stress budgétaire, pas un nouvel outil complexe à apprendre. Elle s'exprime avec des phrases courtes, un vocabulaire courant et aucun jargon financier inutile.

Le ton encourage sans juger ni culpabiliser. Une erreur explique ce qui s'est passé et propose une prochaine étape. Les quatre engagements émotionnels durables sont le soulagement, la clarté, le contrôle et la légèreté.

## Evidence on Hand

Trois témoignages authentiques sont publiés dans [`landing/components/sections/Testimonials.tsx`](landing/components/sections/Testimonials.tsx) :

- Ismaël S., utilisateur depuis novembre 2025 : moins de stress et meilleure anticipation des dépenses imprévues.
- Sylvie G., utilisatrice depuis mai 2026 : compréhension immédiate de l'état de son budget.
- Julie D., utilisatrice depuis décembre 2025 : planification des vacances sur l'année et validation de leur faisabilité.

Aucun autre témoignage, client, benchmark ou résultat commercial ne doit être inventé.

## Product Principles

1. **L'avenir avant le rétroviseur** — aider à anticiper et décider avant de résumer le passé.
2. **La clarté avant l'exhaustivité** — montrer l'information utile au bon moment sans recréer un tableur.
3. **Le soulagement avant la pression** — réduire le stress budgétaire sans jugement, culpabilisation ou gamification.
4. **Le contrôle reste à l'utilisateur** — Pulpe éclaire les choix et leurs conséquences sans décider à sa place.
5. **Une vérité produit, des expériences natives** — conserver les mêmes règles et le même vocabulaire sur le web, iOS et Android, avec une interface adaptée à chaque plateforme.

## Accessibility & Inclusion

- WCAG AA minimum sur le web.
- Dynamic Type et cibles tactiles de 44 pt minimum sur iOS.
- Cibles tactiles accessibles et prise en charge des réglages système sur Android.
- Réduction des animations lorsque le système le demande.
- Aucun état ou concept financier communiqué par la couleur seule.
