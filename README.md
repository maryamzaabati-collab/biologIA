# biologIA — registre de traçabilité

Projet 4 BUT Science des Données (Biologie / Laboratoires). Application web pour tracer l’origine et la qualité des **lots de données de référence** : machines, conditions de mesure, pseudonymisation, signalements, validation biologiste, cartes de contrôle, certificat, lignée et journal d’audit.

Aucun dossier patient réel n’est stocké ni interprété.

Fonctionne avec **Node.js 20+**. Sur Node 22, SQLite utilise le module intégré `node:sqlite` ; sur Node 20 (Replit), le module `better-sqlite3`.

## Lancer en local

```bash
cd backend
npm install
node start.js
```

Ouvrir [http://localhost:3000](http://localhost:3000).

Pour (re)charger machines, lots et signalements de démonstration :

```bash
cd backend
npm run seed
```

Comptes de démonstration (à ne pas réutiliser en production) : `samira` / `labo2026` (technicien), `amrani` / `labo2026` (biologiste).

Si `npm` n’est pas reconnu dans VS Code, installe Node 22 depuis [nodejs.org](https://nodejs.org), ferme l’éditeur, puis rouvre un terminal. Script d’aide : `sh outils/installer-node.sh` puis `sh outils/lancer.sh`.

## Publier sur Replit

1. Sur GitHub, vérifie que le dépôt `biologIA` contient bien les dossiers `frontend/` et `backend/` (pas un dépôt vide).
2. Va sur [replit.com](https://replit.com) → **Create Repl** → **Import from GitHub** → choisis `maryamzaabati-collab/biologIA`.
3. Si un ancien Repl importé est encore vide : **ne le réutilise pas**. Crée un **nouveau** Repl depuis GitHub (après que les fichiers soient sur GitHub).
4. Dans le **Shell** Replit (pas seulement le bouton Git → Pull, souvent bloqué) :
   ```bash
   git fetch origin main
   git reset --hard origin/main
   ```
   Puis **Run**. L’aperçu à droite (`….replit.dev`) se met à jour.
5. Le lien public `….replit.app` ne change **que** avec **Publish → Republish**. Run ne le met pas à jour.
6. Si Publish dit « failed to start » : dans Deployments, le **Build** doit être `npm install` et le **Run** `node backend/start.js` (déjà dans `.replit`). Republish après un `git pull` du dernier `main`.
7. Comptes démo : `samira` / `labo2026` et `amrani` / `labo2026`.

Si le Repl reste coincé (fichiers vides, Pull qui échoue) : crée un **nouveau** Repl → Import from GitHub → `maryamzaabati-collab/biologIA`.

## Tests

```bash
cd backend
npm test
```

## Contenu utile

- `docs/Rapport_Registre_Tracabilite_Laboratoires.docx` — rapport pédagogique
- `frontend/` — pages HTML/CSS/JS
- `backend/start.js` — point d’entrée du serveur
