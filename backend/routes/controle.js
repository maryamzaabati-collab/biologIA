const express = require('express');
const router = express.Router();
const db = require('../db');
const { pointsControle } = require('../lib/tracabilite');

router.get('/', async (req, res) => {
  try {
    const clauses = ['lots.moyenne_controle IS NOT NULL', "lots.date IS NOT NULL"];
    const params = [];
    if (req.query.machine_id) {
      clauses.push('lots.machine_id = ?');
      params.push(req.query.machine_id);
    }
    if (req.query.parametre) {
      clauses.push('EXISTS (SELECT 1 FROM regles_alerte r WHERE r.lot_id = lots.id AND r.parametre = ?)');
      params.push(req.query.parametre);
    }
    const lots = await db.all(`
      SELECT lots.id, lots.nom, lots.date, lots.moyenne_controle, lots.machine_id,
        machines.nom AS machine_nom
      FROM lots LEFT JOIN machines ON machines.id = lots.machine_id
      WHERE ${clauses.join(' AND ')}
      ORDER BY lots.date ASC, lots.id ASC
    `, params);

    const moyennes = lots.map((l) => l.moyenne_controle);
    const stats = pointsControle(moyennes);
    const points = lots.map((l, i) => ({
      ...l,
      hors_norme: stats.hors_norme[i] || false
    }));

    res.json({
      points,
      moyenne: stats.moyenne,
      ecart_type: stats.ecart_type,
      limite_2s_bas: stats.limite_2s_bas,
      limite_2s_haut: stats.limite_2s_haut
    });
  } catch (err) {
    res.status(500).json({ erreur: err.message });
  }
});

module.exports = router;
