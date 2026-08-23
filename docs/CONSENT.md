# Information affichée à l'inscription

> Note d'implémentation du parcours de création de compte web, iOS et Android. Ce document décrit
> le comportement actuel ; il ne constitue pas un avis juridique.

## Formulation actuelle

> En créant ton compte, tu **acceptes** les Conditions d'Utilisation **et confirmes avoir
> pris connaissance** de la Politique de Confidentialité.

Le bloc est visible sur le même écran que le bouton de création de compte. Les Conditions
d'Utilisation et la Politique de Confidentialité sont deux liens distincts, consultables
avant la création du compte.

Surfaces concernées :

- web : `feature/auth/signup`
- iOS : `Onboarding/Steps/WelcomeStep` et `RegistrationStep`, via
  `AppURLs.legalDisclosure`
- Android : `features/onboarding/steps/welcome-step` et `registration-step`, via
  `LegalConsent`

`LoginView.termsFooter` contient seulement des liens vers les documents légaux.

## Diagnostics identifiés

Les diagnostics PostHog sont activés par défaut. Un réglage local permet de les désactiver
immédiatement :

- web : **Paramètres → Données de diagnostic → Partager les diagnostics** ;
- iOS : **Préférences → Données et confidentialité → Partager les diagnostics** ;
- Android : **Préférences → Confidentialité → Partager les diagnostics**.

Quand le réglage est actif, la session authentifiée est associée à l'UUID Supabase. Web
et iOS peuvent aussi transmettre l'email et le prénom afin de relier un incident au
compte concerné. Android limite son identité PostHog à l'UUID et au statut early adopter :
aucun email ni prénom n'est envoyé par ce client.

La désactivation :

- arrête les nouvelles captures analytics et le replay ;
- efface l'association locale à l'identité PostHog ;
- conserve le choix sur l'appareil.

La réactivation associe de nouveau la session authentifiée. Les champs sensibles sont
exclus des captures par les configurations PostHog des trois clients ; la politique de
confidentialité décrit les catégories de données concernées.

## Revue

Cette note doit rester alignée avec le code, les textes affichés et la politique de
confidentialité. Toute évolution de la collecte, du modèle commercial ou des documents
légaux nécessite une revue dédiée avant publication.
