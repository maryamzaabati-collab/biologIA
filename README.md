# biologIA — registre de traçabilité

Projet 4 BUT Science des Données (Biologie / Laboratoires). Application web pour tracer l’origine et la qualité des **lots de données de référence** : machines, conditions de mesure, pseudonymisation, signalements, validation biologiste, cartes de contrôle, certificat, lignée et journal d’audit.

Aucun dossier patient réel n’est stocké ni interprété.

## Problématique

> Comment un réseau de laboratoires peut-il prouver, à tout moment, que ses seuils d’alerte reposent sur des données fiables, traçables et conformes ?

biologIA répond en trois couches :

1. **Registre** (plateau de Nice) : chaque lot de référence a sa fiche, sa machine, sa pseudonymisation vérifiée, sa validation par un biologiste, son historique et son certificat.
2. **Surveillance** : règles de Westgard appliquées chaque jour aux contrôles qualité ; une dérive passe automatiquement les lots de référence touchés en « à revalider ».
3. **Observatoire du réseau** (`reseau.html`) : 12 laboratoires de la région Sud, carte, Sigma par analyse, dérives, comparaison inter-laboratoires, lots de référence, jeux de données téléchargeables.

Page de présentation : `apropos.html` (menu « Problématique »).

## Données de l’observatoire

| Donnée | Nature | Source |
|---|---|---|
| Volumes nationaux d’actes par code NABM (janv.–juin 2026) | réelle | Assurance Maladie (Cnam) |
| Communes, codes INSEE, populations municipales | réelle | `@etalab/decoupage-administratif` 6.0.0 |
| Contours des 6 départements de la région Sud | réelle | france-geojson (IGN Admin Express simplifié) → `frontend/donnees/carte-sud.json` |
| Erreurs totales admissibles, imprécisions cibles | référentiel | ordres de grandeur CLIA 2024 / EFLM |
| Sites, analyseurs, 38 880 contrôles qualité, 720 résultats inter-labos, 288 lots de référence, 5 dérives | simulée | `backend/lib/donnees-reseau.js` (graine fixe, reproductible) |

Le jeu est créé automatiquement au premier lancement (tables `reseau_*`, moins d’une seconde). Pour le régénérer : `cd backend && npm run seed`.
API (lecture, tous rôles connectés) : `/api/reseau/resume`, `/sites`, `/repartition`, `/performance`, `/derives`, `/qc`, `/eeq`, `/lots`, `/dictionnaire`, `/export/<jeu>` (CSV).

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

Comptes démo : `samira` (technicien), `amrani` (biologiste), `lea` (client) — mot de passe `labo2026`.

Sécurité pédagogique : cookie de session HttpOnly, jeton CSRF (`X-CSRF-Token`), en-têtes type Helmet, limitation des tentatives de connexion, journal d’audit chaîné (SHA-256). Les scripts HTML restent en `'unsafe-inline'` (pages vanilla).

Les lots marqués TEST sont exclus du tableau de bord, des cartes de contrôle et de la synthèse.

Page scénario jury (hors menu) : ouvrir `frontend/demo.html` ou le bouton « Voir la démonstration » sur l’accueil.

Le QR des PDF pointe vers `PUBLIC_URL` si défini, sinon l’hôte public de la requête, sinon le dépôt GitHub. Sur Replit après Publish : `https://biologia.replit.app`.

## Tests

```bash
cd backend
npm test
```

## Contenu utile

- `docs/Rapport_Registre_Tracabilite_Laboratoires.docx` — rapport pédagogique
- `frontend/` — pages HTML/CSS/JS
- `backend/start.js` — point d’entrée du serveur
