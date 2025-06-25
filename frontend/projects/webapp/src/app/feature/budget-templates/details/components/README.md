# Components Budget Templates - Details

## Architecture des composants

### EditTransactionsDialog (Composant principal)
**Responsabilité** : Orchestration et état global du formulaire de transactions

✅ **Bonnes pratiques appliquées :**
- Export par défaut pour le lazy loading
- Service pattern avec injection moderne (`inject()`)
- Signals pour la gestion d'état réactive
- OnPush change detection strategy
- Validation centralisée via service

**Utilisation :**
```typescript
const dialogRef = this.dialog.open(EditTransactionsDialog, {
  data: { transactions: [...], templateName: 'Mon modèle' }
});
```

### TransactionFormRow (Composant réutilisable)
**Responsabilité** : Affichage et interaction d'une ligne de transaction

✅ **Bonnes pratiques appliquées :**
- Composant "dumb" / présentation pure
- Inputs/Outputs typés avec `input()` et `output()`
- Computed signals pour les contrôles de formulaire
- Accessibilité avec aria-labels dynamiques
- Layout responsive avec Tailwind Grid

**Utilisation :**
```html
<pulpe-transaction-form-row
  [formGroup]="transactionFormGroup"
  [rowIndex]="0"
  [canRemove]="true"
  (removeClicked)="onRemove()"
/>
```

### TransactionsTable (Composant d'affichage)
**Responsabilité** : Affichage en lecture seule des transactions

## Pattern appliqué : Smart/Dumb Components

### Smart Component: `EditTransactionsDialog`
- ✅ Gère l'état et la logique métier
- ✅ Inject des services
- ✅ Orchestration des actions (ajout/suppression)
- ✅ Validation et sauvegarde

### Dumb Component: `TransactionFormRow`
- ✅ Reçoit les données via `@Input()`
- ✅ Émet les événements via `@Output()`
- ✅ Aucune injection de service
- ✅ Pure présentation

## Avantages de cette architecture

### 🔄 **Réutilisabilité**
- `TransactionFormRow` peut être utilisé dans d'autres contextes
- Logic métier centralisée dans `TransactionFormService`
- Patterns cohérents dans toute l'application

### 🚀 **Performance**
- OnPush partout = moins de change detection cycles
- Signals pour les mises à jour optimisées
- Track by functions pour les listes dynamiques

### 🧪 **Testabilité**
- Composants dumb facilement testables en isolation
- Logic métier dans des services purs
- Interfaces strictes entre composants

### 🛠️ **Maintenabilité**
- Séparation claire des responsabilités
- Code plus petit et focalisé
- Types stricts partout (pas d'`any`)

## Flux de données

```
EditTransactionsDialog (Smart)
    ↓ [formGroup], [rowIndex], [canRemove]
    ↓ (removeClicked)
TransactionFormRow (Dumb)
    ↓ [formControl]
    ↓ (input changes)
Angular Forms (Reactive)
```

## Next Steps

1. **Tests unitaires** : Ajouter des tests pour `TransactionFormRow`
2. **Storybook** : Documenter le composant dans Storybook
3. **Composant Select** : Extraire le select de type en composant réutilisable
4. **Validation UX** : Ajouter des indicateurs visuels de validation 