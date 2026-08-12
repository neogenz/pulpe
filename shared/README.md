# pulpe-shared

Package ESM local partagé par Angular et NestJS. Il n'est pas publié.

## Contenu

- [`schemas.ts`](schemas.ts) : contrats HTTP Zod et types inférés ;
- [`src/calculators/`](src/calculators/) : formules métier pures ;
- [`src/currency.ts`](src/currency.ts) et
  [`src/currency-format.ts`](src/currency-format.ts) : devises, conversion et formatage ;
- [`src/feature-flags.ts`](src/feature-flags.ts) : flags et contrat analytics ;
- [`index.ts`](index.ts) : unique surface publique du package.

Les schémas spécifiques aux RPC et à la persistance restent dans le backend. Les imports
consommateurs utilisent uniquement `pulpe-shared`, jamais un sous-chemin.

```typescript
import { budgetSchema, type Budget } from 'pulpe-shared';
```

## Développement

```bash
pnpm build
pnpm test
pnpm test:watch
pnpm format:check
```

Les imports relatifs TypeScript conservent l'extension `.js`, requise par la sortie ESM
NodeNext. Après une modification locale, `pnpm build:shared` à la racine reconstruit
`dist/esm` pour les consommateurs lancés hors Turbo.

Toute modification sous `src/calculators/` doit être reflétée dans
`ios/Pulpe/Domain/Formulas/`, tests compris.
