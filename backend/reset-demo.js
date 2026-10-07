const db = require('./database');
const { remplir } = require('./lib/donnees-demo');

async function viderDonneesMetier() {
  await db.run('DELETE FROM regles_alerte');
  await db.run('DELETE FROM historique_lots');
  await db.run('DELETE FROM signalements');
  await db.run('DELETE FROM validations');
  await db.run('DELETE FROM mesures_reference');
  await db.run('DELETE FROM patients_pseudo');
  await db.run('DELETE FROM patients_identite');
  await db.run('DELETE FROM lots');
  await db.run('DELETE FROM machines');
  try {
    await db.run(
      "DELETE FROM sqlite_sequence WHERE name IN ('lots','machines','signalements','validations','historique_lots','regles_alerte','patients_identite','patients_pseudo','mesures_reference')"
    );
  } catch {
    /* sqlite_sequence absente sur certaines bases */
  }
}

async function main() {
  await db.init();
  await viderDonneesMetier();
  await remplir({ run: db.run, get: db.get, all: db.all });
  const machines = await db.get('SELECT COUNT(*) AS n FROM machines');
  const lots = await db.get('SELECT COUNT(*) AS n FROM lots');
  const signalements = await db.get('SELECT COUNT(*) AS n FROM signalements WHERE resolu = 0');
  console.log(`Démo rechargée — machines : ${machines.n}, lots : ${lots.n}, signalements : ${signalements.n}`);
  console.log('Base :', db.dbPath);
  db.fermer();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
