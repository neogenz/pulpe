# Pulpe API

API NestJS 11 exécutée avec Bun. Supabase fournit PostgreSQL, Auth et RLS ; les contrats HTTP
partagés viennent de `pulpe-shared`; les montants financiers sont chiffrés en AES-256-GCM.

## Développement local

Depuis la racine, installer les dépendances avec `pnpm install`. Puis :

```bash
cd backend-nest
cp .env.example .env.local
bun run supabase:start:local
supabase status -o env
openssl rand -hex 32
```

Reporter `API_URL`, `ANON_KEY` (ou `PUBLISHABLE_KEY`) et `SERVICE_ROLE_KEY` (ou `SECRET_KEY`)
dans les trois variables `SUPABASE_*` de `.env.local`, puis remplacer
`ENCRYPTION_MASTER_KEY` par la sortie OpenSSL. Démarrer ensuite l'API :

```bash
bun run dev:local
```

L'API répond sous `http://localhost:3000/api/v1`, Swagger sous
`http://localhost:3000/docs`, et le health check sous `http://localhost:3000/health`.

## Commandes

```bash
bun run build
bun test
bun test path/to/file.spec.ts
bun run test:integration
bun run quality
bun run lint:arch
bun run generate-types:local
```

Après une migration, appliquer la migration locale puis régénérer
`src/types/database.types.ts`. Ne jamais lancer de reset ou de push forcé sur une base liée.

## Architecture

Les dépendances pointent de `infrastructure → application → domain`. Les contrôleurs exposent
des DTOs Zod, les use cases dépendent de ports et les repositories possèdent la frontière de
persistance et de chiffrement.

Swagger est l'inventaire des endpoints ; ne maintenir aucun catalogue parallèle dans ce
README.

## Références

- [Architecture](docs/ARCHITECTURE.md)
- [Base de données](docs/DATABASE.md)
- [Logging](docs/LOGGING.md)
- [ADRs](docs/adr/README.md)
- [Chiffrement](../docs/ENCRYPTION.md)
