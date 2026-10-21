# Elastic : Générateur d'espacements et typographies fluides

**Elastic** est un utilitaire web léger et intuitif conçu pour créer des systèmes de design flexibles. Il permet de générer des tailles de police et des espacements qui s'adaptent harmonieusement à la largeur de l'écran, sans avoir recours à de multiples points de rupture (_breakpoints_).

Inspiré par la philosophie de [Utopia](https://utopia.fyi/), Elastic interpole les valeurs entre une taille minimale et une taille maximale, garantissant une expérience utilisateur fluide sur tous les appareils. Trois formats de sortie sont proposés : `clamp()`, `progress()` et `@function`.

---

## 🚀 Pourquoi choisir Elastic ?

Le "Fluid Design" permet d'éviter les sauts brusques de taille lors du redimensionnement d'une fenêtre.

- **Zéro Breakpoints** : Plus besoin de multiplier les Media Queries pour ajuster chaque titre ou marge.
- **Harmonie visuelle** : Les espacements et les textes évoluent proportionnellement.
- **Standard CSS** : Utilise des fonctions CSS modernes supportées par tous les navigateurs actuels.
- **Légèreté** : Génère un code CSS minimaliste et performant.

---

## 🛠️ Fonctionnalités clés

### 1. Polices Fluides

Créez des échelles typographiques qui passent d'une taille mobile (ex: 16px) à une taille desktop (ex: 20px) de manière linéaire et automatique.

### 2. Espacements Fluides

Générez des variables d'espacement (mousses, marges, gaps) cohérentes qui s'étirent ou se rétractent selon le viewport.

### 3. Aperçu en temps réel

Visualisez instantanément la courbe de fluidité grâce à un graphique dynamique intégré dans chaque ligne de configuration.

### 4. Export Express

Copiez en un clic le code généré :

- `theme.css` : Contient à la fois les définitions des variables de base (primitives) et les tokens de design prêts à l'emploi, dans le format choisi.

---

## 📖 Comment l'utiliser ?

1. **Configurez vos variables** :
   - Donnez un nom (slug) à votre variable (ex: `text-l`, `spacing-m`).
   - Saisissez la valeur minimale (pour les écrans de 360px).
   - Saisissez la valeur maximale (pour les écrans de 1280px).
2. **Visualisez** : Le graphique vous montre la progression de la valeur entre les deux bornes.
3. **Récupérez le code** : Le CSS est généré automatiquement dans le panneau en bas de page.
4. **Intégrez** : Copiez le contenu de `theme.css` dans votre projet et utilisez les variables dans vos composants :

   ```css
   .mon-titre {
     font-size: var(--text-l);
     margin-bottom: var(--spacing-m);
   }
   ```

---

## ⚙️ Détails techniques

- **Bornes du Viewport** : Les calculs sont basés sur une plage allant de **360px** (mobile) à **1280px** (desktop large).
- **Unités** : Le code généré convertit automatiquement les pixels en `rem` (base 16px) pour respecter les préférences d'accessibilité des utilisateurs.
- **Formats de sortie** : quelle que soit la méthode, la syntaxe d'usage reste `font-size: var(--text-m)`.
  - `clamp()` : fonctionne sur tous les navigateurs modernes, mais embarque des valeurs calculées (`0.9565rem + 0.2174vw`).
  - `progress()` : calcule une seule fois la progression du viewport (`--fluid`, de 0 à 1), puis chaque token interpole entre ses deux primitives. Aucun nombre magique, support navigateur récent.
  - `@function` : fonction CSS native `--fluid()`, la plus lisible, support encore limité.

---

## ✨ Crédits

Développé avec passion par **Alsacreations**.
Inspiré par le concept original de [Utopia.fyi](https://utopia.fyi/).

---

_Elastic vous aide à rendre le web plus souple, une ligne de code à la fois._
