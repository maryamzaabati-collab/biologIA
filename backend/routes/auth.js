const express = require('express');
const router = express.Router();
const db = require('../database');
const { hasherMotDePasse, verifierMotDePasse } = require('../lib/motdepasse');
const { creerSession, enteteCookie, NOM_COOKIE, lireCookies } = require('../lib/session');
const journal = require('../lib/journal');

const ROLES = ['client', 'technicien', 'biologiste'];
const MAX_ECHEC = 5;

function publicUtilisateur(u) {
  return { id: u.id, nom: u.nom, role: u.role, identifiant: u.identifiant, email: u.email || null, statut: u.statut };
}

async function estBloque(identifiant) {
  const row = await db.get(
    `SELECT COUNT(*) AS n FROM tentatives_connexion
     WHERE identifiant = ? AND reussie = 0 AND date >= datetime('now', '-15 minutes')`,
    [identifiant]
  );
  return Number(row && row.n) >= MAX_ECHEC;
}

router.get('/config', (req, res) => {
  res.json({ google: false });
});

router.post('/inscription', async (req, res) => {
  const nom = String(req.body.nom || '').trim();
  const identifiant = String(req.body.identifiant || '').trim().toLowerCase();
  const email = String(req.body.email || '').trim().toLowerCase();
  const motDePasse = String(req.body.mot_de_passe || '');
  const roleDemande = String(req.body.role_demande || '').trim();
  if (!nom || !identifiant || !motDePasse) {
    return res.status(400).json({ erreur: 'Nom, identifiant et mot de passe sont obligatoires.' });
  }
  if (!email) {
    return res.status(400).json({ erreur: 'L’e-mail est obligatoire (réinitialisation et journal).' });
  }
  if (!ROLES.includes(roleDemande)) {
    return res.status(400).json({ erreur: 'Choisissez un rôle : client, technicien ou biologiste.' });
  }
  if (motDePasse.length < 8) {
    return res.status(400).json({ erreur: 'Le mot de passe doit faire au moins 8 caractères.' });
  }
  try {
    const deja = await db.get(
      'SELECT id FROM utilisateurs WHERE lower(identifiant) = ? OR (email IS NOT NULL AND lower(email) = ?)',
      [identifiant, email]
    );
    if (deja) return res.status(409).json({ erreur: 'Cet identifiant ou cet e-mail existe déjà.' });
    const { id } = await db.run(
      `INSERT INTO utilisateurs (nom, role, identifiant, mot_de_passe, email, statut, role_demande)
       VALUES (?, ?, ?, ?, ?, 'en_attente', ?)`,
      [nom, roleDemande, identifiant, hasherMotDePasse(motDePasse), email, roleDemande]
    );
    await journal.enregistrer(req, 'inscription', `utilisateur ${id}`, identifiant);
    res.status(201).json({
      id,
      message: 'Compte créé. Un biologiste doit valider votre accès avant connexion.'
    });
  } catch (err) {
    res.status(500).json({ erreur: err.message });
  }
});

router.post('/connexion', async (req, res) => {
  const identifiant = String(req.body.identifiant || '').trim().toLowerCase();
  const motDePasse = String(req.body.mot_de_passe || '');
  if (!identifiant || !motDePasse) {
    return res.status(400).json({ erreur: 'Identifiant et mot de passe obligatoires.' });
  }
  try {
    if (await estBloque(identifiant)) {
      await journal.enregistrer(req, 'connexion bloquée', identifiant, '5 échecs');
      return res.status(429).json({
        erreur: 'Trop de tentatives. Réessayez dans 15 minutes.'
      });
    }
    const user = await db.get(
      `SELECT * FROM utilisateurs WHERE lower(identifiant) = ? OR (email IS NOT NULL AND lower(email) = ?)`,
      [identifiant, identifiant]
    );
    if (!user || !user.mot_de_passe || !verifierMotDePasse(motDePasse, user.mot_de_passe)) {
      await db.run(
        'INSERT INTO tentatives_connexion (identifiant, reussie) VALUES (?, 0)',
        [identifiant]
      );
      await journal.enregistrer({ utilisateur: null }, 'connexion échouée', identifiant, '');
      return res.status(401).json({ erreur: 'Identifiant ou mot de passe incorrect.' });
    }
    if (user.statut === 'en_attente') {
      return res.status(403).json({ erreur: 'Votre compte attend la validation d\'un biologiste.' });
    }
    if (user.statut === 'refuse') {
      return res.status(403).json({ erreur: 'Ce compte a été refusé par un biologiste.' });
    }
    await db.run('INSERT INTO tentatives_connexion (identifiant, reussie) VALUES (?, 1)', [identifiant]);
    const sid = await creerSession(user.id);
    res.setHeader('Set-Cookie', enteteCookie(sid));
    await journal.enregistrer({ utilisateur: user }, 'connexion', `utilisateur ${user.id}`, user.identifiant);
    res.json(publicUtilisateur(user));
  } catch (err) {
    res.status(500).json({ erreur: err.message });
  }
});

router.get('/moi', (req, res) => {
  if (!req.utilisateur) return res.status(401).json({ erreur: 'Connexion requise.' });
  res.json(req.utilisateur);
});

router.post('/deconnexion', async (req, res) => {
  try {
    const cookies = lireCookies(req);
    if (cookies[NOM_COOKIE]) {
      await db.run('DELETE FROM sessions WHERE id = ?', [cookies[NOM_COOKIE]]);
    }
  } catch { /* ignore */ }
  res.setHeader('Set-Cookie', enteteCookie('', 0));
  res.json({ message: 'Déconnexion.' });
});

module.exports = router;
