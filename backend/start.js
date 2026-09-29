const db = require('./database');
require('./lib/alias-db');
const app = require('./application');

const PORT = process.env.PORT || 3000;

db.init()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Registre de tracabilite lance sur http://localhost:${PORT}`);
      console.log('Base :', db.dbPath);
    });
  })
  .catch((err) => {
    console.error('Impossible d\'initialiser la base :', err);
    process.exit(1);
  });
