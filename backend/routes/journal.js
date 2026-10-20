const express = require('express');
const router = express.Router();
const db = require('../database');
const { formaterParis, isoUtc, jourCivilParis } = require('../lib/dates');
const { csvAvecBom } = require('../lib/tracabilite');
const { verifierIntegrite } = require('../lib/journal');

function libelleLot(lot) {
  if (!lot) return '';
  return lot.code_verification ? `${lot.nom} (${lot.code_verification})` : lot.nom;
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
  // Le filtre jour est appliqué après mapping (calendrier de Paris).
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
      ? libelleLot(lot)
      : compte
        ? (l.details ? String(l.details).split('→')[0].trim() : l.cible)
        : (l.cible || '—'),
    jour_civil: jourCivilParis(l.date)
  };
}

router.get('/', async (req, res) => {
  try {
    const { params, where } = filtres(req);
    const page = Math.max(1, Number(req.query.page) || 1);
    const taille = Math.min(100, Math.max(10, Number(req.query.taille) || 50));
    const lots = await db.all('SELECT id, nom, code_verification FROM lots');
    const parId = new Map(lots.map((l) => [Number(l.id), l]));
    const jour = String(req.query.date || '').trim();
    let lignes = await db.all(
      `SELECT * FROM journal_audit ${where} ORDER BY date DESC, id DESC LIMIT 2000`,
      params
    );
    lignes = lignes.map((l) => mapper(l, parId));
    if (jour) lignes = lignes.filter((l) => l.jour_civil === jour);
    const total = lignes.length;
    const offset = (page - 1) * taille;
    const actions = await db.all('SELECT DISTINCT action FROM journal_audit ORDER BY action');
    res.json({
      page,
      taille,
      total,
      actions: actions.map((a) => a.action),
      lignes: lignes.slice(offset, offset + taille)
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
    const lots = await db.all('SELECT id, nom, code_verification FROM lots');
    const parId = new Map(lots.map((l) => [Number(l.id), l]));
    const jour = String(req.query.date || '').trim();
    let mapped = lignes.map((l) => mapper(l, parId));
    if (jour) mapped = mapped.filter((l) => l.jour_civil === jour);
    const csv = [['date', 'qui', 'action', 'cible', 'details']].concat(
      mapped.map((m) => [m.date_paris, m.nom_affiche, m.action, m.cible_lisible, m.details || ''])
    );
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="journal-audit.csv"');
    res.send(csvAvecBom(csv));
  } catch (err) {
    res.status(500).json({ erreur: err.message });
  }
});

router.get('/integrite', async (req, res) => {
  try {
    res.json(await verifierIntegrite(db));
  } catch (err) {
    res.status(500).json({ erreur: err.message });
  }
});

module.exports = router;
