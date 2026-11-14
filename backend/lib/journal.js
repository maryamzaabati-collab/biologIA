const crypto = require('crypto');
const { horlogeParis } = require('./dates');

function empreinte(prev, date, action, cible, details, nom) {
  return crypto.createHash('sha256')
    .update([prev || 'GENESE', date, nom || '', action, cible || '', details || ''].join('|'))
    .digest('hex');
}

async function enregistrer(req, action, cible, details, dateForcee) {
  try {
    const db = require('../db');
    const u = req && req.utilisateur;
    const date = dateForcee || horlogeParis();
    const nom = u ? u.nom : 'système';
    let prev = '';
    try {
      const dernier = await db.get('SELECT hash FROM journal_audit ORDER BY id DESC LIMIT 1');
      prev = (dernier && dernier.hash) || '';
    } catch { prev = ''; }
    const hash = empreinte(prev, date, action, cible, details, nom);
    await db.run(
      `INSERT INTO journal_audit (utilisateur_id, nom_affiche, action, cible, details, date, hash, hash_precedent)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [u ? u.id : null, nom, action, cible || '', details ? String(details).slice(0, 500) : '', date, hash, prev]
    );
  } catch {
    /* le journal ne doit pas faire échouer l'action métier */
  }
}

async function verifierIntegrite(db) {
  const lignes = await db.all('SELECT * FROM journal_audit ORDER BY id ASC');
  const fautes = [];
  let prev = '';
  let nbHaches = 0;
  for (const l of lignes) {
    if (!l.hash) continue;
    nbHaches += 1;
    const attendu = empreinte(prev, l.date, l.action, l.cible, l.details, l.nom_affiche);
    if ((l.hash_precedent || '') !== prev || l.hash !== attendu) {
      fautes.push({ id: l.id, action: l.action, date: l.date });
    }
    prev = l.hash;
  }
  return { ok: fautes.length === 0, nb: nbHaches, fautes };
}

module.exports = { enregistrer, verifierIntegrite, empreinte };
