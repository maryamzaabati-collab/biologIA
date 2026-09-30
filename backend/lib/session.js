const crypto = require('crypto');
const db = require('../database');

const NOM_COOKIE = 'labo_session';
const DUREE_SECONDES = 8 * 60 * 60;

function lireCookies(req) {
  const brut = req.headers.cookie || '';
  const out = {};
  for (const morceau of brut.split(';')) {
    const i = morceau.indexOf('=');
    if (i < 1) continue;
    const cle = morceau.slice(0, i).trim();
    const val = morceau.slice(i + 1).trim();
    try {
      out[cle] = decodeURIComponent(val);
    } catch {
      out[cle] = val;
    }
  }
  return out;
}

function enteteCookie(sessionId, maxAge = DUREE_SECONDES) {
  const https = Boolean(process.env.REPL_ID || process.env.REPLIT_DEV_DOMAIN);
  const sameSite = https ? 'None; Secure' : 'Lax';
  return `${NOM_COOKIE}=${sessionId}; Path=/; HttpOnly; SameSite=${sameSite}; Max-Age=${maxAge}`;
}

async function creerSession(utilisateurId) {
  const id = crypto.randomBytes(24).toString('hex');
  await db.run(
    "INSERT INTO sessions (id, utilisateur_id, expire_le) VALUES (?, ?, datetime('now', '+8 hours'))",
    [id, utilisateurId]
  );
  return id;
}

async function attacherUtilisateur(req, res, next) {
  req.utilisateur = null;
  const sid = lireCookies(req)[NOM_COOKIE];
  if (!sid) return next();
  try {
    const ligne = await db.get(
      `SELECT utilisateurs.id, utilisateurs.nom, utilisateurs.role, utilisateurs.identifiant, utilisateurs.statut, sessions.id AS session_id
       FROM sessions JOIN utilisateurs ON utilisateurs.id = sessions.utilisateur_id
       WHERE sessions.id = ? AND sessions.expire_le > datetime('now') AND utilisateurs.statut = 'valide'`,
      [sid]
    );
    if (ligne) {
      req.utilisateur = {
        id: ligne.id,
        nom: ligne.nom,
        role: ligne.role,
        identifiant: ligne.identifiant
      };
    }
  } catch {
    req.utilisateur = null;
  }
  next();
}

function exigerConnexion(req, res, next) {
  if (req.path === '/connexion' && req.method === 'POST') return next();
  if (!req.utilisateur) {
    return res.status(401).json({ erreur: 'Connexion requise.' });
  }
  next();
}

function exigerRole(...roles) {
  return (req, res, next) => {
    if (!req.utilisateur) {
      return res.status(401).json({ erreur: 'Connexion requise.' });
    }
    if (!roles.includes(req.utilisateur.role)) {
      return res.status(403).json({
        erreur: 'Votre rôle ne permet pas cette action.'
      });
    }
    next();
  };
}

module.exports = {
  NOM_COOKIE,
  DUREE_SECONDES,
  lireCookies,
  enteteCookie,
  creerSession,
  attacherUtilisateur,
  exigerConnexion,
  exigerRole
};
