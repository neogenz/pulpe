---
status: blocked
---

# État des soumissions aux annuaires

Ce document suit la phase 6. Il ne décrit pas ce que le code fait : il décrit
ce qui reste à faire par un humain, et pourquoi personne d'autre ne peut le
faire à sa place.

## Ce qui est livré dans le dépôt

| Élément                              | Chemin                                     |
| ------------------------------------ | ------------------------------------------ |
| Manifeste du plugin Claude Code      | `plugins/pulpe/.claude-plugin/plugin.json` |
| Déclaration du serveur MCP distant   | `plugins/pulpe/.mcp.json`                  |
| Catalogue du dépôt marketplace       | `.claude-plugin/marketplace.json`          |
| Canal agent dans les CGU (4 langues) | `legal.terms.aiAssistants`                 |
| Canal agent dans la confidentialité  | `legal.privacy.aiAssistants` (phase 2)     |

Le plugin ne déclare aucun serveur stdio local et aucune variable à renseigner :
l'utilisateur installe, Pulpe demande l'autorisation, c'est tout.

Les trois manifestes ont été vérifiés en les installant réellement :
`claude plugin marketplace add <dépôt>` puis `claude plugin install pulpe@pulpe`
aboutissent, et `claude plugin details pulpe@pulpe` liste bien un serveur MCP et
rien d'autre. L'installation a ensuite été retirée du poste.

Le manifeste et l'entrée plugin du marketplace ne portent aucune version. Sur
cette source Git, Claude Code utilise le SHA du commit pour détecter chaque
mise à jour ; la version à la racine du marketplace ne versionne que le catalogue.

## Ce qui est bloqué, et par quoi

Les trois soumissions supposent toutes que le serveur MCP répond sur son URL de
production, `https://api.pulpe.app/mcp`. Aucune ne peut donc être tentée avant
un déploiement en production.

| Étape                                        | Bloquant                                                             |
| -------------------------------------------- | -------------------------------------------------------------------- |
| Déployer le connecteur en production         | Décision de mise en production, hors périmètre de l'implémentation   |
| Vérifier l'identité développeur chez OpenAI  | Pièce d'identité, session humaine sur la plateforme OpenAI           |
| Ouvrir une organisation Team chez Anthropic  | Paiement par carte, plan payant                                      |
| Soumettre au Plugin Directory OpenAI         | Formulaire dans une session authentifiée                             |
| Soumettre au Connectors Directory Anthropic  | Portail dans les réglages d'organisation, sept déclarations à signer |
| Installer depuis un poste vierge et vérifier | Manifestes validés en local, reste le dépôt marketplace à publier    |

## Compte de revue

Le générateur de données de démonstration
(`backend-nest/src/modules/demo/application/generate-demo-data.use-case.ts`)
crée déjà des modèles, des budgets, des prévisions, des mouvements et des
objectifs d'épargne. Il ne convient pas tel quel à un relecteur d'annuaire : une
session de démonstration est limitée en débit et purgée par âge, alors qu'un
relecteur revient plusieurs jours de suite.

Le compte de revue doit donc être un compte ordinaire, créé une fois en
production, peuplé avec le même contenu, et dont le parcours complet passe sans
MFA, sans SMS et sans confirmation par e-mail — y compris la saisie du code sur
la page de consentement.

À renseigner au moment de la soumission :

- [ ] Adresse et mot de passe du compte de revue
- [ ] Code PIN à saisir sur la page de consentement
- [ ] Instructions d'accès, chaque lien et chaque étape écrite
- [ ] Résultat de chaque outil exécuté sur ce compte, consigné

## Guide grand public

Livré sur `/support/connecter-un-assistant` dans les quatre langues de la
landing. Le guide couvre ChatGPT, Claude et Claude Code, le choix entre lecture
seule et lecture-écriture, puis la coupure immédiate de l'accès depuis Pulpe.
