const db = require('./db');
const app = require('./app');

const PORT = process.env.PORT || 3000;

db.init()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Registre de tracabilite lance sur http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Impossible d\'initialiser la base :', err);
    process.exit(1);
  });
