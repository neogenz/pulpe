<!-- Challenge findings report skeleton. Fill each section verbatim, keep the header order. -->

My confidence level of correctness now: 85%

# Correctness (100%)
- Point 1 : un seul message de conflit, même clé et même texte dans les quatre langues, sur web, Android et iOS ; tests par plateforme (`account-picker-field.spec.ts`, `account-field.spec.tsx`, `AccountLinkTests`).
- Point 2 : « mouvement » remplace « saisie » dans l'aide du compte par défaut, quatre langues, trois plateformes.
- Point 3 : le sous-titre « Préférences » cite le compte par défaut seulement avec `net_worth` allumé, sur iOS (`PreferencesSubtitleTests`) et Android (parité ajoutée).
- Point 4 : flag éteint, aucune clé `accountId` dans les créations ni dans l'ajustement de réconciliation ; flag allumé, la clé est toujours présente, `null` compris. Tests métier des deux cas sur les trois plateformes. La règle est écrite dans `docs/BUSINESS_RULES.md`.
- Point 5 : chaque défaut corrigé a un test qui échouait avant (web, Android) ou un UITest d'audit (iOS, 35 exécutions vertes). Le label unique de la fortune nette iOS reste masqué quand les montants sont cachés : `sensitiveAmount` pose `accessibilityHidden` sur l'élément combiné.
- Point 6 : captures clair, sombre et grand texte sur les trois plateformes ; les agents ont lu `impeccable` et `make-interfaces-feel-better` avant la passe.
- Revue : `linkTitle` ne servait plus qu'à une garde redondante (`conflicts` est faux sans élément lié) ; retiré avec son helper et son test.

# Deal breakers
-

# Suggestions (enhancements only)
- Flag éteint après qu'un compte par défaut a été choisi : le serveur l'applique aux nouveaux mouvements sans que l'app le montre. Conséquence directe de la décision « pas de clé flag éteint » ; à garder en tête si le flag est éteint après un déploiement partiel.
- TalkBack n'a pas été parcouru en direct (machine trop chargée) ; l'annonce du message de conflit sur Android reste à écouter sur un appareil.
- La synthèse vocale du séparateur ’ des milliers n'est vérifiable que sur un vrai appareil, iOS comme Android.
- `statesAccount: Bool = true` dans la réconciliation iOS : seule une valeur par défaut pour les tests ; la rendre obligatoire forcerait chaque nouvel appelant à choisir.
