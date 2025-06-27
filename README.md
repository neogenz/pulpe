# Pulpe Workspace

Pulpe est une application full-stack de gestion de budgets. Ce monorepo est géré avec `pnpm` et contient :

-   `backend-nest/`: Une API robuste avec NestJS.
-   `frontend/`: Une application moderne avec Angular 20.
-   `shared/`: Un package de types et schémas partagés (Zod).

## Stack Technique

-   **Monorepo**: `pnpm`
-   **Backend**: NestJS, Bun, Supabase, Zod
-   **Frontend**: Angular 20+, Signals, Standalone Components, Tailwind CSS, Angular Material, Vitest, Playwright
-   **Partagé**: TypeScript, Zod

## Prérequis

-   Node.js (LTS)
-   `pnpm`
-   `bun`

## Mise en Route

1.  **Cloner le dépôt**
    ```bash
    git clone <votre-url-de-repo>
    cd pulpe-workspace
    ```

2.  **Installer les dépendances**
    Depuis la racine du projet :
    ```bash
    pnpm install
    ```

3.  **Configurer l'environnement**
    Copiez `backend-nest/.env.example` vers `backend-nest/.env` et renseignez les variables d'environnement sensibles (par exemple, les clés d'API privées).

4.  **Lancer les applications**

    ```bash
    # Lancer le backend (API NestJS)
    pnpm --filter backend-nest dev

    # Lancer le frontend (App Angular)
    pnpm --filter frontend start
    ```

## Commandes Utiles

Les commandes suivantes sont à lancer depuis la racine du projet.

| Commande                       | Description                                          |
| ------------------------------ | ---------------------------------------------------- |
| `pnpm --filter backend-nest dev`   | Démarre le serveur de développement du backend.      |
| `pnpm --filter backend-nest build` | Build le backend pour la production.               |
| `pnpm --filter backend-nest test`  | Lance les tests unitaires du backend.              |
| `pnpm --filter frontend start`     | Démarre le serveur de développement du frontend.     |
| `pnpm --filter frontend build`     | Build le frontend pour la production.              |
| `pnpm --filter frontend test`      | Lance les tests unitaires du frontend (Vitest).      |
| `pnpm --filter frontend test:e2e`  | Lance les tests end-to-end du frontend (Playwright). |
| `pnpm --filter frontend lint`      | Analyse le code du frontend avec ESLint.             |


## Licence

MIT