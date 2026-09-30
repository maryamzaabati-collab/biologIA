const express = require('express');
const router = express.Router();
const db = require('../db');
const { leveyJennings } = require('../lib/tracabilite');

function parametreDuLot(lot) {
  if (lot.parametre) return String(lot.parametre).trim();
  const nom = String(lot.nom || '');
  const coupure = nom.split(/\s[—–-]\s/);
  return (coupure[0] || nom || 'Paramètre').trim();
}

router.get('/', async (req, res) => {
  try {
    const clauses = ['lots.moyenne_controle IS NOT NULL', "lots.date IS NOT NULL"];
    const params = [];
    if (req.query.machine_id) {
      clauses.push('lots.machine_id = ?');
      params.push(req.query.machine_id);
    }
    const lots = await db.all(`
      SELECT lots.id, lots.nom, lots.date, lots.moyenne_controle, lots.machine_id,
        machines.nom AS machine_nom,
        (SELECT r.parametre FROM regles_alerte r WHERE r.lot_id = lots.id ORDER BY r.id ASC LIMIT 1) AS parametre
      FROM lots LEFT JOIN machines ON machines.id = lots.machine_id
      WHERE ${clauses.join(' AND ')}
      ORDER BY lots.machine_id ASC, lots.date ASC, lots.id ASC
    `, params);

    const enrichis = lots.map((l) => ({ ...l, parametre: parametreDuLot(l) }));
    const parametres = [...new Set(enrichis.map((l) => l.parametre))].sort();
    const filtreParam = req.query.parametre ? String(req.query.parametre) : '';
    const filtrés = filtreParam ? enrichis.filter((l) => l.parametre === filtreParam) : enrichis;

    const groupes = new Map();
    for (const lot of filtrés) {
      const cle = `${lot.machine_id || 'sans'}|${lot.parametre}`;
      if (!groupes.has(cle)) groupes.set(cle, []);
      groupes.get(cle).push(lot);
    }

    const series = [];
    for (const groupe of groupes.values()) {
      const vals = groupe.map((l) => Number(l.moyenne_controle));
      const stats = leveyJennings(vals);
      series.push({
        machine_nom: groupe[0].machine_nom || 'Machine non renseignée',
        parametre: groupe[0].parametre,
        nb_reference: stats.nb_reference,
        points: groupe.map((l, i) => ({ ...l, hors_norme: stats.hors_norme[i] || false })),
        moyenne: stats.moyenne,
        ecart_type: stats.ecart_type,
        limite_2s_bas: stats.limite_2s_bas,
        limite_2s_haut: stats.limite_2s_haut
      });
    }

    res.json({
      series,
      parametres,
      points: series[0]?.points || [],
      moyenne: series[0]?.moyenne ?? null,
      ecart_type: series[0]?.ecart_type ?? 0,
      limite_2s_bas: series[0]?.limite_2s_bas ?? null,
      limite_2s_haut: series[0]?.limite_2s_haut ?? null
    });
  } catch (err) {
    res.status(500).json({ erreur: err.message });
  }
});

module.exports = router;
