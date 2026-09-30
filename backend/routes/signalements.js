const express = require('express');
const router = express.Router();
const db = require('../db');
const { problemesLot, colonnesSensibles } = require('../lib/tracabilite');
const journal = require('../lib/journal');

function sensiblesDepuisLot(lot) {
  if (!lot?.colonnes_csv) return [];
  try {
    const colonnes = JSON.parse(lot.colonnes_csv);
    return colonnesSensibles(colonnes);
  } catch {
    return [];
  }
}

router.get('/', async (req, res) => {
  try {
    const signalements = await db.all(`
      SELECT signalements.*, lots.nom AS lot_nom, lots.statut AS lot_statut
      FROM signalements JOIN lots ON signalements.lot_id = lots.id
      WHERE signalements.resolu = ?
      ORDER BY signalements.date DESC
    `, [req.query.resolu === '1' ? 1 : 0]);
    res.json(signalements);
  } catch (err) {
    res.status(500).json({ erreur: err.message });
  }
});

router.put('/:id/resoudre', async (req, res) => {
  try {
    const signalement = await db.get('SELECT * FROM signalements WHERE id = ?', [req.params.id]);
    if (!signalement) return res.status(404).json({ erreur: "Ce signalement n'existe pas." });

    const lot = await db.get('SELECT * FROM lots WHERE id = ?', [signalement.lot_id]);
    if (!lot) return res.status(404).json({ erreur: "Le lot associe n'existe pas." });

    const encore = problemesLot({
      machine_id: lot.machine_id,
      date: lot.date,
      conditions: lot.conditions,
      anonymise: lot.anonymise,
      sensibles: sensiblesDepuisLot(lot)
    });

    if (encore.includes(signalement.raison)) {
      return res.status(400).json({
        erreur: "Impossible de résoudre : le lot n'a pas encore été corrigé. Modifiez le lot pour ajouter la donnée manquante."
      });
    }

    await db.run('UPDATE signalements SET resolu = 1 WHERE id = ?', [req.params.id]);
    await journal.enregistrer(req, 'résolution signalement', `lot ${lot.id}`, signalement.raison);

    const { restants } = await db.get(
      'SELECT COUNT(*) AS restants FROM signalements WHERE lot_id = ? AND resolu = 0',
      [lot.id]
    );
    if (restants === 0 && encore.length === 0) {
      await db.run("UPDATE lots SET statut = 'ok' WHERE id = ?", [lot.id]);
    }

    res.json({ message: 'Signalement resolu.' });
  } catch (err) {
    res.status(500).json({ erreur: err.message });
  }
});

module.exports = router;
