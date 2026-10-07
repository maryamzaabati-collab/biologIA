const express = require('express');
const router = express.Router();
const db = require('../db');
const { carteLeveyJennings } = require('../lib/tracabilite');

function parametreDuLot(lot) {
  if (lot.parametre) return String(lot.parametre).trim();
  const nom = String(lot.nom || '');
  const coupure = nom.split(/\s[—–-]\s/);
  return (coupure[0] || nom || 'Paramètre').trim();
}

function valeursDuLot(lot) {
  if (!lot.valeurs_controle) return [];
  try {
    const parsed = JSON.parse(lot.valeurs_controle);
    return Array.isArray(parsed) ? parsed.map(Number).filter((n) => !Number.isNaN(n)) : [];
  } catch {
    return [];
  }
}

function datesDuLot(lot) {
  if (!lot.dates_controle) return [];
  try {
    const parsed = JSON.parse(lot.dates_controle);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

router.get('/', async (req, res) => {
  try {
    const clauses = ['COALESCE(lots.archive, 0) = 0', 'COALESCE(lots.est_test, 0) = 0'];
    const params = [];
    if (req.query.machine_id) {
      clauses.push('lots.machine_id = ?');
      params.push(req.query.machine_id);
    }
    if (req.query.lot_id) {
      clauses.push('lots.id = ?');
      params.push(req.query.lot_id);
    }
    const lots = await db.all(`
      SELECT lots.id, lots.nom, lots.date, lots.moyenne_controle, lots.machine_id,
        lots.valeurs_controle, lots.dates_controle,
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

    const series = [];
    for (const lot of filtrés) {
      const vals = valeursDuLot(lot);
      if (!vals.length) continue;
      const dates = datesDuLot(lot);
      const stats = carteLeveyJennings(vals, dates.length ? dates : vals.map(() => lot.date));
      series.push({
        lot_id: lot.id,
        nom: lot.nom,
        machine_nom: lot.machine_nom || 'Machine non renseignée',
        parametre: lot.parametre,
        suffisant: stats.suffisant,
        message: stats.message,
        nb_reference: stats.nb_reference,
        nb_points: stats.nb_points,
        points: stats.points.map((p, i) => ({
          ...p,
          id: lot.id,
          nom: lot.nom,
          index: i + 1
        })),
        moyenne: stats.moyenne,
        ecart_type: stats.ecart_type,
        limite_1s_bas: stats.limite_1s_bas,
        limite_1s_haut: stats.limite_1s_haut,
        limite_2s_bas: stats.limite_2s_bas,
        limite_2s_haut: stats.limite_2s_haut,
        limite_3s_bas: stats.limite_3s_bas,
        limite_3s_haut: stats.limite_3s_haut,
        westgard: stats.westgard
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
