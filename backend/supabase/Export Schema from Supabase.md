<img src="https://r2cdn.perplexity.ai/pplx-full-logo-primary-dark%402x.png" class="logo" width="120"/>

# <q>Exportez régulièrement votre schéma depuis Supabase vers vos fichiers de migration pour maintenir la synchronisation</q> comment faire cela ?

Pour exporter régulièrement votre schéma depuis Supabase vers vos fichiers de migration, vous pouvez utiliser la CLI Supabase avec la commande `db pull`. Voici comment procéder :

## Installation et configuration initiale

D'abord, installez la CLI Supabase dans votre projet[^1] :

```bash
npm install supabase --save-dev
```

Ensuite, liez votre projet local à votre base de données Supabase distante :

```bash
supabase link
```


## Exportation du schéma avec `db pull`

La commande principale pour exporter votre schéma est `supabase db pull`[^4]. Cette commande récupère les changements de schéma depuis votre base de données distante et crée un nouveau fichier de migration dans le répertoire `supabase/migrations`.

```bash
supabase db pull
```

Vous pouvez également spécifier un nom pour votre migration :

```bash
supabase db pull nom_de_la_migration
```


## Gestion des changements effectués dans le dashboard

Lorsque vous faites des modifications directement dans le dashboard Supabase, vous devez les synchroniser avec votre projet local[^3] :

1. **Récupérer les changements** :
```bash
supabase db pull
```

2. **Ajouter à l'historique des migrations** : La commande vous demandera si vous souhaitez ajouter cette migration à l'historique de la base de données distante. Sélectionnez "yes" si vous synchronisez simplement depuis le distant.
3. **Vérifier l'état des migrations** :
```bash
supabase migration list
```


## Workflow recommandé avec Prisma ORM

Étant donné que vous utilisez Prisma ORM avec Supabase[^11], voici un workflow efficace :

1. **Faire des changements dans le dashboard** pour le prototypage rapide
2. **Exporter le schéma** :
```bash
supabase db pull schema_update
```

3. **Synchroniser avec Prisma** en mettant à jour votre `schema.prisma`
4. **Générer les types Prisma** :
```bash
npx prisma generate
```


## Automatisation avec des scripts npm

Vous pouvez ajouter des scripts dans votre `package.json` pour faciliter ces opérations[^1] :

```json
{
  "scripts": {
    "db:pull": "supabase db pull",
    "db:migrate:new": "supabase migration new",
    "db:status": "supabase migration list"
  }
}
```


## Gestion des conflits et réparations

Si votre historique de migrations local et distant se désynchronise, utilisez la commande `migration repair`[^4] :

```bash
supabase migration repair 20231018080000 --status applied
```

Cette approche vous permet de maintenir une synchronisation efficace entre votre dashboard Supabase et vos fichiers de migration locaux, tout en conservant un contrôle de version approprié pour votre équipe de développement.

<div style="text-align: center">⁂</div>

[^1]: https://vueschool.io/articles/vuejs-tutorials/how-to-create-supabase-database-migration-files-in-vue-js/

[^2]: https://supabase.com/docs/guides/local-development/declarative-database-schemas

[^3]: https://www.petrsiegl.com/blog/how-to-sync-local-and-remote-db-in-supabase

[^4]: https://supabase.com/docs/reference/cli/introduction

[^5]: https://supabase.com/docs/guides/platform/migrating-within-supabase

[^6]: https://supabase.com/docs/guides/deployment/database-migrations

[^7]: https://supabase.com/docs/guides/database/overview

[^8]: https://www.reddit.com/r/Supabase/comments/1iiq3r1/export_database_structure_script/

[^9]: https://github.com/orgs/supabase/discussions/773

[^10]: https://github.com/orgs/supabase/discussions/1266

[^11]: programming.backend_technologies

