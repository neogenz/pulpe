---

## 🚀 Démarrage rapide

### 1. Cloner le repo

```bash
git clone https://github.com/<ton-utilisateur>/<ton-repo>.git
cd pulpe-workspace
```

### 2. Installer les dépendances

```bash
pnpm install
# ou npm install / bun install selon ton gestionnaire
```

### 3. Lancer le backend

```bash
cd backend-nest
bun run start:dev
# ou npm run start:dev
```

### 4. Lancer le frontend

```bash
cd frontend
ng serve
# ou npm run start
```

---

## 🛠️ Fonctionnalités principales

### Backend (NestJS)

- Authentification JWT via Supabase
- Gestion des budgets, transactions, utilisateurs
- Validation Zod, logging structuré, gestion d’erreurs globale
- Documentation Swagger : [http://localhost:3000/api/docs](http://localhost:3000/api/docs)

### Frontend (Angular 20+)

- Architecture feature-based, composants standalone, Angular Signals
- UI Material & Tailwind, responsive, dark mode
- Auth, onboarding, gestion des budgets mensuels, templates de budget
- Tests unitaires (Vitest) & e2e (Playwright)

### Shared

- Types TypeScript et schémas Zod partagés entre backend et frontend

---

## 🧪 Tests

- **Unitaires** :
  - Backend : `bun test` ou `npm run test` dans `backend-nest`
  - Frontend : `pnpm test:vitest` dans `frontend`
- **End-to-end** :
  - Frontend : `pnpm test:e2e` (Playwright)

---

## 📁 Environnements & secrets

- Les variables sensibles (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, etc.) sont à placer dans des fichiers `.env` (voir `.gitignore`).
- **Ne jamais versionner de clé secrète ou de token admin.**

---

## 📚 Documentation

- **Backend** : voir `backend-nest/README.md`
- **Frontend** : voir `frontend/README.md`
- **Types partagés** : voir `shared/`

---

## 📝 Stack technique

- **Backend** : NestJS, TypeScript, Supabase, Zod, Pino, Bun
- **Frontend** : Angular 20+, Angular Material, Tailwind CSS, Signals, Playwright, Vitest
- **Partagé** : TypeScript, Zod

---

## 🤝 Contribuer

1. Fork le repo
2. Crée une branche (`git checkout -b feature/ma-feature`)
3. Commit tes changements (`git commit -am 'feat: nouvelle feature'`)
4. Push la branche (`git push origin feature/ma-feature`)
5. Ouvre une Pull Request

---

## 📄 Licence

MIT
