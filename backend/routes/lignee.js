const express = require('express');
const router = express.Router();
const db = require('../db');

router.get('/', async (req, res) => {
  try {
    const lots = await db.all(`
      SELECT lots.id, lots.nom, lots.code_verification, lots.statut, lots.anonymise,
        machines.nom AS machine_nom
      FROM lots LEFT JOIN machines ON machines.id = lots.machine_id
      ORDER BY lots.id DESC
    `);
    const resultat = [];
    for (const lot of lots) {
      const [regles, validations, signalements] = await Promise.all([
        db.all('SELECT id, parametre, seuil_bas, seuil_haut, unite, statut FROM regles_alerte WHERE lot_id = ?', [lot.id]),
        db.all('SELECT nom_biologiste, date_validation FROM validations WHERE lot_id = ? ORDER BY date_validation DESC', [lot.id]),
        db.all('SELECT raison FROM signalements WHERE lot_id = ? AND resolu = 0', [lot.id])
      ]);
      resultat.push({
        ...lot,
        machine: lot.machine_nom,
        regles,
        validations,
        alertes: signalements
      });
    }
    res.json(resultat);
  } catch (err) {
    res.status(500).json({ erreur: err.message });
  }
});

module.exports = router;
