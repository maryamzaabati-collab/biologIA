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
      SELECT signalements.*, lots.nom AS lot_nom, lots.statut AS lot_statut, lots.est_test
      FROM signalements JOIN lots ON signalements.lot_id = lots.id
      WHERE signalements.resolu = ? AND COALESCE(lots.archive, 0) = 0
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
    if (!lot) return res.status(404).json({ erreur: "Le lot associé n'existe pas." });

    const encore = problemesLot({
      machine_id: lot.machine_id,
      date: lot.date,
      conditions: lot.conditions,
      anonymise: lot.anonymise,
      sensibles: sensiblesDepuisLot(lot)
    });

    const corrige = !encore.includes(signalement.raison);
    const role = req.utilisateur && req.utilisateur.role;
    const justification = String(req.body.justification || '').trim();

    if (!corrige) {
      if (role !== 'biologiste') {
        return res.status(400).json({
          erreur: "Impossible de résoudre : le lot n'a pas encore été corrigé. Modifiez le lot, ou demandez à un biologiste de justifier la clôture."
        });
      }
      if (justification.length < 8) {
        return res.status(400).json({
          erreur: 'Le lot n’est pas corrigé : un biologiste doit fournir une justification (8 caractères min.).'
        });
      }
    }

    await db.run(
      'UPDATE signalements SET resolu = 1, justification = ? WHERE id = ?',
      [corrige ? (justification || 'Lot corrigé') : justification, req.params.id]
    );
    await journal.enregistrer(
      req,
      'résolution signalement',
      `lot ${lot.id}`,
      `${signalement.raison}${justification ? ' — ' + justification : ''}`
    );

    const restantsRow = await db.get(
      'SELECT COUNT(*) AS restants FROM signalements WHERE lot_id = ? AND resolu = 0',
      [lot.id]
    );
    const restants = restantsRow ? Number(restantsRow.restants) : 0;
    if (restants === 0 && encore.length === 0) {
      await db.run("UPDATE lots SET statut = 'ok' WHERE id = ?", [lot.id]);
    }

    res.json({ message: 'Signalement résolu.' });
  } catch (err) {
    res.status(500).json({ erreur: err.message });
  }
});

module.exports = router;
