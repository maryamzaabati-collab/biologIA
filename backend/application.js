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
    const lots = await db.get('SELECT COUNT(*) AS n FROM lots');
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

app.get('/app.js', (req, res) => {
  try {
    const base = fs.readFileSync(path.join(__dirname, '..', 'frontend', 'app.js'), 'utf8');
    const extra = fs.readFileSync(path.join(__dirname, '..', 'frontend', 'session-extra.js'), 'utf8');
    res.setHeader('Cache-Control', 'no-store');
    res.type('application/javascript').send(base + '\n' + extra);
  } catch (err) {
    res.status(500).type('text').send('/* ' + err.message + ' */');
  }
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'frontend', 'connexion.html'));
});

app.use(express.static(path.join(__dirname, '..', 'frontend'), { etag: false, maxAge: 0 }));

app.use('/api/auth', require('./routes/auth'));
app.use('/api', exigerConnexion);
app.use('/api', (req, res, next) => {
  if (req.method === 'GET' || req.method === 'HEAD') return next();
  const url = req.originalUrl || '';
  const role = req.utilisateur && req.utilisateur.role;
  if (url.includes('/comptes')) {
    if (role !== 'biologiste') {
      return res.status(403).json({ erreur: 'Seuls les biologistes peuvent valider les comptes.' });
    }
    return next();
  }
  if (url.includes('/tester')) return next();
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
  if (['POST', 'PUT', 'DELETE'].includes(req.method) && role !== 'technicien') {
    return res.status(403).json({ erreur: 'Seuls les techniciens connectés peuvent modifier les lots, machines et règles.' });
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
app.use('/api/comptes', (req, res, next) => {
  if (!req.utilisateur || req.utilisateur.role !== 'biologiste') {
    return res.status(403).json({ erreur: 'Seuls les biologistes peuvent valider les comptes.' });
  }
  next();
}, require('./routes/comptes'));

module.exports = app;
