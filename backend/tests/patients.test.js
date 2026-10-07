const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const dbFile = path.join(os.tmpdir(), `labo-patients-${process.pid}-${Date.now()}.db`);
process.env.DATABASE_PATH = dbFile;

const db = require('../database');
require('../lib/alias-db');
const app = require('../application');
const { composerNumero, analyserNumero, detecterDoublons, normaliserNom } = require('../lib/patients');

let server;
let base;
let cookie = '';

before(async () => {
  await db.init();
  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', () => {
      base = `http://127.0.0.1:${server.address().port}`;
      resolve();
    });
  });
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  try { db.fermer(); } catch { /* ignore */ }
  try { fs.unlinkSync(dbFile); } catch { /* ignore */ }
});

async function json(chemin, options = {}) {
  const r = await fetch(`${base}${chemin}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(cookie ? { Cookie: cookie } : {}),
      ...(options.headers || {})
    },
    ...options
  });
  const set = r.headers.get('set-cookie');
  if (set) cookie = set.split(';')[0];
  const type = r.headers.get('content-type') || '';
  const data = type.includes('json') ? await r.json().catch(() => ({})) : await r.text();
  return { status: r.status, data };
}

async function connexion(identifiant) {
  cookie = '';
  return json('/api/auth/connexion', {
    method: 'POST',
    body: JSON.stringify({ identifiant, mot_de_passe: 'labo2026' })
  });
}

describe('numero patient', () => {
  it('calcule et verifie le chiffre de controle', () => {
    const n = composerNumero(2026, 123);
    assert.match(n, /^NP-2026-\d{6}$/);
    assert.equal(analyserNumero(n).ok, true);
    const mauvais = n.slice(0, -1) + String((Number(n.slice(-1)) + 1) % 10);
    assert.equal(analyserNumero(mauvais).ok, false);
    assert.equal(analyserNumero(mauvais).raison, 'controle');
  });

  it('normalise les noms sans accents ni casse', () => {
    assert.equal(normaliserNom('Léa'), normaliserNom('LEA'));
  });

  it('detecte un doublon exact et un nom a une lettre pres', () => {
    const existants = [{ nom: 'Martin', date_naissance: '1998-05-12' }];
    const exact = detecterDoublons({ nom: 'MARTIN', date_naissance: '1998-05-12' }, existants);
    assert.equal(exact.exact.length, 1);
    const proche = detecterDoublons({ nom: 'Martan', date_naissance: '1998-05-12' }, existants);
    assert.equal(proche.proches.length, 1);
  });
});

describe('routes patients', () => {
  it('seed au moins 60 patients fictifs', async () => {
    const n = await db.get('SELECT COUNT(*) AS n FROM patients_identite');
    assert.ok(Number(n.n) >= 60);
  });

  it('GET /api/patients ne liste aucune identite, meme biologiste', async () => {
    await connexion('amrani');
    const r = await json('/api/patients');
    assert.equal(r.status, 200);
    assert.ok(Array.isArray(r.data.identifiants));
    assert.equal(r.data.identites, undefined);
    const brut = JSON.stringify(r.data);
    assert.equal(/nir_fictif|"nom":|"prenom":/.test(brut), false);
    const un = r.data.identifiants[0];
    assert.ok(un.psn);
    assert.ok(un.numero_patient);
    assert.equal(un.identite_masquee, true);
  });

  it('technicien voit le PSN et le nombre de mesures, pas le numero', async () => {
    await connexion('samira');
    const r = await json('/api/patients');
    assert.equal(r.status, 200);
    const un = r.data.identifiants[0];
    assert.ok(un.psn);
    assert.equal(un.numero_patient, undefined);
    assert.equal('nb_mesures' in un, true);
  });

  it('identifie par numero sans renvoyer le nom', async () => {
    await connexion('samira');
    const un = await db.get('SELECT numero_patient FROM patients_identite WHERE numero_patient IS NOT NULL LIMIT 1');
    const r = await json('/api/patients/identifier', {
      method: 'POST',
      body: JSON.stringify({ numero_patient: un.numero_patient })
    });
    assert.equal(r.status, 200);
    assert.equal(r.data.trouve, true);
    assert.match(r.data.psn, /^PSN-/);
    assert.equal(r.data.identite, undefined);
    assert.equal(/nom|prenom/i.test(JSON.stringify(r.data)), false);
  });

  it('refuse un numero au mauvais chiffre de controle', async () => {
    await connexion('samira');
    const un = await db.get('SELECT numero_patient FROM patients_identite WHERE numero_patient IS NOT NULL LIMIT 1');
    const mauvais = un.numero_patient.slice(0, -1) + String((Number(un.numero_patient.slice(-1)) + 1) % 10);
    const r = await json('/api/patients/identifier', {
      method: 'POST',
      body: JSON.stringify({ numero_patient: mauvais })
    });
    assert.equal(r.data.trouve, false);
    assert.equal(r.data.refuse, true);
  });

  it('interdit au technicien d afficher une identite (403)', async () => {
    await connexion('samira');
    const un = await db.get(
      'SELECT COALESCE(psn, code) AS psn FROM patients_pseudo LIMIT 1'
    );
    const r = await json('/api/patients/afficher-identite', {
      method: 'POST',
      body: JSON.stringify({ psn: un.psn, motif: 'contrôle pédagogique' })
    });
    assert.equal(r.status, 403);
  });

  it('le biologiste affiche une identite avec motif, journalise', async () => {
    await connexion('amrani');
    const un = await db.get(
      'SELECT COALESCE(psn, code) AS psn FROM patients_pseudo LIMIT 1'
    );
    const r = await json('/api/patients/afficher-identite', {
      method: 'POST',
      body: JSON.stringify({ psn: un.psn, motif: 'contrôle pédagogique' })
    });
    assert.equal(r.status, 200);
    assert.ok(r.data.identite.nom);
    const j = await db.get(
      "SELECT * FROM journal_audit WHERE action = 'affichage identité' ORDER BY id DESC LIMIT 1"
    );
    assert.ok(j);
    assert.match(String(j.details), /motif=contrôle pédagogique/);
  });

  it('bloque un doublon a la creation', async () => {
    await connexion('amrani');
    const un = await db.get('SELECT nom, prenom, date_naissance FROM patients_identite LIMIT 1');
    const r = await json('/api/patients', {
      method: 'POST',
      body: JSON.stringify({
        nom: un.nom,
        prenom: 'Autre',
        date_naissance: un.date_naissance,
        sexe: 'F',
        ville: 'Paris',
        code_postal: '75012'
      })
    });
    assert.equal(r.status, 409);
    assert.equal(r.data.doublon, true);
  });

  it('signale un PSN inconnu a l import CSV', async () => {
    await connexion('samira');
    const machines = await json('/api/machines');
    const cree = await json('/api/lots', {
      method: 'POST',
      body: JSON.stringify({
        nom: 'LOT-2026-801',
        machine_id: machines.data[0].id,
        date: '2026-03-01',
        temperature: '21°C',
        lot_reactifs: 'R-441',
        calibration: 'matin',
        anonymise: true,
        csv_texte: 'code_patient;parametre;valeur;unite;date\nPSN-ZZZZZZZZ;Glycémie à jeun;0.90;g/L;2026-03-01'
      })
    });
    assert.equal(cree.status, 201);
    const sig = await db.all(
      'SELECT raison FROM signalements WHERE lot_id = ?',
      [cree.data.id]
    );
    assert.ok(sig.some((s) => /PSN inconnu/i.test(s.raison)));
  });
});
