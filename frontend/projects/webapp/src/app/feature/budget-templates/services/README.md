# Services Budget Templates

## TransactionFormService

Service centralisé pour la gestion des formulaires de transactions.

### Fonctionnalités

- **Création de formulaires typés** : Gestion stricte des types avec TypeScript
- **Validation métier** : Validateurs personnalisés pour les transactions
- **Gestion des FormArray** : Ajout/suppression de transactions dynamiques
- **Réutilisabilité** : Service injectable utilisable dans différents composants

### Utilisation

```typescript
import { TransactionFormService, TransactionFormData } from './transaction-form';

@Component({...})
export class MyComponent {
  #transactionFormService = inject(TransactionFormService);

  transactionsForm: FormArray<FormGroup<TransactionFormControls>>;

  constructor() {
    this.transactionsForm = this.#transactionFormService.createTransactionsFormArray([]);
  }

  addTransaction(): void {
    this.#transactionFormService.addTransactionToFormArray(this.transactionsForm);
  }

  isValid(): boolean {
    return this.#transactionFormService.validateTransactionsForm(this.transactionsForm);
  }
}
```

### Types exportés

- `TransactionType` : Union type pour les types de transactions
- `TransactionFormData` : Interface pour les données de transaction
- `TransactionFormControls` : Interface pour les contrôles de formulaire
- `TRANSACTION_VALIDATORS` : Validateurs préconfigurés
- `TRANSACTION_TYPES` : Types de transactions avec labels

### Bonnes pratiques appliquées

✅ **Service pattern** : Logique métier séparée des composants  
✅ **Types stricts** : Pas d'`any`, types explicites partout  
✅ **Injection moderne** : Utilisation d'`inject()` au lieu du constructeur  
✅ **Validation centralisée** : Règles métier dans le service  
✅ **Immutabilité** : Constantes exportées pour la réutilisation

### Performance

- Service singleton (`providedIn: 'root'`)
- Validation optimisée avec des méthodes pures
- Gestion mémoire automatique avec Angular DI
