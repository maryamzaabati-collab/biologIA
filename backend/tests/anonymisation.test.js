const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { genererJeu, enrichirRapport, csvPiege } = require('../lib/anonymiser');

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
  });
});
