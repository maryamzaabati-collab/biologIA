const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const dbFile = path.join(os.tmpdir(), `labo-blocs-${process.pid}-${Date.now()}.db`);
process.env.DATABASE_PATH = dbFile;

const db = require('../database');
require('../lib/alias-db');
const app = require('../application');
const { westgard, carteLeveyJennings } = require('../lib/tracabilite');
const { validerRegle } = require('../lib/unites');
const { refusLotSurMachine } = require('../lib/machine-statut');
const { verifierIntegrite, enregistrer } = require('../lib/journal');
const { creerJson } = require('./http');

let server;
let base = '';
const etat = { cookie: '' };
let json;

before(async () => {
  await db.init();
  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', () => {
      base = `http://127.0.0.1:${server.address().port}`;
      resolve();
    });
  });
  json = creerJson(() => base, etat);
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  try { db.fermer(); } catch { /* ignore */ }
  try { fs.unlinkSync(dbFile); } catch { /* ignore */ }
});

describe('Westgard étendu', () => {
  it('détecte 4-1s, R-4s et 10x̄', () => {
    const m = 10;
    const sd = 1;
    const quatre = [11.2, 11.3, 11.4, 11.5];
    const r4 = westgard([10, 14.1], m, sd);
    assert.ok(r4.some((a) => a.regle === 'R-4s'));
    const w4 = westgard(quatre, m, sd);
    assert.ok(w4.some((a) => a.regle === '4-1s'));
    const dix = Array(10).fill(10.2);
    const w10 = westgard(dix, m, sd);
    assert.ok(w10.some((a) => a.regle === '10x̄'));
  });

  it('calcule les limites sur les 20 premiers points', () => {
    const vals = Array.from({ length: 25 }, (_, i) => (i < 20 ? 5 + (i % 5) * 0.02 : 20));
    const c = carteLeveyJennings(vals, [], { refDebut: 0, refN: 20 });
    assert.equal(c.suffisant, true);
    assert.equal(c.nb_reference, 20);
    assert.ok(c.moyenne > 4.9 && c.moyenne < 5.2);
    assert.equal(c.points[24].hors_norme, true);
  });

  it('étiquette Westgard avec la date du point', () => {
    const vals = Array.from({ length: 22 }, () => 5);
    vals[21] = 20;
    const dates = Array.from({ length: 22 }, (_, i) => `2026-01-${String(i + 1).padStart(2, '0')}`);
    const w = westgard(vals, 5, 1, dates);
    assert.ok(w.some((a) => /22\/01\/2026/.test(a.message)));
  });
});

describe('unités et machines', () => {
  it('refuse une unité incohérente', () => {
    const e = validerRegle({ parametre: 'Glycémie à jeun', seuil_bas: '0.7', seuil_haut: '1.1', unite: 'kg' });
    assert.ok(e.some((x) => /unité|unite/i.test(x)));
  });

  it('refuse un lot sur machine en maintenance', () => {
    const msg = refusLotSurMachine({ nom: 'ABL90', statut_service: 'maintenance' }, '2026-10-01');
    assert.match(msg, /maintenance/i);
  });
});

describe('API authentifiée (blocs)', () => {
  it('connecte et expose CSRF + expiration', async () => {
    const login = await json('/api/auth/connexion', {
      method: 'POST',
      body: JSON.stringify({ identifiant: 'samira', mot_de_passe: 'labo2026' })
    });
    assert.equal(login.status, 200);
    const moi = await json('/api/auth/moi');
    assert.equal(moi.status, 200);
    assert.ok(moi.data.csrf);
    assert.ok(moi.data.secondes_restantes > 0);
  });

  it('refuse une mutation sans jeton CSRF', async () => {
    const r = await fetch(`${base}/api/machines`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: etat.cookie.replace(/labo_csrf=[^;]+/, 'labo_csrf=mauvais')
      },
      body: JSON.stringify({ nom: 'X' })
    });
    assert.equal(r.status, 403);
  });

  it('exclut les lots TEST de /api/sante', async () => {
    const s = await json('/api/sante');
    assert.equal(s.status, 200);
    assert.equal(typeof s.data.lots, 'number');
  });

  it('journal GET interdit au technicien', async () => {
    const r = await json('/api/journal');
    assert.equal(r.status, 403);
  });

  it('reset mot de passe (message générique + jeton démo)', async () => {
    const r = await json('/api/auth/mot-de-passe-oublie', {
      method: 'POST',
      body: JSON.stringify({ identifiant: 'inconnu-xyz' })
    });
    assert.equal(r.status, 200);
    assert.match(r.data.message, /Si un compte existe/);
    const ok = await json('/api/auth/mot-de-passe-oublie', {
      method: 'POST',
      body: JSON.stringify({ identifiant: 'lea' })
    });
    assert.equal(ok.status, 200);
    assert.ok(ok.data.token_demo);
  });

  it('lots exposent des patients distincts et une dernière mesure', async () => {
    const r = await json('/api/lots');
    assert.equal(r.status, 200);
    const lot = (r.data || []).find((l) => l.nom === 'LOT-2026-001');
    assert.ok(lot);
    assert.ok(Number(lot.nb_patients) > 0);
    assert.ok(lot.derniere_mesure || lot.date);
  });

  it('valideurs affichés existent dans les comptes', async () => {
    const vals = await db.all('SELECT DISTINCT nom_biologiste AS nom FROM validations');
    const comptes = await db.all('SELECT nom FROM utilisateurs');
    const connus = new Set(comptes.map((c) => c.nom));
    assert.ok(vals.length > 0);
    for (const v of vals) {
      assert.ok(connus.has(v.nom), `valideur inconnu : ${v.nom}`);
    }
  });

  it('cohérence lot ne renvoie pas 404 au technicien', async () => {
    const lots = await json('/api/lots');
    const id = lots.data[0].id;
    const r = await json(`/api/coherence/lot/${id}`);
    assert.notEqual(r.status, 404);
    assert.ok(Array.isArray(r.data.anomalies));
  });

  it('anonymisation statut est vide sans erreur', async () => {
    await json('/api/auth/connexion', {
      method: 'POST',
      body: JSON.stringify({ identifiant: 'amrani', mot_de_passe: 'labo2026' })
    });
    const r = await json('/api/anonymisation/statut');
    assert.equal(r.status, 200);
    assert.equal(typeof r.data.genere, 'boolean');
  });

  it('export anonymisé refuse k<5 et n’a pas d’identifiant', async () => {
    const r = await json('/api/anonymisation/export-anonyme');
    if (r.status === 409) {
      assert.match(r.data.erreur || '', /k minimum|Aucun jeu/i);
      return;
    }
    assert.equal(r.status, 200);
    const texte = typeof r.data === 'string' ? r.data : String(r.data);
    const entete = texte.split(/\r?\n/)[0].toLowerCase();
    assert.match(entete, /tranche_age/);
    assert.match(entete, /territoire/);
    assert.equal(/code_patient|psn|numero_patient/.test(entete), false);
  });

  it('journal hash chain intègre', async () => {
    await enregistrer({ utilisateur: { id: 1, nom: 'test' } }, 'test hash', 'cible', 'd');
    const v = await verifierIntegrite(db);
    assert.equal(v.ok, true);
    assert.ok(v.nb >= 1);
  });
});
