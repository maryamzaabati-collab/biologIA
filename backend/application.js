const express = require('express');
const path = require('path');
const fs = require('fs');
const { attacherUtilisateur, exigerConnexion } = require('./lib/session');
const db = require('./database');

const app = express();
app.set('trust proxy', 1);

app.use(express.json({ limit: '2mb' }));
app.use(attacherUtilisateur);

app.get('/api/sante', async (req, res) => {
  try {
    const machines = await db.get('SELECT COUNT(*) AS n FROM machines');
    const lots = await db.get('SELECT COUNT(*) AS n FROM lots WHERE COALESCE(archive, 0) = 0');
    const signalements = await db.get('SELECT COUNT(*) AS n FROM signalements WHERE resolu = 0');
    res.json({
      ok: true,
      machines: Number(machines && machines.n) || 0,
      lots: Number(lots && lots.n) || 0,
      signalements: Number(signalements && signalements.n) || 0
    });
  } catch (err) {
    res.status(500).json({ ok: false, erreur: err.message });
  }
});

function lireTexteStable(chemin) {
  let dernier;
  for (let i = 0; i < 5; i++) {
    try {
      return fs.readFileSync(chemin, 'utf8');
    } catch (err) {
      dernier = err;
      if (!['ETIMEDOUT', 'EAGAIN', 'EBUSY'].includes(err.code)) throw err;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 150 * (i + 1));
    }
  }
  throw dernier;
}

app.get('/app.js', (req, res) => {
  try {
    const base = lireTexteStable(path.join(__dirname, '..', 'frontend', 'app.js'));
    const extra = lireTexteStable(path.join(__dirname, '..', 'frontend', 'session-extra.js'));
    res.setHeader('Cache-Control', 'no-store');
    res.type('application/javascript').send(base + '\n' + extra);
  } catch (err) {
    res.status(503).type('text').send('/* Fichier temporairement indisponible. Rechargez la page. */');
  }
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'frontend', 'connexion.html'));
});

app.use(express.static(path.join(__dirname, '..', 'frontend'), {
  etag: false,
  maxAge: 0,
  setHeaders: (res) => {
    res.setHeader('Cache-Control', 'no-store');
  }
}));

app.use('/api/auth', require('./routes/auth'));
app.use('/api', exigerConnexion);

app.use('/api', (req, res, next) => {
  const role = req.utilisateur && req.utilisateur.role;
  const url = req.originalUrl || '';
  const method = req.method;

  if (method === 'GET' || method === 'HEAD') return next();

  if (role === 'client') {
    return res.status(403).json({ erreur: 'Le rôle client est en lecture seule.' });
  }

  if (url.includes('/comptes')) {
    if (role !== 'biologiste') {
      return res.status(403).json({ erreur: 'Seuls les biologistes peuvent valider les comptes.' });
    }
    return next();
  }

  if (url.includes('/tester') || url.includes('/analyser-csv') || url.includes('/anonymisation')) {
    return next();
  }

  if (url.includes('/patients')) {
    if (url.includes('/recherche') || url.includes('/identifier') || url.includes('/tests')) return next();
    if (role !== 'biologiste') {
      return res.status(403).json({ erreur: 'Seul un biologiste gère les identités fictives.' });
    }
    return next();
  }

  if (url.includes('/regles_alerte') && url.includes('/valider')) {
    if (role !== 'biologiste') {
      return res.status(403).json({ erreur: 'Seuls les biologistes peuvent valider une règle d\'alerte.' });
    }
    return next();
  }

  if (url.includes('/validations')) {
    if (role !== 'biologiste') {
      return res.status(403).json({ erreur: 'Seuls les biologistes connectés peuvent valider un lot.' });
    }
    req.body = Object.assign({}, req.body, { utilisateur_id: req.utilisateur.id, nom_biologiste: req.utilisateur.nom });
    return next();
  }

  if (url.includes('/archiver') || (url.includes('/lots') && method === 'DELETE')) {
    if (role !== 'biologiste') {
      return res.status(403).json({ erreur: 'Seul un biologiste peut archiver un lot.' });
    }
    return next();
  }

  if (url.includes('/signalements') && url.includes('/resoudre')) {
    return next();
  }

  if (url.includes('/machines') && method === 'DELETE') {
    if (role !== 'biologiste') {
      return res.status(403).json({ erreur: 'Seul un biologiste peut retirer une machine sans lots.' });
    }
    return next();
  }

  if (['POST', 'PUT', 'PATCH'].includes(method) && url.includes('/machines')) {
    if (role !== 'technicien' && role !== 'biologiste') {
      return res.status(403).json({ erreur: 'Action réservée au laboratoire.' });
    }
    return next();
  }

  if (['POST', 'PUT'].includes(method) && (url.includes('/lots') || url.includes('/regles_alerte'))) {
    if (role !== 'technicien') {
      return res.status(403).json({ erreur: 'Seuls les techniciens connectés peuvent modifier les lots et les règles.' });
    }
    return next();
  }

  if (['POST', 'PUT', 'DELETE'].includes(method) && role !== 'technicien' && role !== 'biologiste') {
    return res.status(403).json({ erreur: 'Votre rôle ne permet pas cette action.' });
  }
  next();
});

app.use('/api/machines', require('./routes/machines'));
app.use('/api/lots', require('./routes/lots'));
app.use('/api/signalements', require('./routes/signalements'));
app.use('/api/synthese', require('./routes/synthese'));
app.use('/api/utilisateurs', require('./routes/utilisateurs'));
app.use('/api/regles_alerte', require('./routes/regles_alerte'));
app.use('/api/controle', require('./routes/controle'));
app.use('/api/recherche', require('./routes/recherche'));
app.use('/api/journal', require('./routes/journal'));
app.use('/api/lignee', require('./routes/lignee'));
app.use('/api/patients', require('./routes/patients'));
app.use('/api/anonymisation', require('./routes/anonymisation'));
app.use('/api/conformite', require('./routes/conformite'));
app.use('/api/comptes', (req, res, next) => {
  if (!req.utilisateur || req.utilisateur.role !== 'biologiste') {
    return res.status(403).json({ erreur: 'Seuls les biologistes peuvent valider les comptes.' });
  }
  next();
}, require('./routes/comptes'));

app.use((err, req, res, next) => {
  if (!err) return next();
  if (res.headersSent) return next(err);
  const timeout = err.code === 'ETIMEDOUT' || /ETIMEDOUT/.test(err.message || '');
  const message = timeout
    ? 'Fichier ou base temporairement indisponible. Réessayez dans un instant.'
    : (err.message || 'Une erreur interne est survenue.');
  if ((req.path || '').startsWith('/api')) {
    return res.status(timeout ? 503 : 500).json({ erreur: message });
  }
  res.status(timeout ? 503 : 500).type('html').send(
    '<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><title>Indisponible</title></head>' +
    '<body><p>Page temporairement indisponible. Rechargez dans un instant.</p></body></html>'
  );
});

module.exports = app;
