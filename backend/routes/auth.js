const express = require('express');
const router = express.Router();
const db = require('../database');
const { hasherMotDePasse, verifierMotDePasse } = require('../lib/motdepasse');
const { creerSession, enteteCookie, NOM_COOKIE, lireCookies } = require('../lib/session');
const { googleConfigure, urlAutorisationGoogle, echangerCodeGoogle, etatAleatoire } = require('../lib/google');
const journal = require('../lib/journal');

const ROLES = ['client', 'technicien', 'biologiste'];

function publicUtilisateur(u) {
  return { id: u.id, nom: u.nom, role: u.role, identifiant: u.identifiant, statut: u.statut };
}

router.get('/config', (req, res) => {
  res.json({ google: googleConfigure().actif });
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
  if (!ROLES.includes(roleDemande)) {
    return res.status(400).json({ erreur: 'Choisissez un rôle : client, technicien ou biologiste.' });
  }
  if (motDePasse.length < 8) {
    return res.status(400).json({ erreur: 'Le mot de passe doit faire au moins 8 caractères.' });
  }
  try {
    const deja = await db.get(
      'SELECT id FROM utilisateurs WHERE lower(identifiant) = ? OR (email IS NOT NULL AND lower(email) = ? AND ? != "")',
      [identifiant, email, email]
    );
    if (deja) return res.status(409).json({ erreur: 'Cet identifiant ou cet e-mail existe déjà.' });
    const { id } = await db.run(
      `INSERT INTO utilisateurs (nom, role, identifiant, mot_de_passe, email, statut, role_demande)
       VALUES (?, ?, ?, ?, ?, 'en_attente', ?)`,
      [nom, roleDemande, identifiant, hasherMotDePasse(motDePasse), email || null, roleDemande]
    );
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
    const user = await db.get(
      `SELECT * FROM utilisateurs WHERE lower(identifiant) = ? OR (email IS NOT NULL AND lower(email) = ?)`,
      [identifiant, identifiant]
    );
    if (!user || !user.mot_de_passe || !verifierMotDePasse(motDePasse, user.mot_de_passe)) {
      return res.status(401).json({ erreur: 'Identifiant ou mot de passe incorrect.' });
    }
    if (user.statut === 'en_attente') {
      return res.status(403).json({ erreur: 'Votre compte attend la validation d\'un biologiste.' });
    }
    if (user.statut === 'refuse') {
      return res.status(403).json({ erreur: 'Ce compte a été refusé par un biologiste.' });
    }
    const sid = await creerSession(user.id);
    res.setHeader('Set-Cookie', enteteCookie(sid));
    await journal.enregistrer({ utilisateur: user }, 'connexion', `utilisateur ${user.id}`, user.identifiant);
    res.json(publicUtilisateur(user));
  } catch (err) {
    res.status(500).json({ erreur: err.message });
  }
});

router.get('/google', (req, res) => {
  const conf = googleConfigure();
  if (!conf.actif) {
    return res.status(501).json({
      erreur: 'Connexion Google non configurée. Définissez GOOGLE_CLIENT_ID et GOOGLE_CLIENT_SECRET.'
    });
  }
  const role = ROLES.includes(req.query.role) ? req.query.role : 'client';
  const etat = `${etatAleatoire()}.${role}`;
  res.setHeader('Set-Cookie', `labo_oauth=${etat}; Path=/; HttpOnly; SameSite=Lax; Max-Age=600`);
  res.redirect(urlAutorisationGoogle(etat));
});

router.get('/google/callback', async (req, res) => {
  try {
    const conf = googleConfigure();
    if (!conf.actif) return res.redirect('/connexion.html?erreur=google');
    const cookies = lireCookies(req);
    if (!req.query.code || !req.query.state || cookies.labo_oauth !== req.query.state) {
      return res.redirect('/connexion.html?erreur=google');
    }
    const roleDemande = ROLES.includes(String(req.query.state).split('.')[1])
      ? String(req.query.state).split('.')[1]
      : 'client';
    const profil = await echangerCodeGoogle(req.query.code);
    let user = await db.get(
      'SELECT * FROM utilisateurs WHERE google_id = ? OR (email IS NOT NULL AND lower(email) = ?)',
      [profil.google_id, profil.email]
    );
    if (!user) {
      const identifiant = profil.email.split('@')[0].replace(/[^a-z0-9]/gi, '').toLowerCase() || `g${Date.now()}`;
      const { id } = await db.run(
        `INSERT INTO utilisateurs (nom, role, identifiant, email, statut, role_demande, google_id)
         VALUES (?, ?, ?, ?, 'en_attente', ?, ?)`,
        [profil.nom, roleDemande, identifiant, profil.email, roleDemande, profil.google_id]
      );
      user = await db.get('SELECT * FROM utilisateurs WHERE id = ?', [id]);
    } else if (!user.google_id) {
      await db.run('UPDATE utilisateurs SET google_id = ?, email = COALESCE(email, ?) WHERE id = ?',
        [profil.google_id, profil.email, user.id]);
    }
    if (user.statut === 'en_attente') {
      return res.redirect('/connexion.html?attente=1');
    }
    if (user.statut === 'refuse') {
      return res.redirect('/connexion.html?erreur=refuse');
    }
    const sid = await creerSession(user.id);
    res.setHeader('Set-Cookie', [enteteCookie(sid), 'labo_oauth=; Path=/; Max-Age=0']);
    res.redirect('/accueil.html');
  } catch {
    res.redirect('/connexion.html?erreur=google');
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
