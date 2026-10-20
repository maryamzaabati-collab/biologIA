const crypto = require('crypto');

const NOM = 'labo_csrf';

function lireCookie(req, nom) {
  const brut = req.headers.cookie || '';
  for (const morceau of brut.split(';')) {
    const i = morceau.indexOf('=');
    if (i < 1) continue;
    if (morceau.slice(0, i).trim() === nom) {
      try { return decodeURIComponent(morceau.slice(i + 1).trim()); } catch { return morceau.slice(i + 1).trim(); }
    }
  }
  return '';
}

function poserJeton(req, res) {
  let jeton = lireCookie(req, NOM);
  if (!jeton) jeton = crypto.randomBytes(16).toString('hex');
  const https = Boolean(process.env.REPL_ID || process.env.COOKIE_SECURE);
  res.append('Set-Cookie', `${NOM}=${jeton}; Path=/; SameSite=Lax${https ? '; Secure' : ''}`);
  req.csrf = jeton;
  return jeton;
}

function middleware(req, res, next) {
  const jeton = poserJeton(req, res);
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const url = req.originalUrl || '';
  if (/\/api\/auth\/(connexion|inscription|mot-de-passe-oublie|reinitialiser)/.test(url)) return next();
  const recu = req.headers['x-csrf-token'] || (req.body && req.body._csrf);
  if (recu && recu === jeton) return next();
  return res.status(403).json({ erreur: 'Jeton CSRF manquant ou invalide.' });
}

module.exports = { middleware, poserJeton, NOM, lireCookie };
