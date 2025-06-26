# Animations Lottie

Ce dossier contient les fichiers d'animation Lottie utilisés dans l'application.

## 🚀 **OPTIMISATION PERFORMANCE**

### ⚠️ **Tailles actuelles** :

- `welcome-animation.json`: **80KB** ✅ (OPTIMISÉ)
- `welcome-v1.json`: **80KB** ✅ (OPTIMAL)
- `welcome-v2.json`: **240KB** ⚠️ (ACCEPTABLE)

### 🎯 **Recommandations de performance** :

1. **Utiliser welcome-v1.json** (80KB) comme fichier principal
2. **Taille max recommandée** : < 500KB ([source LottieFiles](https://lottiefiles.com/features/optimize-lottie))
3. **Optimiser via** : [LottieFiles Optimizer](https://lottiefiles.com/features/optimize-lottie)

### 🔧 **Commande d'optimisation rapide** :

```bash
# Remplacer par la version optimisée
cp variations/welcome-v1.json welcome-animation.json
```

### ⚠️ **IMPORTANT - Formatage automatique** :

**NE PAS formater les fichiers JSON Lottie !**

- ✅ Fichiers configurés pour ignorer Prettier (`.prettierignore`)
- ✅ VSCode configuré pour ne pas auto-formater ces fichiers
- ❌ **Éviter "Format on Save"** sur les fichiers `.json` dans `/lottie/`
- 📏 **Fichiers minifiés** = Performance optimale (1 ligne vs 1000+ lignes)

## 📁 Structure recommandée

```
assets/lottie/
├── welcome-animation.json     (animation active)
├── variations/
│   ├── welcome-v1.json        (première version)
│   ├── welcome-v2.json        (deuxième version)
│   ├── welcome-v3.json        (troisième version)
│   └── ...
└── README.md
```

## 🎯 Comment ajouter vos animations

1. **Copiez vos fichiers .json** dans le dossier `variations/`
2. **Renommez l'animation active** : copiez l'animation choisie vers `welcome-animation.json`
3. **L'application utilise automatiquement** `welcome-animation.json`

## 🔄 Pour tester rapidement plusieurs animations

### Option 1 : Remplacer le fichier actif

```bash
# Remplacer l'animation active par la version 2
cp variations/welcome-v2.json welcome-animation.json
```

### Option 2 : Modifier temporairement le code

Dans `welcome.ts`, changez le chemin :

```typescript
readonly lottieOptions = signal<AnimationOptions>({
  path: '/assets/lottie/variations/welcome-v2.json',  // Testez différentes versions
  loop: true,
  autoplay: true,
});
```

## 📋 Types de fichiers supportés

- **✅ .json** : Format requis pour ngx-lottie
- **❌ .lottie** : À convertir en .json via [LottieFiles](https://lottiefiles.com/)

## 🚀 Options d'animation disponibles

```typescript
lottieOptions = signal<AnimationOptions>({
  path: "/assets/lottie/welcome-animation.json",
  loop: true, // Boucle infinie
  autoplay: true, // Démarrage automatique
  // speed: 1,          // Vitesse (1 = normale)
  // direction: 1,      // Direction (1 = normale, -1 = inverse)
});
```

## 🎨 Optimisation

- **Taille recommandée** : < 500KB par animation
- **Dimensions** : 200x200px ou ratio carré
- **Couleurs** : Préférez les couleurs compatibles avec votre thème

```

```
