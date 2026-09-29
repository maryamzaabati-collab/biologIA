const express = require('express');
const path = require('path');

const app = express();

app.use(express.json({ limit: '2mb' }));
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'frontend', 'accueil.html'));
});
app.use(express.static(path.join(__dirname, '..', 'frontend')));

app.use('/api/machines', require('./routes/machines'));
app.use('/api/lots', require('./routes/lots'));
app.use('/api/signalements', require('./routes/signalements'));
app.use('/api/synthese', require('./routes/synthese'));
app.use('/api/utilisateurs', require('./routes/utilisateurs'));
app.use('/api/regles_alerte', require('./routes/regles_alerte'));
app.use('/api/controle', require('./routes/controle'));
app.use('/api/recherche', require('./routes/recherche'));

module.exports = app;
