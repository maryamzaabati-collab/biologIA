const { analyserCsv, genererCodeVerification } = require('./tracabilite');

function csvValeurs(valeurs) {
  return ['code;valeur'].concat(valeurs.map((v, i) => `R${i + 1};${v}`)).join('\n');
}

async function compter(get, sql) {
  const row = await get(sql);
  if (!row) return 0;
  const v = row.n ?? Object.values(row)[0];
  return Number(v) || 0;
}

async function remplir({ run, get }) {
  const machines = [
    ['Cobas 8000', 'biochimie'],
    ['Sysmex XN-1000', 'hematologie'],
    ['Architect i2000SR', 'immunologie'],
    ['ABL90 FLEX', 'gazometrie'],
    ['Vitek 2', 'microbiologie']
  ];
  const machineIds = {};
  for (const [nom, type] of machines) {
    const existante = await get('SELECT id FROM machines WHERE nom = ?', [nom]);
    if (existante) {
      machineIds[nom] = existante.id;
    } else {
      const { id } = await run('INSERT INTO machines (nom, type) VALUES (?, ?)', [nom, type]);
      machineIds[nom] = id;
    }
  }

  const nLots = await compter(get, 'SELECT COUNT(*) AS n FROM lots');

  const lots = [
    {
      nom: 'Glycémie — série janvier',
      machine: 'Cobas 8000',
      date: '2026-01-14',
      conditions: 'Calibration matin, 21°C, contrôle interne passé',
      csv: csvValeurs([0.92, 0.88, 0.95, 1.01, 0.90, 0.87, 0.98]),
      biologiste: 'Dr. Amrani',
      regles: [
        { parametre: 'Glycémie à jeun', seuil_bas: '0.70', seuil_haut: '1.10', unite: 'g/L' }
      ]
    },
    {
      nom: 'HbA1c — contrôle T1',
      machine: 'Cobas 8000',
      date: '2026-03-02',
      conditions: 'Réactif lot R-441, calibration hebdomadaire',
      csv: csvValeurs([5.4, 5.6, 5.5, 5.8, 5.3, 5.7]),
      biologiste: 'Dr. Chen',
      regles: [{ parametre: 'HbA1c', seuil_bas: null, seuil_haut: '6.0', unite: '%' }]
    },
    {
      nom: 'NFS — série du matin',
      machine: 'Sysmex XN-1000',
      date: '2026-02-18',
      conditions: 'Contrôle 3 niveaux, agitation 10 min',
      csv: csvValeurs([13.2, 13.8, 14.1, 13.5, 13.9, 14.0]),
      biologiste: 'Dr. El Fassi',
      regles: [
        { parametre: 'Hémoglobine', seuil_bas: '12.0', seuil_haut: '16.0', unite: 'g/dL' }
      ]
    },
    {
      nom: 'TSH — données de référence',
      machine: 'Architect i2000SR',
      date: '2026-04-08',
      conditions: 'Chambre 4°C, réactif ouvert J+2',
      csv: csvValeurs([1.2, 1.8, 2.1, 1.5, 1.9, 2.0]),
      biologiste: 'Dr. Amrani',
      regles: [{ parametre: 'TSH', seuil_bas: '0.3', seuil_haut: '4.5', unite: 'mUI/L' }]
    },
    {
      nom: 'Troponine hs — seuil d’alerte',
      machine: 'Architect i2000SR',
      date: '2026-04-09',
      conditions: 'Contrôle bas / haut validés',
      csv: csvValeurs([0.006, 0.008, 0.007, 0.009, 0.005]),
      biologiste: 'Dr. Chen',
      regles: [{ parametre: 'Troponine hs', seuil_bas: null, seuil_haut: '0.014', unite: 'µg/L' }]
    },
    {
      nom: 'CRP — série inflammation',
      machine: 'Cobas 8000',
      date: '2026-05-12',
      conditions: 'Température ambiante 22°C, CQ journalier OK',
      csv: csvValeurs([2.1, 3.4, 1.8, 4.2, 2.9, 3.1]),
      biologiste: 'Dr. Amrani',
      regles: [{ parametre: 'CRP', seuil_bas: null, seuil_haut: '5.0', unite: 'mg/L' }]
    },
    {
      nom: 'Créatinine — série rénale',
      machine: 'Cobas 8000',
      date: '2026-05-13',
      conditions: 'Méthode enzymatique, blanc réactif OK',
      csv: csvValeurs([8.2, 9.1, 7.8, 10.4, 8.6, 9.0]),
      biologiste: 'Dr. Chen',
      regles: [{ parametre: 'Créatinine', seuil_bas: null, seuil_haut: '12.0', unite: 'mg/L' }]
    },
    {
      nom: 'Gaz du sang — calibration ABL',
      machine: 'ABL90 FLEX',
      date: '2026-07-21',
      conditions: 'Cassette neuve, auto-QC passé',
      csv: csvValeurs([7.39, 7.41, 7.38, 7.40, 7.42]),
      biologiste: 'Dr. Chen',
      regles: [
        { parametre: 'pH', seuil_bas: '7.35', seuil_haut: '7.45', unite: '' }
      ]
    },
    {
      nom: 'Hémocultures — contrôles négatifs',
      machine: 'Vitek 2',
      date: '2026-08-11',
      conditions: 'Enceinte 35°C, cartes identification lot C-19',
      csv: csvValeurs([0, 0, 0, 0, 0]),
      biologiste: 'Dr. Amrani',
      regles: []
    },
    {
      nom: 'Glycémie — série incomplète',
      machine: 'Cobas 8000',
      date: '2026-09-10',
      conditions: '',
      csv: csvValeurs([0.91, 0.94, 0.89]),
      biologiste: null,
      regles: [
        { parametre: 'Glycémie à jeun', seuil_bas: '0.70', seuil_haut: '1.10', unite: 'g/L' }
      ]
    },
    {
      nom: 'Créatinine — données manquantes',
      machine: 'Cobas 8000',
      date: null,
      conditions: 'Méthode enzymatique',
      csv: csvValeurs([8.0, 8.4, 9.2]),
      biologiste: null,
      regles: [
        { parametre: 'Créatinine', seuil_bas: null, seuil_haut: '12.0', unite: 'mg/L' }
      ]
    },
    {
      nom: 'Hémoglobine — sans validation',
      machine: 'Sysmex XN-1000',
      date: '2026-09-12',
      conditions: 'Contrôle interne OK',
      csv: csvValeurs([13.1, 13.4, 13.6]),
      biologiste: null,
      regles: [
        { parametre: 'Hémoglobine', seuil_bas: '12.0', seuil_haut: '16.0', unite: 'g/dL' }
      ]
    },
    {
      nom: 'Ionogramme — pseudonymisation à confirmer',
      machine: 'Cobas 8000',
      date: '2026-09-14',
      conditions: 'ISE calibrées, pente dans les limites',
      csv: csvValeurs([138, 141, 139, 140]),
      anonymise: 0,
      biologiste: null,
      regles: [
        { parametre: 'Sodium', seuil_bas: '135', seuil_haut: '145', unite: 'mmol/L' }
      ]
    }
  ];

  const aCreer = nLots === 0 ? lots : lots.filter((lot) => !lot.biologiste || lot.anonymise === 0);

  for (const lot of aCreer) {
    const dejaLot = await get('SELECT id FROM lots WHERE nom = ?', [lot.nom]);
    if (dejaLot) continue;
    const { colonnes, valeurs, moyenne } = analyserCsv(lot.csv);
    const machine_id = machineIds[lot.machine];
    const anonymise = lot.anonymise === 0 ? 0 : 1;
    const { id } = await run(
      `INSERT INTO lots (nom, machine_id, date, conditions, anonymise, colonnes_csv, alerte_identite,
        code_verification, moyenne_controle, valeurs_controle)
       VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?)`,
      [
        lot.nom,
        machine_id,
        lot.date,
        lot.conditions,
        anonymise,
        JSON.stringify(colonnes),
        genererCodeVerification(),
        moyenne,
        valeurs.length ? JSON.stringify(valeurs) : null
      ]
    );

    if (lot.biologiste) {
      const dateVal = lot.nom.includes('Hémocultures')
        ? "datetime('now', '-14 months')"
        : "datetime('now')";
      await run(
        `INSERT INTO validations (lot_id, nom_biologiste, date_validation) VALUES (?, ?, ${dateVal})`,
        [id, lot.biologiste]
      );
    }

    for (const regle of lot.regles || []) {
      await run(
        `INSERT INTO regles_alerte (lot_id, parametre, seuil_bas, seuil_haut, unite, statut)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [id, regle.parametre, regle.seuil_bas, regle.seuil_haut, regle.unite, lot.biologiste ? 'validee' : 'a_valider']
      );
    }
  }

  await run("DELETE FROM historique_lots WHERE nouvelle_valeur LIKE '%recontrôle après maintenance%'");
  await run("UPDATE lots SET conditions = REPLACE(conditions, ' — recontrôle après maintenance', '') WHERE conditions LIKE '%recontrôle après maintenance%'");

  console.log('Données de démonstration chargées (machines, lots, signalements).');
}

module.exports = { remplir };
