const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  extraireColonnesCsv,
  colonnesSensibles,
  problemesLot,
  testerValeur,
  scoreConfiance,
  libelleStatut,
  extraireValeursCsv,
  carteLeveyJennings,
  scannerContenuCsv,
  validerSaisieLot
} = require('../lib/tracabilite');

describe('analyse CSV RGPD', () => {
  it('extrait les colonnes separees par point-virgule', () => {
    const cols = extraireColonnesCsv('nom;prenom;glycemie\nDupont;Lea;1.2');
    assert.deepEqual(cols, ['nom', 'prenom', 'glycemie']);
  });

  it('detecte les colonnes identifiantes', () => {
    const sensibles = colonnesSensibles(['nom', 'prenom', 'glycemie']);
    assert.deepEqual(sensibles.sort(), ['nom', 'prenom']);
  });

  it('accepte un csv deja anonymise', () => {
    const cols = extraireColonnesCsv('id_echantillon,valeur,unite');
    assert.equal(colonnesSensibles(cols).length, 0);
  });
});

describe('problemesLot', () => {
  it('ne signale rien pour un lot complet', () => {
    assert.deepEqual(problemesLot({
      machine_id: 1,
      date: '2024-01-01',
      conditions: 'calibration matin',
      anonymise: 1
    }), []);
  });

  it('signale machine et date manquantes', () => {
    const p = problemesLot({ machine_id: null, date: null, conditions: 'ok', anonymise: 1 });
    assert.ok(p.includes('Machine non renseignée'));
    assert.ok(p.includes('Date de mesure manquante'));
  });

    it('signale l anonymisation manquante', () => {
      const p = problemesLot({ machine_id: 1, date: '2024-01-01', conditions: 'ok', anonymise: 0 });
      assert.ok(p.includes('Pseudonymisation non confirmée'));
    });

    it('signale les colonnes identifiantes meme si la case anonymise est cochee', () => {
      const p = problemesLot({
        machine_id: 1,
        date: '2024-01-01',
        conditions: 'ok',
        anonymise: 1,
        sensibles: ['nom']
      });
      assert.ok(p.some((x) => x.includes('Colonnes identifiantes')));
    });
});

describe('simulateur de regle', () => {
  const regle = { seuil_bas: '0.70', seuil_haut: '1.10', unite: 'g/L' };

  it('signale une alerte au-dessus du seuil', () => {
    const t = testerValeur(regle, 1.4);
    assert.equal(t.resultat, 'alerte');
  });

  it('accepte une valeur dans la normale', () => {
    const t = testerValeur(regle, 0.9);
    assert.equal(t.resultat, 'dans_la_normale');
  });
});

describe('score de confiance', () => {
  it('note un lot complet valide sans signalement a 100', () => {
    const score = scoreConfiance({
      machine_id: 1,
      date: new Date().toISOString().slice(0, 10),
      conditions: 'calibration',
      anonymise: 1,
      alerte_identite: 0
    }, [{ date_validation: new Date().toISOString() }], 0);
    assert.equal(score, 100);
  });

  it('baisse le score s il reste un signalement ouvert', () => {
    const score = scoreConfiance({
      machine_id: 1,
      date: new Date().toISOString().slice(0, 10),
      conditions: 'calibration',
      anonymise: 1,
      alerte_identite: 0
    }, [{ date_validation: new Date().toISOString() }], 2);
    assert.equal(score, 80);
  });

  it('marque a revalider une validation trop ancienne', () => {
    const vu = libelleStatut(
      { statut: 'ok', machine_id: 1, date: '2026-01-01', conditions: 'Température 21°C, Lot de réactifs R, Calibration matin', anonymise: 1 },
      [{ date_validation: '2020-01-01' }]
    );
    assert.equal(vu.code, 'a_revalider');
    assert.equal(vu.libelle, 'À revalider');
  });

  it('n affiche Validé que si un biologiste a validé', () => {
    const vu = libelleStatut({
      machine_id: 1,
      date: '2026-01-01',
      conditions: 'Température 21°C, Lot de réactifs R, Calibration matin',
      anonymise: 1,
      statut: 'ok'
    }, []);
    assert.equal(vu.code, 'a_valider');
    assert.equal(vu.libelle, 'À valider');
  });

  it('classe un lot incomplet en Brouillon', () => {
    const vu = libelleStatut({ machine_id: null, date: null, conditions: null, anonymise: 0 }, []);
    assert.equal(vu.code, 'brouillon');
  });
});

describe('valeurs de controle CSV', () => {
  it('extrait la colonne valeur', () => {
    const v = extraireValeursCsv('id;valeur\nA;1.2\nB;3');
    assert.deepEqual(v, [1.2, 3]);
  });

  it('refuse de calculer les limites sous 20 points', () => {
    const c = carteLeveyJennings([1, 2, 3]);
    assert.equal(c.suffisant, false);
    assert.match(c.message, /Pas assez de données/);
  });

  it('detecte un NIR dans le contenu', () => {
    const t = scannerContenuCsv('code;valeur\nX;285057512345678');
    assert.ok(t.some((x) => /NIR/i.test(x)));
  });

  it('impose LOT-YYYY-NNN', () => {
    const e = validerSaisieLot({ nom: 'loot' });
    assert.ok(e.some((x) => /LOT-YYYY-NNN/i.test(x) || /LOT-/.test(x)));
  });
});
