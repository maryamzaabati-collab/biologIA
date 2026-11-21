// Documents produits par le site : PDF (certificat, synthèse, fiche patient) et CSV.
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const dbFile = path.join(os.tmpdir(), `labo-docs-${process.pid}-${Date.now()}.db`);
process.env.DATABASE_PATH = dbFile;

const db = require('../database');
require('../lib/alias-db');
const app = require('../application');
const { creerJson } = require('./http');
const { csvAvecBom } = require('../lib/tracabilite');
const { nettoyer } = require('../lib/pdf-maquettes');

let server;
let base;
const etat = { cookie: '' };
const json = creerJson(() => base, etat);

async function telecharger(chemin) {
  const r = await fetch(`${base}${chemin}`, { headers: { Cookie: etat.cookie } });
  return { status: r.status, type: r.headers.get('content-type') || '', octets: Buffer.from(await r.arrayBuffer()) };
}

before(async () => {
  await db.init();
  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', () => { base = `http://127.0.0.1:${server.address().port}`; resolve(); });
  });
  const r = await json('/api/auth/connexion', { method: 'POST', body: JSON.stringify({ identifiant: 'amrani', mot_de_passe: 'labo2026' }) });
  assert.equal(r.status, 200);
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  try { db.fermer(); } catch { /* ignore */ }
  try { fs.unlinkSync(dbFile); } catch { /* ignore */ }
});

describe('PDF', () => {
  it('génère la fiche de synthèse sur une seule page', async () => {
    const r = await telecharger('/api/synthese/pdf');
    assert.equal(r.status, 200);
    assert.ok(r.octets.subarray(0, 5).toString() === '%PDF-');
    const pages = (r.octets.toString('latin1').match(/\/Type \/Page\b/g) || []).length;
    assert.equal(pages, 1);
  });
  it('génère le certificat de chaque lot', async () => {
    const lots = await db.all('SELECT id FROM lots LIMIT 5');
    for (const l of lots) {
      const r = await telecharger(`/api/lots/${l.id}/certificat`);
      assert.equal(r.status, 200, `certificat du lot ${l.id}`);
      assert.ok(r.octets.subarray(0, 5).toString() === '%PDF-');
    }
  });
  it('génère la fiche PDF d’un patient (sans son nom)', async () => {
    const p = await json('/api/patients?taille=10');
    const psn = p.data.identifiants[0].psn;
    const r = await telecharger(`/api/patients/${psn}/pdf`);
    assert.equal(r.status, 200);
    assert.ok(r.octets.subarray(0, 5).toString() === '%PDF-');
  });
  it('refuse un code patient inconnu', async () => {
    const r = await telecharger('/api/patients/PSN-INCONNU99/pdf');
    assert.equal(r.status, 404);
  });
  it('remplace les caractères que la police du PDF ne sait pas écrire', () => {
    assert.equal(nettoyer('≥ 20 points → 1 234'), '>= 20 points -> 1 234');
  });
});

describe('Patients', () => {
  it('liste les patients d’un lot (lien depuis la lignée)', async () => {
    const lot = await db.get('SELECT lot_id, COUNT(DISTINCT code_patient) AS n FROM mesures_reference GROUP BY lot_id LIMIT 1');
    const r = await json(`/api/patients?lot=${lot.lot_id}&taille=100`);
    assert.equal(r.status, 200);
    assert.equal(r.data.total, lot.n);
  });
  it('montre les mesures d’un patient', async () => {
    const p = await json('/api/patients?taille=10');
    const r = await json(`/api/patients/${p.data.identifiants[0].psn}/mesures`);
    assert.equal(r.status, 200);
    assert.ok(r.data.mesures.length >= 1);
    assert.ok(['normal', 'trop bas', 'trop haut', 'sans règle'].includes(r.data.mesures[0].interpretation));
  });
});

describe('CSV', () => {
  it('écrit les nombres à la française et garde les négatifs comme des nombres', () => {
    const t = csvAvecBom([['a', 'b', 'c', 'd'], [-0.35, '0.88', '=SOMME(A1)', 'texte;avec']]);
    assert.ok(t.startsWith('﻿'));
    assert.ok(t.includes('-0,35;0,88;\'=SOMME(A1);"texte;avec"'));
  });
  for (const chemin of ['/api/synthese/csv', '/api/controle/csv', '/api/journal/csv', '/api/patients/export.csv', '/api/reseau/export/qc']) {
    it(`télécharge ${chemin}`, async () => {
      const r = await telecharger(chemin);
      assert.equal(r.status, 200);
      assert.match(r.type, /text\/csv/);
      const texte = r.octets.toString('utf8');
      assert.ok(texte.startsWith('﻿'), 'BOM pour Excel');
      const lignes = texte.slice(1).split('\r\n').filter(Boolean);
      assert.ok(lignes.length >= 2);
      const n = lignes[0].split(';').length;
      assert.ok(lignes.slice(1, 50).every((l) => !l.includes('"') ? l.split(';').length === n : true), 'même nombre de colonnes');
    });
  }
});
