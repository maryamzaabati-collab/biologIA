const express = require('express');
const router = express.Router();
const db = require('../db');

router.get('/', async (req, res) => {
  const q = String(req.query.q || '').trim();
  if (!q) return res.json({ lots: [], machines: [], signalements: [] });
  const like = `%${q}%`;
  try {
    const lots = await db.all(
      `SELECT id, nom, code_verification, statut FROM lots
       WHERE nom LIKE ? OR code_verification LIKE ? OR conditions LIKE ?
       ORDER BY date_creation DESC LIMIT 8`,
      [like, like, like]
    );
    const machines = await db.all(
      'SELECT id, nom, type FROM machines WHERE nom LIKE ? OR type LIKE ? ORDER BY nom LIMIT 5',
      [like, like]
    );
    const signalements = await db.all(
      `SELECT signalements.id, signalements.raison, signalements.lot_id, lots.nom AS lot_nom
       FROM signalements JOIN lots ON lots.id = signalements.lot_id
       WHERE signalements.resolu = 0 AND (signalements.raison LIKE ? OR lots.nom LIKE ?)
       ORDER BY signalements.date DESC LIMIT 8`,
      [like, like]
    );
    res.json({ lots, machines, signalements });
  } catch (err) {
    res.status(500).json({ erreur: err.message });
  }
});

module.exports = router;
