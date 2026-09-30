const express = require('express');
const router = express.Router();
const db = require('../database');
const { formaterParis, isoUtc } = require('../lib/dates');

function refLot(id) {
  return 'L-' + String(id).padStart(3, '0');
}

router.get('/', async (req, res) => {
  try {
    const clauses = [];
    const params = [];
    if (req.query.utilisateur) {
      clauses.push('nom_affiche LIKE ?');
      params.push(`%${req.query.utilisateur}%`);
    }
    if (req.query.action) {
      clauses.push('action = ?');
      params.push(req.query.action);
    }
    if (req.query.date) {
      clauses.push("substr(replace(date, 'T', ' '), 1, 10) = ?");
      params.push(req.query.date);
    }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const lignes = await db.all(
      `SELECT * FROM journal_audit ${where} ORDER BY date DESC, id DESC LIMIT 400`,
      params
    );
    const lots = await db.all('SELECT id, nom FROM lots');
    const parId = new Map(lots.map((l) => [Number(l.id), l]));
    const actions = await db.all('SELECT DISTINCT action FROM journal_audit ORDER BY action');
    res.json({
      actions: actions.map((a) => a.action),
      lignes: lignes.map((l) => {
        const m = String(l.cible || '').match(/lot\s+(\d+)/i);
        const lotId = m ? Number(m[1]) : null;
        const lot = lotId ? parId.get(lotId) : null;
        const compte = String(l.cible || '').match(/utilisateur\s+(\d+)/i);
        return {
          ...l,
          date: isoUtc(l.date),
          date_paris: formaterParis(l.date),
          lot_id: lotId,
          cible_lisible: lot
            ? `Lot ${refLot(lot.id)} — ${lot.nom}`
            : compte
              ? (l.details ? String(l.details).split('→')[0].trim() : l.cible)
              : (l.cible || '—')
        };
      })
    });
  } catch (err) {
    res.status(500).json({ erreur: err.message });
  }
});

module.exports = router;
