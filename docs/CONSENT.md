# Consentement à l'inscription

> Décision produit sur la façon dont l'utilisateur accepte les CGU et est informé de la
> politique de confidentialité, à la création de compte. Web + iOS.

**Décision (2026-07-24)** : consentement implicite (*sign-in wrap*), pas de case à cocher.
Les deux documents portent des **verbes distincts**.

## Formulation

> En créant ton compte, tu **acceptes** les Conditions d'Utilisation **et confirmes avoir
> pris connaissance** de la Politique de Confidentialité.

Contraintes de rendu : bloc visible dans le même écran que le bouton de création (sans
scroll), deux liens distincts vers deux documents consultables **avant** la création du
compte.

Surfaces : `feature/auth/signup` (web), `Onboarding/Steps/WelcomeStep` et
`RegistrationStep` (iOS, via `AppURLs.legalDisclosure`). `LoginView.termsFooter` est un
simple pied de liens, sans énoncé d'acceptation — hors périmètre.

## Analytics identifiées

L'acceptation des CGU ne vaut pas accord distinct à l'analytics. Pulpe active par défaut
les diagnostics PostHog sur la base produit documentée de l'intérêt légitime et expose,
sur web et iOS, un réglage local immédiatement révocable :
**Paramètres → Données de diagnostic → Partager les diagnostics**.

La désactivation arrête les captures et le replay, efface l'association locale à
l'identité PostHog et conserve le choix sur l'appareil. La réactivation associe de nouveau
la session authentifiée à l'UUID Supabase, l'email et le prénom utiles au support.
Ce choix d'implémentation n'est pas une conclusion de conformité juridique et doit être
revu par un professionnel si le contexte commercial ou la collecte évolue.

## Pourquoi deux verbes

On **accepte** un contrat (CGU) ; on **prend connaissance** d'une information
(art. 13 RGPD). Les fusionner sous un seul « tu acceptes » fabrique une acceptation
groupée, ce que visent l'art. 7(2) RGPD (une demande de consentement noyée dans une
déclaration plus large doit être « présentée sous une forme qui la distingue clairement »)
et les [lignes directrices 2/2019 du CEPD, §20](https://www.edpb.europa.eu/sites/default/files/files/file1/edpb_guidelines-art_6-1-b-adopted_after_public_consultation_fr.pdf),
qui séparent explicitement l'acceptation de conditions de service du consentement au sens
de l'art. 6-1-a. Une case unique « j'accepte les CGU **et** la politique de
confidentialité » serait donc un recul, pas une protection.

## Pourquoi pas de case à cocher

Le formalisme « case non pré-cochée » relève du consentement art. 6-1-a, pas de
l'acceptation contractuelle : aucune source ne l'impose pour des CGU.

Surtout, la case qui existait avant (`acceptTerms: Validators.requiredTrue`) était un
**gate de formulaire côté client** : rien n'était persisté, horodaté ni versionné — aucune
colonne d'acceptation n'existe en base. Sa valeur probatoire était donc identique à celle
du sign-in wrap : nulle. La retirer ne fait perdre aucune protection réelle, et supprime
une friction mesurable dans un tunnel d'inscription dont la conversion est le problème
produit n°1.

## Ce qui compte vraiment : la preuve

En droit français, la charge de démontrer la connaissance et l'acceptation des conditions
pèse sur le professionnel (art. 1119 al. 1 et 1353 C. civ.). La seule décision française
identifiée déclarant des CGU inopposables — [CA Paris, 6 janv. 2021, n° 20/08857](https://www.legalis.net/jurisprudences/cour-dappel-de-paris-pole-5-ch-4-arret-du-6-janvier-2021/) —
ne condamne pas le mécanisme (le parcours décrit était un sign-in wrap) mais l'absence de
preuve datée du parcours effectivement servi à l'époque.

**Le levier n'est donc pas le widget, c'est la traçabilité serveur** : horodatage à la
création de compte, version des documents servis, empreinte du contenu, surface d'origine,
en append-only. Cet élément n'existe pas aujourd'hui — et n'existait pas davantage avec la
case.

## Limites connues

- Aucune décision B2C française sur le sign-in wrap : la jurisprudence disponible est B2B
  et porte sur des clauses attributives de juridiction, au formalisme renforcé propre.
  L'absence d'interdiction n'est pas une validation.
- Droit suisse non couvert, alors que la base utilisateurs est CH + FR : la règle de
  l'insolite (*Ungewöhnlichkeitsregel*) écarte certaines clauses de conditions générales
  reprises globalement.
- Décision assumée par le porteur du produit, sans revue juridique professionnelle.

## Conditions de réexamen

Repasser à une acceptation explicite et tracée si l'un de ces éléments apparaît :

| Déclencheur | Raison |
| --- | --- |
| Abonnement payant facturé en direct (hors achat intégré) | Contrat à titre onéreux, exigences consommateur renforcées |
| Clause à saillance renforcée (juridiction, limitation de responsabilité, tacite reconduction `L. 215-1`) | Formalisme d'opposabilité spécifique |
| Clientèle professionnelle | Régime contractuel distinct |
| Une revue juridique impose le consentement préalable pour l'analytics identifiée | Remplacer l'opt-out local par un acte dédié, traçable et révocable, distinct de la création de compte |
