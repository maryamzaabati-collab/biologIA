const db = require('./database');
require('./lib/alias-db');
const app = require('./application');

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

db.init()
  .then(() => {
    app.listen(PORT, HOST, () => {
      console.log(`biologIA lancé sur http://${HOST}:${PORT}`);
      console.log('Base :', db.dbPath);
    });
  })
  .catch((err) => {
    console.error('Impossible d\'initialiser la base :', err);
    process.exit(1);
  });
