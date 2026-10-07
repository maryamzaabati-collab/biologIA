const path = require('path');
const os = require('os');
const fs = require('fs');
const { ouvrirSqlite } = require('./lib/ouvrir-sqlite');
const { hasherMotDePasse } = require('./lib/motdepasse');

function genererCodeVerification() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'LT-';
  for (let i = 0; i < 8; i++) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return code;
}

function cheminEcriture(dossier) {
  fs.mkdirSync(dossier, { recursive: true });
  fs.accessSync(dossier, fs.constants.W_OK);
  return dossier;
}

function cheminBase() {
  if (process.env.DATABASE_PATH) return process.env.DATABASE_PATH;
  const candidats = [
    path.join(os.homedir(), '.labo-tracabilite'),
    path.join('/tmp', 'labo-tracabilite'),
    path.join(__dirname, 'data')
  ];
  let dossier;
  for (const candidat of candidats) {
    try {
      dossier = cheminEcriture(candidat);
      break;
    } catch {
      dossier = null;
    }
  }
  if (!dossier) dossier = '/tmp';
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
    const brut = info.lastInsertRowid ?? info.lastInsertRowId ?? 0;
    return { id: Number(brut), changes: Number(info.changes || 0) };
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
  await ajouterColonneSiAbsente('lots', 'dates_controle', 'TEXT');
  await ajouterColonneSiAbsente('lots', 'archive', 'INTEGER DEFAULT 0');
  await ajouterColonneSiAbsente('lots', 'est_test', 'INTEGER DEFAULT 0');
  await ajouterColonneSiAbsente('lots', 'createur_id', 'INTEGER');
  await ajouterColonneSiAbsente('lots', 'modifie_apres_validation', 'INTEGER DEFAULT 0');
  await ajouterColonneSiAbsente('historique_lots', 'utilisateur', 'TEXT');
  await ajouterColonneSiAbsente('historique_lots', 'motif', 'TEXT');
  await ajouterColonneSiAbsente('signalements', 'justification', 'TEXT');
  await ajouterColonneSiAbsente('machines', 'date_calibration', 'TEXT');
  await ajouterColonneSiAbsente('machines', 'statut_service', "TEXT DEFAULT 'en_service'");
  await ajouterColonneSiAbsente('utilisateurs', 'identifiant', 'TEXT');
  await ajouterColonneSiAbsente('utilisateurs', 'mot_de_passe', 'TEXT');
  await ajouterColonneSiAbsente('utilisateurs', 'email', 'TEXT');
  await ajouterColonneSiAbsente('utilisateurs', 'statut', "TEXT DEFAULT 'valide'");
  await ajouterColonneSiAbsente('utilisateurs', 'role_demande', 'TEXT');
  await ajouterColonneSiAbsente('utilisateurs', 'google_id', 'TEXT');

  await run(`CREATE TABLE IF NOT EXISTS tentatives_connexion (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    identifiant TEXT NOT NULL,
    reussie INTEGER DEFAULT 0,
    date TEXT DEFAULT (datetime('now'))
  )`);

  await run(`CREATE TABLE IF NOT EXISTS patients_identite (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nom TEXT NOT NULL,
    prenom TEXT NOT NULL,
    date_naissance TEXT,
    sexe TEXT,
    nir_fictif TEXT,
    departement TEXT
  )`);

  await run(`CREATE TABLE IF NOT EXISTS patients_pseudo (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE,
    patient_id INTEGER NOT NULL,
    psn TEXT UNIQUE,
    identite_id INTEGER UNIQUE,
    FOREIGN KEY (patient_id) REFERENCES patients_identite(id),
    FOREIGN KEY (identite_id) REFERENCES patients_identite(id)
  )`);

  await run(`CREATE TABLE IF NOT EXISTS mesures_reference (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code_patient TEXT NOT NULL,
    parametre TEXT,
    valeur REAL,
    unite TEXT,
    date TEXT,
    lot_id INTEGER
  )`);

  await ajouterColonneSiAbsente('patients_identite', 'numero_patient', 'TEXT');
  await ajouterColonneSiAbsente('patients_identite', 'ville', 'TEXT');
  await ajouterColonneSiAbsente('patients_identite', 'code_postal', 'TEXT');
  await ajouterColonneSiAbsente('patients_identite', 'cree_par', 'TEXT');
  await ajouterColonneSiAbsente('patients_identite', 'cree_le', 'TEXT');
  await ajouterColonneSiAbsente('patients_pseudo', 'psn', 'TEXT');
  await ajouterColonneSiAbsente('patients_pseudo', 'identite_id', 'INTEGER');
  await run('CREATE UNIQUE INDEX IF NOT EXISTS idx_patients_numero ON patients_identite(numero_patient)');
  await run('CREATE UNIQUE INDEX IF NOT EXISTS idx_patients_psn ON patients_pseudo(psn)');
  await run('CREATE UNIQUE INDEX IF NOT EXISTS idx_patients_identite_id ON patients_pseudo(identite_id)');
  await run(`UPDATE patients_pseudo SET psn = code WHERE psn IS NULL OR psn = ''`);
  await run(`UPDATE patients_pseudo SET identite_id = patient_id WHERE identite_id IS NULL`);

  const sansCode = await all(
    "SELECT id FROM lots WHERE code_verification IS NULL OR code_verification = ''"
  );
  for (const lot of sansCode) {
    await run('UPDATE lots SET code_verification = ? WHERE id = ?', [genererCodeVerification(), lot.id]);
  }
  await run('CREATE UNIQUE INDEX IF NOT EXISTS idx_lots_code ON lots(code_verification)');

  const comptes = [
    ['amrani', 'Dr. Amrani', 'biologiste', 'amrani@labo-demo.fr'],
    ['chen', 'Dr. Chen', 'biologiste', 'chen@labo-demo.fr'],
    ['elfassi', 'Dr. El Fassi', 'biologiste', 'elfassi@labo-demo.fr'],
    ['samira', 'Samira K.', 'technicien', 'samira@labo-demo.fr'],
    ['yanis', 'Yanis B.', 'technicien', 'yanis@labo-demo.fr'],
    ['lea', 'Léa Martin', 'client', 'lea@labo-demo.fr']
  ];
  const motDePasseDemo = hasherMotDePasse('labo2026');
  for (const [identifiant, nom, role, email] of comptes) {
    const existant = await get(
      'SELECT id, mot_de_passe FROM utilisateurs WHERE identifiant = ? OR nom = ?',
      [identifiant, nom]
    );
    if (!existant) {
      await run(
        `INSERT INTO utilisateurs (nom, role, identifiant, mot_de_passe, email, statut, role_demande)
         VALUES (?, ?, ?, ?, ?, 'valide', ?)`,
        [nom, role, identifiant, motDePasseDemo, email, role]
      );
    } else {
      await run(
        `UPDATE utilisateurs SET identifiant = COALESCE(identifiant, ?),
          mot_de_passe = COALESCE(NULLIF(mot_de_passe, ''), ?),
          role = ?, statut = COALESCE(NULLIF(statut, ''), 'valide'),
          role_demande = COALESCE(role_demande, ?),
          email = COALESCE(NULLIF(email, ''), ?)
         WHERE id = ?`,
        [identifiant, motDePasseDemo, role, role, email, existant.id]
      );
    }
  }

  try {
    await require('./lib/donnees-demo').remplir({ run, get, all });
  } catch (err) {
    console.error('Chargement des données de démonstration :', err);
  }
}

module.exports = { run, get, all, init, dbPath, fermer };

function fermer() {
  try { db.close(); } catch { /* deja fermee */ }
}
