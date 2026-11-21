const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const dbFile = path.join(os.tmpdir(), `labo-reseau-${process.pid}-${Date.now()}.db`);
process.env.DATABASE_PATH = dbFile;

const db = require('../database');
require('../lib/alias-db');
const app = require('../application');
const { creerJson } = require('./http');
const { reglesWestgard, construireJeu, ANALYTES } = require('../lib/donnees-reseau');

let server;
let base;
const etat = { cookie: '' };
const json = creerJson(() => base, etat);

before(async () => {
  await db.init();
  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', () => {
      base = `http://127.0.0.1:${server.address().port}`;
      resolve();
    });
  });
  const r = await json('/api/auth/connexion', { method: 'POST', body: JSON.stringify({ identifiant: 'lea', mot_de_passe: 'labo2026' }) });
  assert.equal(r.status, 200);
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  try { db.fermer(); } catch { /* ignore */ }
  try { fs.unlinkSync(dbFile); } catch { /* ignore */ }
});

describe('Règles de Westgard', () => {
  it('rejette un point au-delà de 3 écarts-types', () => {
    assert.ok(reglesWestgard([], 3.4, 0.2).rejet.includes('1-3s'));
  });
  it('rejette deux niveaux au-delà de 2 écarts-types du même côté', () => {
    assert.ok(reglesWestgard([], 2.3, 2.1).rejet.includes('2-2s'));
  });
  it('rejette un écart de plus de 4 écarts-types entre les niveaux', () => {
    assert.ok(reglesWestgard([], 2.2, -2.1).rejet.includes('R-4s'));
  });
  it('ne fait qu’avertir pour un point entre 2 et 3 écarts-types', () => {
    const r = reglesWestgard([], 2.4, 0.1);
    assert.equal(r.rejet.length, 0);
    assert.equal(r.avert, true);
  });
});

describe('Jeu de données du réseau', () => {
  it('est reproductible (graine fixe)', () => {
    const a = construireJeu();
    const b = construireJeu();
    assert.equal(a.qc.length, b.qc.length);
    assert.deepEqual(a.qc.slice(0, 50), b.qc.slice(0, 50));
  });
  it('détecte chaque dérive simulée avant la revue mensuelle', () => {
    const { derives } = construireJeu();
    assert.equal(derives.length, 8);
    for (const d of derives) {
      assert.ok(d.detection, `dérive ${d.analyseur} non détectée`);
      assert.ok(d.detection <= d.revue_mensuelle);
    }
  });
  it('reprend les volumes nationaux réels de la Cnam', () => {
    const hb = ANALYTES.find((a) => a.code === 'HB');
    assert.equal(hb.actes_s1_2026, 35921622);
  });
});

describe('API /api/reseau', () => {
  it('résume le réseau (lecture autorisée au rôle client)', async () => {
    const r = await json('/api/reseau/resume');
    assert.equal(r.status, 200);
    assert.equal(r.data.sites, 20);
    assert.ok(r.data.controles_qc > 100000);
    assert.ok(r.data.depense_remboursee_estimee > 0);
    assert.ok(r.data.resultats_exposes_avec < r.data.resultats_exposes_sans);
  });
  it('relie chaque dérive à au moins un lot de référence à revalider', async () => {
    const r = await json('/api/reseau/derives');
    assert.equal(r.status, 200);
    for (const d of r.data) {
      assert.ok(d.lots_impactes.length >= 1);
      assert.ok(d.lots_impactes.every((l) => ['a_revalider', 'revalide'].includes(l.statut)));
    }
  });
  it('calcule un Sigma pour chaque couple analyseur × analyse', async () => {
    const r = await json('/api/reseau/performance');
    assert.equal(r.status, 200);
    assert.equal(r.data.length, 115);
    assert.ok(r.data.every((p) => Number.isFinite(p.sigma) && p.regles_conseillees));
  });
  it('vérifie le k-anonymat des résultats patients après regroupement', async () => {
    const r = await json('/api/reseau/resultats?analyte=HB');
    assert.equal(r.status, 200);
    assert.ok(r.data.n > 1000);
    assert.equal(r.data.k_anonymat.respecte, true);
    assert.ok(r.data.k_anonymat.par_departement.k_min >= 5);
  });
  it('exporte un CSV avec BOM', async () => {
    const r = await json('/api/reseau/export/sites');
    assert.equal(r.status, 200);
    assert.ok(String(r.data).includes('code;nom;ville'));
  });
  it('refuse un jeu de données inconnu', async () => {
    const r = await json('/api/reseau/export/inconnu');
    assert.equal(r.status, 404);
  });
  it('exige une connexion', async () => {
    const r = await fetch(`${base}/api/reseau/resume`);
    assert.equal(r.status, 401);
  });
});
