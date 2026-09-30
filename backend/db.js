const path = require('path');
const { ouvrirSqlite } = require('./lib/ouvrir-sqlite');
const { genererCodeVerification } = require('./lib/tracabilite');

const dbPath = process.env.DATABASE_PATH || path.join(__dirname, 'labo.db');
const db = ouvrirSqlite(dbPath);
db.exec('PRAGMA foreign_keys = ON');

function run(sql, params = []) {
  return Promise.resolve().then(() => {
    const info = db.prepare(sql).run(...params);
    return { id: Number(info.lastInsertRowid), changes: info.changes };
  });
}

function get(sql, params = []) {
  return Promise.resolve().then(() => db.prepare(sql).get(...params) || undefined);
}

function all(sql, params = []) {
  return Promise.resolve().then(() => db.prepare(sql).all(...params));
}

async function ajouterColonneSiAbsente(table, colonne, definition) {
  const colonnes = await all(`PRAGMA table_info(${table})`);
  if (!colonnes.some((c) => c.name === colonne)) {
    await run(`ALTER TABLE ${table} ADD COLUMN ${colonne} ${definition}`);
  }
}

async function init() {
  await run(`CREATE TABLE IF NOT EXISTS machines (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nom TEXT NOT NULL,
    type TEXT
  )`);

  await run(`CREATE TABLE IF NOT EXISTS lots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nom TEXT NOT NULL,
    machine_id INTEGER,
    date TEXT,
    conditions TEXT,
    anonymise INTEGER DEFAULT 0,
    statut TEXT DEFAULT 'ok',
    date_creation TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (machine_id) REFERENCES machines(id)
  )`);

  await run(`CREATE TABLE IF NOT EXISTS validations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lot_id INTEGER NOT NULL,
    nom_biologiste TEXT NOT NULL,
    date_validation TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (lot_id) REFERENCES lots(id)
  )`);

  await run(`CREATE TABLE IF NOT EXISTS signalements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lot_id INTEGER NOT NULL,
    raison TEXT NOT NULL,
    date TEXT DEFAULT (datetime('now')),
    resolu INTEGER DEFAULT 0,
    FOREIGN KEY (lot_id) REFERENCES lots(id)
  )`);

  await run(`CREATE TABLE IF NOT EXISTS utilisateurs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nom TEXT NOT NULL,
    role TEXT NOT NULL
  )`);

  await run(`CREATE TABLE IF NOT EXISTS historique_lots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lot_id INTEGER NOT NULL,
    champ TEXT NOT NULL,
    ancienne_valeur TEXT,
    nouvelle_valeur TEXT,
    date TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (lot_id) REFERENCES lots(id)
  )`);

  await run(`CREATE TABLE IF NOT EXISTS regles_alerte (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lot_id INTEGER NOT NULL,
    parametre TEXT NOT NULL,
    seuil_bas TEXT,
    seuil_haut TEXT,
    unite TEXT NOT NULL,
    FOREIGN KEY (lot_id) REFERENCES lots(id)
  )`);

  await ajouterColonneSiAbsente('regles_alerte', 'statut', "TEXT DEFAULT 'a_valider'");
  await ajouterColonneSiAbsente('regles_alerte', 'validee_par', 'TEXT');
  await ajouterColonneSiAbsente('regles_alerte', 'date_validation_regle', 'TEXT');
  await run(`CREATE TABLE IF NOT EXISTS journal_audit (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    utilisateur_id INTEGER,
    nom_affiche TEXT,
    action TEXT NOT NULL,
    cible TEXT,
    details TEXT,
    date TEXT DEFAULT (datetime('now'))
  )`);
  await ajouterColonneSiAbsente('lots', 'colonnes_csv', 'TEXT');
  await ajouterColonneSiAbsente('lots', 'alerte_identite', 'INTEGER DEFAULT 0');
  await ajouterColonneSiAbsente('lots', 'code_verification', 'TEXT');
  await ajouterColonneSiAbsente('lots', 'moyenne_controle', 'REAL');
  await ajouterColonneSiAbsente('lots', 'valeurs_controle', 'TEXT');

  const sansCode = await all(
    "SELECT id FROM lots WHERE code_verification IS NULL OR code_verification = ''"
  );
  for (const lot of sansCode) {
    await run('UPDATE lots SET code_verification = ? WHERE id = ?', [genererCodeVerification(), lot.id]);
  }
  await run('CREATE UNIQUE INDEX IF NOT EXISTS idx_lots_code ON lots(code_verification)');

  const { n } = await get('SELECT COUNT(*) AS n FROM utilisateurs');
  if (!n) {
    const seed = [
      ['Dr. Amrani', 'biologiste'],
      ['Dr. Chen', 'biologiste'],
      ['Dr. El Fassi', 'biologiste'],
      ['Samira K.', 'technicien'],
      ['Yanis B.', 'technicien']
    ];
    for (const [nom, role] of seed) {
      await run('INSERT INTO utilisateurs (nom, role) VALUES (?, ?)', [nom, role]);
    }
  }
}

module.exports = { run, get, all, init, dbPath, fermer };

function fermer() {
  try { db.close(); } catch { /* deja fermee */ }
}
