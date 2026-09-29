# TraceLab — registre de traçabilité

Projet 4 BUT Science des Données (Biologie / Laboratoires). Application web pour tracer l’origine et la qualité des **lots de données de référence** : machines, conditions de mesure, pseudonymisation, signalements, validation biologiste, cartes de contrôle, certificat, lignée et journal d’audit.

Aucun dossier patient réel n’est stocké ni interprété.

Nécessite **Node.js 22+** (SQLite via `node:sqlite`).

## Lancer en local

```bash
cd backend
npm install
node start.js
```

Ouvrir [http://localhost:3000](http://localhost:3000).

Comptes de démonstration (à ne pas réutiliser en production) : `samira` / `labo2026` (technicien), `amrani` / `labo2026` (biologiste).

Si `npm` n’est pas reconnu dans VS Code, installe Node 22 depuis [nodejs.org](https://nodejs.org), ferme l’éditeur, puis rouvre un terminal. Script d’aide : `sh outils/installer-node.sh` puis `sh outils/lancer.sh`.

## Tests

```bash
cd backend
npm test
```

## Contenu utile

- `docs/Rapport_Registre_Tracabilite_Laboratoires.docx` — rapport pédagogique
- `frontend/` — pages HTML/CSS/JS
- `backend/start.js` — point d’entrée du serveur
