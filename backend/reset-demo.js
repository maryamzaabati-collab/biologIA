const db = require('./database');
const { remplir } = require('./lib/donnees-demo');

async function viderDonneesMetier() {
  await db.run('DELETE FROM regles_alerte');
  await db.run('DELETE FROM historique_lots');
  await db.run('DELETE FROM signalements');
  await db.run('DELETE FROM validations');
  await db.run('DELETE FROM lots');
  await db.run('DELETE FROM machines');
  try {
    await db.run(
      "DELETE FROM sqlite_sequence WHERE name IN ('lots','machines','signalements','validations','historique_lots','regles_alerte')"
    );
  } catch {
    /* sqlite_sequence absente sur certaines bases */
  }
}

async function main() {
  await db.init();
  await viderDonneesMetier();
  await remplir({ run: db.run, get: db.get, all: db.all });
  const lotsExistants = await db.all('SELECT * FROM lots');
  const { problemesLot, colonnesSensibles } = require('./lib/tracabilite');
  for (const lot of lotsExistants) {
    let sensibles = [];
    if (lot.colonnes_csv) {
      try { sensibles = colonnesSensibles(JSON.parse(lot.colonnes_csv) || []); } catch { sensibles = []; }
    }
    const problemes = problemesLot({
      machine_id: lot.machine_id,
      date: lot.date,
      conditions: lot.conditions,
      anonymise: lot.anonymise,
      sensibles
    });
    await db.run('UPDATE lots SET statut = ? WHERE id = ?', [problemes.length ? 'douteux' : 'ok', lot.id]);
    await db.run('DELETE FROM signalements WHERE lot_id = ?', [lot.id]);
    for (const raison of problemes) {
      await db.run('INSERT INTO signalements (lot_id, raison) VALUES (?, ?)', [lot.id, raison]);
    }
  }
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
