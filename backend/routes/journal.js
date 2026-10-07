const express = require('express');
const router = express.Router();
const db = require('../database');
const { formaterParis, isoUtc } = require('../lib/dates');
const { csvAvecBom } = require('../lib/tracabilite');

function refLot(id) {
  return 'L-' + String(id).padStart(3, '0');
}

function filtres(req) {
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
  return { clauses, params, where: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '' };
}

function mapper(l, parId) {
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
}

router.get('/', async (req, res) => {
  try {
    const { params, where } = filtres(req);
    const page = Math.max(1, Number(req.query.page) || 1);
    const taille = Math.min(100, Math.max(10, Number(req.query.taille) || 50));
    const offset = (page - 1) * taille;
    const totalRow = await db.get(`SELECT COUNT(*) AS n FROM journal_audit ${where}`, params);
    const lignes = await db.all(
      `SELECT * FROM journal_audit ${where} ORDER BY date DESC, id DESC LIMIT ? OFFSET ?`,
      [...params, taille, offset]
    );
    const lots = await db.all('SELECT id, nom FROM lots');
    const parId = new Map(lots.map((l) => [Number(l.id), l]));
    const actions = await db.all('SELECT DISTINCT action FROM journal_audit ORDER BY action');
    res.json({
      page,
      taille,
      total: Number(totalRow && totalRow.n) || 0,
      actions: actions.map((a) => a.action),
      lignes: lignes.map((l) => mapper(l, parId))
    });
  } catch (err) {
    res.status(500).json({ erreur: err.message });
  }
});

router.get('/csv', async (req, res) => {
  try {
    const { params, where } = filtres(req);
    const lignes = await db.all(
      `SELECT * FROM journal_audit ${where} ORDER BY date DESC, id DESC LIMIT 2000`,
      params
    );
    const lots = await db.all('SELECT id, nom FROM lots');
    const parId = new Map(lots.map((l) => [Number(l.id), l]));
    const csv = [['date', 'qui', 'action', 'cible', 'details']].concat(
      lignes.map((l) => {
        const m = mapper(l, parId);
        return [m.date_paris, m.nom_affiche, m.action, m.cible_lisible, m.details || ''];
      })
    );
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="journal-audit.csv"');
    res.send(csvAvecBom(csv));
  } catch (err) {
    res.status(500).json({ erreur: err.message });
  }
});

module.exports = router;
