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
    res.append('Set-Cookie', enteteCookie(sid));
    await journal.enregistrer({ utilisateur: user }, 'connexion', `utilisateur ${user.id}`, user.identifiant);
    res.json(publicUtilisateur(user));
  } catch (err) {
    res.status(500).json({ erreur: err.message });
  }
});

router.get('/moi', (req, res) => {
  if (!req.utilisateur) return res.status(401).json({ erreur: 'Connexion requise.' });
  res.json({ ...req.utilisateur, csrf: req.csrf || null });
});

router.post('/deconnexion', async (req, res) => {
  try {
    const cookies = lireCookies(req);
    if (cookies[NOM_COOKIE]) {
      await db.run('DELETE FROM sessions WHERE id = ?', [cookies[NOM_COOKIE]]);
    }
  } catch { /* ignore */ }
  res.append('Set-Cookie', enteteCookie('', 0));
  res.json({ message: 'Déconnexion.' });
});


const crypto = require('crypto');

router.post('/mot-de-passe-oublie', async (req, res) => {
  const identifiant = String(req.body.identifiant || '').trim().toLowerCase();
  try {
    const user = identifiant
      ? await db.get(
          `SELECT * FROM utilisateurs WHERE lower(identifiant) = ? OR (email IS NOT NULL AND lower(email) = ?)`,
          [identifiant, identifiant]
        )
      : null;
    if (user) {
      const token = crypto.randomBytes(24).toString('hex');
      await db.run("INSERT INTO reset_mdp (token, utilisateur_id, expire_le) VALUES (?, ?, datetime('now', '+1 hour'))", [token, user.id]);
      await journal.enregistrer({ utilisateur: null }, 'demande reset mdp', `utilisateur ${user.id}`, '');
      if (process.env.NODE_ENV !== 'production') {
        return res.json({ message: 'Si un compte existe, un lien a été préparé (démo).', token_demo: token });
      }
    }
    res.json({ message: 'Si un compte existe, un lien de réinitialisation a été préparé.' });
  } catch (err) {
    res.status(500).json({ erreur: err.message });
  }
});

router.post('/reinitialiser', async (req, res) => {
  const token = String(req.body.token || '').trim();
  const motDePasse = String(req.body.mot_de_passe || '');
  if (!token || motDePasse.length < 8) {
    return res.status(400).json({ erreur: 'Jeton et mot de passe (8 caractères min.) obligatoires.' });
  }
  try {
    const row = await db.get(
      "SELECT * FROM reset_mdp WHERE token = ? AND utilise = 0 AND expire_le > datetime('now')",
      [token]
    );
    if (!row) return res.status(400).json({ erreur: 'Jeton invalide ou expiré.' });
    await db.run('UPDATE utilisateurs SET mot_de_passe = ? WHERE id = ?', [hasherMotDePasse(motDePasse), row.utilisateur_id]);
    await db.run('UPDATE reset_mdp SET utilise = 1 WHERE token = ?', [token]);
    await db.run('DELETE FROM sessions WHERE utilisateur_id = ?', [row.utilisateur_id]);
    await journal.enregistrer({ utilisateur: { id: row.utilisateur_id, nom: 'compte' } }, 'reset mdp', `utilisateur ${row.utilisateur_id}`, '');
    res.json({ message: 'Mot de passe mis à jour. Connectez-vous.' });
  } catch (err) {
    res.status(500).json({ erreur: err.message });
  }
});

module.exports = router;

