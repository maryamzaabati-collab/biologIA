const path = require('path');
const os = require('os');
const fs = require('fs');
const { ouvrirSqlite } = require('./lib/ouvrir-sqlite');
const { hasherMotDePasse } = require('./lib/motdepasse');
const { problemesLot, colonnesSensibles } = require('./lib/tracabilite');

function genererCodeVerification() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'LT-';
  for (let i = 0; i < 8; i++) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return code;
}

function cheminBase() {
  if (process.env.DATABASE_PATH) return process.env.DATABASE_PATH;
  const dossier = path.join(os.homedir(), '.labo-tracabilite');
  fs.mkdirSync(dossier, { recursive: true });
  const cible = path.join(dossier, 'labo.db');
  const copieOneDrive = path.join(__dirname, 'labo.db');
  if (!fs.existsSync(cible) && fs.existsSync(copieOneDrive)) {
    try { fs.copyFileSync(copieOneDrive, cible); } catch { /* OneDrive parfois indisponible */ }
  }
  return cible;
}

const dbPath = cheminBase();
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
    role TEXT NOT NULL,
    identifiant TEXT,
    mot_de_passe TEXT
  )`);

  await run(`CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    utilisateur_id INTEGER NOT NULL,
    expire_le TEXT NOT NULL,
    FOREIGN KEY (utilisateur_id) REFERENCES utilisateurs(id)
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

  await run(`CREATE TABLE IF NOT EXISTS journal_audit (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    utilisateur_id INTEGER,
    nom_affiche TEXT,
    action TEXT NOT NULL,
    cible TEXT,
    details TEXT,
    date TEXT DEFAULT (datetime('now'))
  )`);

  await ajouterColonneSiAbsente('regles_alerte', 'statut', "TEXT DEFAULT 'a_valider'");
  await ajouterColonneSiAbsente('regles_alerte', 'validee_par', 'TEXT');
  await ajouterColonneSiAbsente('regles_alerte', 'date_validation_regle', 'TEXT');
  await run("UPDATE regles_alerte SET statut = 'a_valider' WHERE statut IS NULL OR statut = ''");
  await ajouterColonneSiAbsente('lots', 'colonnes_csv', 'TEXT');
  await ajouterColonneSiAbsente('lots', 'alerte_identite', 'INTEGER DEFAULT 0');
  await ajouterColonneSiAbsente('lots', 'code_verification', 'TEXT');
  await ajouterColonneSiAbsente('lots', 'moyenne_controle', 'REAL');
  await ajouterColonneSiAbsente('lots', 'valeurs_controle', 'TEXT');
  await ajouterColonneSiAbsente('utilisateurs', 'identifiant', 'TEXT');
  await ajouterColonneSiAbsente('utilisateurs', 'mot_de_passe', 'TEXT');
  await ajouterColonneSiAbsente('utilisateurs', 'email', 'TEXT');
  await ajouterColonneSiAbsente('utilisateurs', 'statut', "TEXT DEFAULT 'valide'");
  await ajouterColonneSiAbsente('utilisateurs', 'role_demande', 'TEXT');
  await ajouterColonneSiAbsente('utilisateurs', 'google_id', 'TEXT');

  const sansCode = await all(
    "SELECT id FROM lots WHERE code_verification IS NULL OR code_verification = ''"
  );
  for (const lot of sansCode) {
    await run('UPDATE lots SET code_verification = ? WHERE id = ?', [genererCodeVerification(), lot.id]);
  }
  await run('CREATE UNIQUE INDEX IF NOT EXISTS idx_lots_code ON lots(code_verification)');

  const comptes = [
    ['amrani', 'Dr. Amrani', 'biologiste'],
    ['chen', 'Dr. Chen', 'biologiste'],
    ['elfassi', 'Dr. El Fassi', 'biologiste'],
    ['samira', 'Samira K.', 'technicien'],
    ['yanis', 'Yanis B.', 'technicien']
  ];
  const motDePasseDemo = hasherMotDePasse('labo2026');
  for (const [identifiant, nom, role] of comptes) {
    const existant = await get(
      'SELECT id, mot_de_passe FROM utilisateurs WHERE identifiant = ? OR nom = ?',
      [identifiant, nom]
    );
    if (!existant) {
      await run(
        `INSERT INTO utilisateurs (nom, role, identifiant, mot_de_passe, statut, role_demande)
         VALUES (?, ?, ?, ?, 'valide', ?)`,
        [nom, role, identifiant, motDePasseDemo, role]
      );
    } else {
      await run(
        `UPDATE utilisateurs SET identifiant = COALESCE(identifiant, ?),
          mot_de_passe = COALESCE(NULLIF(mot_de_passe, ''), ?),
          role = ?, statut = COALESCE(NULLIF(statut, ''), 'valide'),
          role_demande = COALESCE(role_demande, ?)
         WHERE id = ?`,
        [identifiant, motDePasseDemo, role, role, existant.id]
      );
    }
  }

  const lotsExistants = await all('SELECT * FROM lots');
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
    await run('UPDATE lots SET statut = ? WHERE id = ?', [problemes.length ? 'douteux' : 'ok', lot.id]);
    await run('DELETE FROM signalements WHERE lot_id = ?', [lot.id]);
    for (const raison of problemes) {
      await run('INSERT INTO signalements (lot_id, raison) VALUES (?, ?)', [lot.id, raison]);
    }
  }
}

module.exports = { run, get, all, init, dbPath, fermer };

function fermer() {
  try { db.close(); } catch { /* deja fermee */ }
}
