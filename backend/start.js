const db = require('./database');
const app = require('./application');

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

db.init()
  .then(async () => {
    const machines = await db.get('SELECT COUNT(*) AS n FROM machines');
    const lots = await db.get('SELECT COUNT(*) AS n FROM lots');
    const signalements = await db.get('SELECT COUNT(*) AS n FROM signalements WHERE resolu = 0');
    console.log(
      `Base prête — machines : ${machines && machines.n}, lots : ${lots && lots.n}, signalements ouverts : ${signalements && signalements.n}`
    );
    app.listen(PORT, HOST, () => {
      console.log(`biologIA lancé sur http://${HOST}:${PORT}`);
      console.log('Base :', db.dbPath);
    });
  })
  .catch((err) => {
    console.error('Impossible d\'initialiser la base :', err);
    process.exit(1);
  });
