const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { genererJeu, enrichirRapport, csvPiege } = require('../lib/anonymiser');
const { testerAnonymisation } = require('../lib/tracabilite');

describe('anonymisation k>=5', () => {
  it('generalise puis exclut les groupes trop petits', () => {
    const brutes = [];
    for (let i = 0; i < 12; i++) {
      brutes.push({
        date_naissance: '1990-01-01',
        sexe: 'F',
        departement: '75',
        parametre: 'HbA1c',
        valeur: 5.4,
        unite: '%',
        date: '2026-03-01'
      });
    }
    brutes.push({
      date_naissance: '2018-01-01',
      sexe: 'M',
      departement: '29',
      parametre: 'HbA1c',
      valeur: 5.1,
      unite: '%',
      date: '2026-03-01'
    });
    const jeu = genererJeu(brutes);
    assert.ok(jeu.k_min >= 5 || jeu.nb_lignes === 0);
    assert.equal(jeu.nb_lignes, 12);
    assert.ok(jeu.supprimees >= 1);
  });

  it('le CSV piege echoue le test', () => {
    const r = enrichirRapport(csvPiege(), []);
    assert.equal(r.ok, false);
    assert.equal(r.statut, 'non_conforme');
  });

  it('un CSV réduit à l’en-tête est non testable', () => {
    const r = testerAnonymisation('tranche_age;sexe;territoire;parametre;valeur;unite;mois\n');
    assert.equal(r.ok, false);
    assert.equal(r.statut, 'non_testable');
  });

  it('n’est jamais conforme si un contrôle est faux', () => {
    const r = enrichirRapport('tranche_age;sexe;territoire\n18-29;F;75\n', []);
    assert.equal(r.ok, false);
    assert.notEqual(r.statut, 'conforme');
  });

  it('parle de territoire, pas de département', () => {
    const r = testerAnonymisation('tranche_age;sexe;territoire\n');
    const k = r.controles.find((c) => c.code === 'k_anonymat');
    assert.match(k.libelle, /territoire/);
    assert.equal(/département/i.test(k.libelle), false);
  });
});
