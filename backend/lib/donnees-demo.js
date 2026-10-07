const { analyserCsv, genererCodeVerification, codePseudo } = require('./tracabilite');
const { composerNumero } = require('./patients');

function csvPoints(parametre, unite, points, codes = []) {
  const lignes = ['code_patient;parametre;valeur;unite;date'];
  points.forEach((p, i) => {
    const code = codes.length ? codes[i % codes.length] : `PSN-${String(i + 1).padStart(8, '0')}`;
    lignes.push(`${code};${parametre};${p.valeur};${unite};${p.date}`);
  });
  return lignes.join('\n');
}

function serieGlycemie() {
  const base = [
    0.88, 0.90, 0.92, 0.91, 0.89, 0.93, 0.94, 0.90, 0.87, 0.95,
    0.91, 0.92, 0.88, 0.96, 0.90, 0.89, 0.93, 0.91, 0.94, 0.90,
    0.92, 1.18, 1.19, 0.91, 0.89
  ];
  return base.map((valeur, i) => {
    const jour = String(i + 1).padStart(2, '0');
    return { valeur, date: `2026-01-${jour}` };
  });
}

function serieJours(annee, mois, valeurs) {
  return valeurs.map((valeur, i) => ({
    valeur,
    date: `${annee}-${String(mois).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`
  }));
}

function csvIdentitePiege() {
  const lignes = ['nom;prenom;nir;parametre;valeur;date'];
  const prenoms = ['Léa', 'Hugo', 'Inès', 'Noah', 'Jade'];
  for (let i = 0; i < 12; i++) {
    const nir = `1850575${String(100000 + i).slice(-6)}${String(11 + (i % 80)).padStart(2, '0')}`;
    lignes.push(`Martin;${prenoms[i % prenoms.length]};${nir};Créatinine;${80 + (i % 6)};2026-06-${String(i + 1).padStart(2, '0')}`);
  }
  return lignes.join('\n');
}

const SIGNALEMENTS_EXTRA = {
  'LOT-2026-008': [
    'Règle Westgard 1-3s : un point de potassium dépasse 3 écarts-types (contrôle fictif).'
  ],
  'LOT-2026-009': [
    'Série trop courte pour une carte de contrôle (moins de 20 points).',
    'Conditions incomplètes : lot de réactifs et calibration non renseignés.'
  ]
};

async function compter(get, sql) {
  const row = await get(sql);
  if (!row) return 0;
  const v = row.n ?? Object.values(row)[0];
  return Number(v) || 0;
}

const LIEUX = [
  ['75', 'Paris', '75012'], ['13', 'Marseille', '13008'], ['69', 'Lyon', '69003'],
  ['33', 'Bordeaux', '33000'], ['06', 'Nice', '06000'], ['44', 'Nantes', '44000'],
  ['31', 'Toulouse', '31000'], ['59', 'Lille', '59000'], ['67', 'Strasbourg', '67000'],
  ['34', 'Montpellier', '34000'], ['29', 'Brest', '29200'], ['83', 'Toulon', '83000']
];

const NOMS_FICTIFS = [
  'Martin', 'Bernard', 'Thomas', 'Petit', 'Robert', 'Richard', 'Durand', 'Dubois', 'Moreau', 'Laurent',
  'Simon', 'Michel', 'Lefevre', 'Garcia', 'David', 'Bertrand', 'Roux', 'Vincent', 'Fournier', 'Morel',
  'Girard', 'Andre', 'Leroy', 'Mercier', 'Blanc', 'Guerin', 'Boyer', 'Garnier', 'Chevalier', 'Francois',
  'Legrand', 'Gauthier', 'Perrin', 'Robin', 'Clement', 'Morin', 'Nicolas', 'Henry', 'Rousseau', 'Blancard',
  'Masson', 'Sanchez', 'Muller', 'Lemaire', 'Giraud', 'Bonnet', 'Lambert', 'Fontaine', 'Roussel',
  'Perez', 'Picard', 'Collet', 'Renard', 'Arnaud', 'Fabre', 'Olivier', 'Philippe', 'Aubert', 'Brunet',
  'Kerguelen', 'Hoareau', 'Leclercq', 'Carpentier', 'Marechal'
];

const PRENOMS_F = [
  'Léa', 'Inès', 'Jade', 'Manon', 'Chloé', 'Emma', 'Louise', 'Alice', 'Camille', 'Sarah',
  'Léna', 'Zoé', 'Eva', 'Nina', 'Lina', 'Mila', 'Agathe', 'Romane', 'Léonie', 'Clara',
  'Ines', 'Anna', 'Juliette', 'Héloïse', 'Maëlle', 'Capucine', 'Apolline', 'Solène', 'Iris', 'Louise'
];
const PRENOMS_M = [
  'Hugo', 'Noah', 'Liam', 'Adam', 'Louis', 'Raphaël', 'Arthur', 'Jules', 'Gabriel', 'Nathan',
  'Paul', 'Theo', 'Sacha', 'Ethan', 'Maël', 'Timeo', 'Nolan', 'Aaron', 'Noé', 'Eliott',
  'Lucas', 'Enzo', 'Tom', 'Axel', 'Maxime', 'Baptiste', 'Mathis', 'Nino', 'Diego', 'Soren'
];

function construirePatientsFictifs() {
  const liste = [];
  for (let i = 0; i < 64; i++) {
    const lieu = LIEUX[Math.floor(i / 5) % LIEUX.length];
    const sexe = i % 2 === 0 ? 'F' : 'M';
    const prenoms = sexe === 'F' ? PRENOMS_F : PRENOMS_M;
    const annee = 1948 + (i % 56);
    const mois = String((i % 12) + 1).padStart(2, '0');
    const jour = String((i % 27) + 1).padStart(2, '0');
    liste.push({
      nom: NOMS_FICTIFS[i % NOMS_FICTIFS.length],
      prenom: prenoms[Math.floor(i / 2) % prenoms.length],
      sexe,
      dep: lieu[0],
      ville: lieu[1],
      code_postal: lieu[2],
      date_naissance: `${annee}-${mois}-${jour}`
    });
  }
  liste.push({
    nom: 'Kerguelen',
    prenom: 'Ulysse',
    sexe: 'M',
    dep: '975',
    ville: 'Saint-Pierre',
    code_postal: '97500',
    date_naissance: '2018-03-11'
  });
  return liste;
}

function nirFictif(sexe, i) {
  const s = sexe === 'F' ? '2' : '1';
  return `${s}850575${String(100000 + i).slice(-6)}${String(10 + (i % 89)).padStart(2, '0')}`;
}

async function insererPatient(run, fiche, seq) {
  const numero = composerNumero(2026, seq);
  const psn = codePseudo();
  const { id } = await run(
    `INSERT INTO patients_identite (nom, prenom, date_naissance, sexe, nir_fictif, departement,
      numero_patient, ville, code_postal, cree_par, cree_le)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'démo', datetime('now'))`,
    [
      fiche.nom, fiche.prenom, fiche.date_naissance, fiche.sexe, nirFictif(fiche.sexe, seq),
      fiche.dep, numero, fiche.ville, fiche.code_postal
    ]
  );
  await run(
    'INSERT INTO patients_pseudo (code, patient_id, psn, identite_id) VALUES (?, ?, ?, ?)',
    [psn, id, psn, id]
  );
  return psn;
}

async function remplirPatients({ run, get, all }) {
  const stock = construirePatientsFictifs();
  const n = await compter(get, 'SELECT COUNT(*) AS n FROM patients_identite');
  if (n === 0) {
    for (let i = 0; i < stock.length; i++) {
      await insererPatient(run, stock[i], i + 1);
    }
  } else if (n < 60) {
    for (let i = n; i < stock.length; i++) {
      await insererPatient(run, stock[i], i + 1);
    }
  }

  const sansNumero = await all(
    "SELECT id, nom, prenom, sexe, departement FROM patients_identite WHERE numero_patient IS NULL OR numero_patient = ''"
  );
  let seq = 0;
  const deja = await all("SELECT numero_patient FROM patients_identite WHERE numero_patient LIKE 'NP-2026-%'");
  for (const r of deja) {
    const m = String(r.numero_patient).match(/^NP-2026-(\d{5})/);
    if (m) seq = Math.max(seq, Number(m[1]));
  }
  for (const p of sansNumero) {
    seq += 1;
    const lieu = LIEUX.find((l) => l[0] === String(p.departement || '')) || ['99', 'Ville', '99000'];
    await run(
      `UPDATE patients_identite SET numero_patient = ?, ville = COALESCE(NULLIF(ville, ''), ?),
        code_postal = COALESCE(NULLIF(code_postal, ''), ?), cree_par = COALESCE(cree_par, 'démo')
       WHERE id = ?`,
      [composerNumero(2026, seq), lieu[1], lieu[2], p.id]
    );
  }
  await run(`UPDATE patients_pseudo SET psn = COALESCE(NULLIF(psn, ''), code)`);
  await run(`UPDATE patients_pseudo SET identite_id = COALESCE(identite_id, patient_id)`);
}

async function remplir({ run, get, all }) {
  const machines = [
    ['Cobas 8000', 'biochimie', '2026-09-01', 'en_service'],
    ['Sysmex XN-1000', 'hematologie', '2026-08-12', 'en_service'],
    ['Architect i2000SR', 'immunologie', '2026-07-20', 'en_service'],
    ['ABL90 FLEX', 'gazometrie', '2026-06-03', 'maintenance'],
    ['Vitek 2', 'microbiologie', '2026-05-18', 'en_service']
  ];
  const machineIds = {};
  for (const [nom, type, cal, statut] of machines) {
    const existante = await get('SELECT id FROM machines WHERE nom = ?', [nom]);
    if (existante) {
      machineIds[nom] = existante.id;
      await run(
        'UPDATE machines SET type = ?, date_calibration = COALESCE(date_calibration, ?), statut_service = COALESCE(statut_service, ?) WHERE id = ?',
        [type, cal, statut, existante.id]
      );
    } else {
      const { id } = await run(
        'INSERT INTO machines (nom, type, date_calibration, statut_service) VALUES (?, ?, ?, ?)',
        [nom, type, cal, statut]
      );
      machineIds[nom] = id;
    }
  }

  await remplirPatients({ run, get, all });
  const pseudos = await all('SELECT COALESCE(psn, code) AS code FROM patients_pseudo ORDER BY id');
  const codesPsn = (pseudos || []).map((p) => p.code);

  const csvGlycemie = csvPoints('Glycémie à jeun', 'g/L', serieGlycemie(), codesPsn);
  const csvHba1c = csvPoints('HbA1c', '%', [
    5.4, 5.6, 5.5, 5.8, 5.3, 5.7, 5.4, 5.6, 5.5, 5.9,
    5.4, 5.5, 5.7, 5.6, 5.4, 5.8, 5.5, 5.6, 5.3, 5.7, 5.5, 5.4, 5.6, 5.8, 5.5
  ].map((valeur, i) => ({ valeur, date: `2026-03-${String(i + 1).padStart(2, '0')}` })), codesPsn);
  const csvHb = csvPoints('Hémoglobine', 'g/dL', [
    13.2, 13.8, 14.1, 13.5, 13.9, 14.0, 13.4, 13.6, 13.7, 13.9,
    13.3, 13.8, 14.0, 13.5, 13.6, 13.9, 13.4, 13.7, 13.8, 14.1, 13.6, 13.5, 13.9, 13.7, 13.4
  ].map((valeur, i) => ({ valeur, date: `2026-02-${String(i + 1).padStart(2, '0')}` })), codesPsn);

  const lots = [
    {
      nom: 'LOT-2026-001',
      machine: 'Cobas 8000',
      date: '2026-01-25',
      conditions: 'Température 21°C, Lot de réactifs R-441, Calibration matin',
      csv: csvGlycemie,
      biologiste: 'Dr. Amrani',
      regles: [{ parametre: 'Glycémie à jeun', seuil_bas: '0.70', seuil_haut: '1.10', unite: 'g/L' }]
    },
    {
      nom: 'LOT-2026-002',
      machine: 'Cobas 8000',
      date: '2026-03-25',
      conditions: 'Température 21°C, Lot de réactifs R-441, Calibration hebdomadaire',
      csv: csvHba1c,
      biologiste: 'Dr. Chen',
      regles: [{ parametre: 'HbA1c', seuil_bas: null, seuil_haut: '6.0', unite: '%' }]
    },
    {
      nom: 'LOT-2026-003',
      machine: 'Sysmex XN-1000',
      date: '2026-02-25',
      conditions: 'Température 22°C, Lot de réactifs S-12, Calibration 3 niveaux',
      csv: csvHb,
      biologiste: 'Dr. El Fassi',
      regles: [{ parametre: 'Hémoglobine', seuil_bas: '12.0', seuil_haut: '16.0', unite: 'g/dL' }]
    },
    {
      nom: 'LOT-2026-004',
      machine: 'Architect i2000SR',
      date: '2026-04-08',
      conditions: 'Température 4°C, Lot de réactifs I-90, Calibration journalière',
      csv: csvPoints('TSH', 'mUI/L', [1.2, 1.8, 2.1, 1.5, 1.9, 2.0, 1.4, 1.7, 1.6, 1.9, 1.5, 1.8, 2.0, 1.6, 1.7, 1.9, 1.4, 1.8, 1.6, 2.0, 1.7, 1.5, 1.9, 1.6, 1.8].map((valeur, i) => ({ valeur, date: `2026-04-${String(i + 1).padStart(2, '0')}` })), codesPsn),
      biologiste: 'Dr. Amrani',
      regles: [{ parametre: 'TSH', seuil_bas: '0.3', seuil_haut: '4.5', unite: 'mUI/L' }]
    },
    {
      nom: 'LOT-2026-005',
      machine: 'Cobas 8000',
      date: '2026-05-12',
      conditions: 'Température 22°C, Lot de réactifs C-18, Calibration journalière',
      csv: csvPoints('CRP', 'mg/L', [2.1, 3.4, 1.8, 4.2, 2.9, 3.1, 2.4, 2.8, 3.0, 2.6, 2.2, 3.3, 2.7, 2.9, 3.1, 2.5, 2.8, 3.2, 2.4, 2.7, 3.0, 2.6, 2.9, 3.1, 2.5].map((valeur, i) => ({ valeur, date: `2026-05-${String(i + 1).padStart(2, '0')}` })), codesPsn),
      biologiste: 'Dr. Amrani',
      regles: [{ parametre: 'CRP', seuil_bas: null, seuil_haut: '5.0', unite: 'mg/L' }]
    },
    {
      nom: 'LOT-2026-006',
      machine: 'Sysmex XN-1000',
      date: '2026-09-12',
      conditions: 'Température 21°C, Lot de réactifs S-12, Calibration interne OK',
      csv: csvHb,
      biologiste: null,
      regles: [{ parametre: 'Hémoglobine', seuil_bas: '12.0', seuil_haut: '16.0', unite: 'g/dL' }]
    },
    {
      nom: 'LOT-2026-007',
      machine: 'Vitek 2',
      date: '2026-08-11',
      conditions: 'Température 35°C, Lot de réactifs C-19, Calibration enceinte',
      csv: csvPoints('Contrôle négatif', '', [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0].map((valeur, i) => ({ valeur, date: `2026-08-${String(i + 1).padStart(2, '0')}` })), codesPsn),
      biologiste: 'Dr. Amrani',
      ancien: true,
      regles: []
    },
    {
      nom: 'TEST — données fictives',
      machine: 'Cobas 8000',
      date: null,
      conditions: '30',
      csv: 'nom;prenom;nir;parametre;valeur\nMartin;Léa;285057512345678;Glycémie à jeun;0.92',
      biologiste: null,
      est_test: 1,
      anonymise: 0,
      regles: [{ parametre: 'Glycémie à jeun', seuil_bas: '0.70', seuil_haut: '1.10', unite: 'g/L' }]
    },
    {
      nom: 'LOT-2026-008',
      machine: 'Cobas 8000',
      date: '2026-07-20',
      conditions: 'Température 21°C, Lot de réactifs K-22, Calibration 2 points',
      csv: csvPoints('Potassium', 'mmol/L', serieJours(2026, 7, [
        4.1, 4.2, 4.0, 4.3, 4.1, 4.2, 4.0, 4.1, 4.3, 4.2,
        4.1, 4.0, 4.2, 4.3, 4.1, 4.2, 6.9, 4.1, 4.0, 4.2,
        4.1, 4.3, 4.2, 4.0, 4.1
      ]), codesPsn),
      biologiste: 'Dr. Chen',
      regles: [{ parametre: 'Potassium', seuil_bas: '3.5', seuil_haut: '5.1', unite: 'mmol/L' }]
    },
    {
      nom: 'LOT-2026-009',
      machine: 'Architect i2000SR',
      date: '2026-09-04',
      conditions: '21',
      csv: csvPoints('Créatinine', 'µmol/L', serieJours(2026, 9, [78, 82, 80, 85, 79, 81, 83, 80]), codesPsn),
      biologiste: null,
      regles: [{ parametre: 'Créatinine', seuil_bas: '45', seuil_haut: '105', unite: 'µmol/L' }]
    },
    {
      nom: 'LOT-2026-010',
      machine: 'Cobas 8000',
      date: '2026-06-12',
      conditions: 'Température 21°C, Lot de réactifs C-30, Calibration matin',
      csv: csvIdentitePiege(),
      biologiste: null,
      anonymise: 0,
      regles: [{ parametre: 'Créatinine', seuil_bas: '45', seuil_haut: '105', unite: 'µmol/L' }]
    },
    {
      nom: 'LOT-2026-011',
      machine: 'ABL90 FLEX',
      date: null,
      conditions: 'Température 22°C, Lot de réactifs G-07, Calibration gaz',
      csv: csvPoints('pH', '', serieJours(2026, 8, [
        7.38, 7.40, 7.39, 7.41, 7.38, 7.40, 7.39, 7.42, 7.38, 7.40,
        7.39, 7.41, 7.40, 7.38, 7.39, 7.41, 7.40, 7.38, 7.39, 7.40,
        7.41, 7.38, 7.40, 7.39, 7.41
      ]), codesPsn),
      biologiste: null,
      regles: [{ parametre: 'pH', seuil_bas: '7.35', seuil_haut: '7.45', unite: '' }]
    },
    {
      nom: 'LOT-2026-012',
      machine: 'Cobas 8000',
      date: '2026-08-28',
      conditions: 'Température 21°C, Lot de réactifs L-11, Calibration hebdomadaire',
      csv: csvPoints('Cholestérol total', 'g/L', serieJours(2026, 8, [
        1.82, 1.90, 1.86, 1.88, 1.84, 1.91, 1.87, 1.85, 1.89, 1.86,
        1.84, 1.90, 1.88, 1.85, 1.87, 1.89, 1.86, 1.84, 1.91, 1.88,
        1.85, 1.87, 1.90, 1.86, 1.88
      ]), codesPsn),
      biologiste: 'Dr. El Fassi',
      regles: [{ parametre: 'Cholestérol total', seuil_bas: null, seuil_haut: '2.00', unite: 'g/L' }]
    },
    {
      nom: 'LOT-2026-013',
      machine: 'Sysmex XN-1000',
      date: '2026-09-18',
      conditions: 'Température 22°C, Lot de réactifs S-18, Calibration 3 niveaux',
      csv: csvPoints('Plaquettes', 'G/L', serieJours(2026, 9, [
        245, 252, 238, 260, 241, 255, 248, 250, 243, 257,
        246, 251, 239, 258, 244, 249, 253, 247, 242, 256,
        250, 248, 245, 252, 249
      ]), codesPsn),
      biologiste: 'Dr. Amrani',
      ancien: true,
      regles: [{ parametre: 'Plaquettes', seuil_bas: '150', seuil_haut: '400', unite: 'G/L' }]
    }
  ];

  const lotsArchives = [
    {
      nom: 'LOT-2025-088',
      machine: 'Cobas 8000',
      date: '2025-12-02',
      conditions: 'Température 21°C, Lot de réactifs R-400, Calibration matin',
      csv: 'code_patient;parametre;valeur;unite;date\nPSN-X1;Glycémie à jeun;0.91;g/L;2025-12-02',
      biologiste: 'Dr. Chen',
      archive: 1,
      regles: [{ parametre: 'Glycémie à jeun', seuil_bas: '0.70', seuil_haut: '1.10', unite: 'g/L' }]
    }
  ];

  const nomsOfficiels = lots.concat(lotsArchives).map((l) => l.nom);
  await run(
    `UPDATE lots SET archive = 1
     WHERE COALESCE(est_test, 0) = 0
       AND nom NOT IN (${nomsOfficiels.map(() => '?').join(',')})`,
    nomsOfficiels
  );
  await run("UPDATE lots SET archive = 1 WHERE lower(nom) LIKE 'loot%'");

  for (const lot of lots.concat(lotsArchives)) {
    const { colonnes, valeurs, dates, moyenne, sensibles, contenus_sensibles } = analyserCsv(lot.csv);
    const machine_id = machineIds[lot.machine];
    const anonymise = lot.anonymise === 0 ? 0 : 1;
    const alerte = (sensibles.length || (contenus_sensibles && contenus_sensibles.length)) ? 1 : 0;
    const dejaLot = await get('SELECT id FROM lots WHERE nom = ?', [lot.nom]);
    let id;
    const dejaExistant = Boolean(dejaLot);
    if (dejaLot) {
      id = dejaLot.id;
      await run(
        `UPDATE lots SET machine_id = ?, date = ?, conditions = ?, anonymise = ?, colonnes_csv = ?,
          alerte_identite = ?, moyenne_controle = ?, valeurs_controle = ?, dates_controle = ?,
          archive = ?, est_test = ? WHERE id = ?`,
        [
          machine_id, lot.date, lot.conditions, anonymise, JSON.stringify(colonnes), alerte,
          moyenne, valeurs.length ? JSON.stringify(valeurs) : null,
          dates && dates.length ? JSON.stringify(dates) : null,
          lot.archive ? 1 : 0, lot.est_test ? 1 : 0, id
        ]
      );
    } else {
      const ins = await run(
      `INSERT INTO lots (nom, machine_id, date, conditions, anonymise, colonnes_csv, alerte_identite,
        code_verification, moyenne_controle, valeurs_controle, dates_controle, archive, est_test)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        lot.nom,
        machine_id,
        lot.date,
        lot.conditions,
        anonymise,
        JSON.stringify(colonnes),
        alerte,
        genererCodeVerification(),
        moyenne,
        valeurs.length ? JSON.stringify(valeurs) : null,
        dates && dates.length ? JSON.stringify(dates) : null,
        lot.archive ? 1 : 0,
        lot.est_test ? 1 : 0
      ]
      );
      id = ins.id;
    }

    if (lot.biologiste) {
      const dateVal = lot.ancien ? "datetime('now', '-14 months')" : "datetime('now')";
      const dejaVal = await get('SELECT id FROM validations WHERE lot_id = ? AND nom_biologiste = ?', [id, lot.biologiste]);
      if (!dejaVal) {
        await run(
          `INSERT INTO validations (lot_id, nom_biologiste, date_validation) VALUES (?, ?, ${dateVal})`,
          [id, lot.biologiste]
        );
      } else if (lot.ancien) {
        await run(
          `UPDATE validations SET date_validation = ${dateVal} WHERE lot_id = ? AND nom_biologiste = ?`,
          [id, lot.biologiste]
        );
      }
    }

    if (!dejaExistant) {
      for (const regle of lot.regles || []) {
        await run(
          `INSERT INTO regles_alerte (lot_id, parametre, seuil_bas, seuil_haut, unite, statut)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [id, regle.parametre, regle.seuil_bas, regle.seuil_haut, regle.unite, lot.biologiste ? 'validee' : 'a_valider']
        );
      }
    }

    const lignesCsv = String(lot.csv || '').split(/\r?\n/).filter((l) => l.trim());
    if (!dejaExistant && lignesCsv.length > 1 && /code_patient/i.test(lignesCsv[0])) {
      const cols = lignesCsv[0].split(';');
      const iCode = cols.findIndex((c) => /code_patient/i.test(c));
      const iPar = cols.findIndex((c) => /parametre/i.test(c));
      const iVal = cols.findIndex((c) => /valeur/i.test(c));
      const iUni = cols.findIndex((c) => /unite/i.test(c));
      const iDat = cols.findIndex((c) => /^date/i.test(c));
      for (let k = 1; k < lignesCsv.length; k++) {
        const c = lignesCsv[k].split(';');
        if (iCode < 0 || !c[iCode]) continue;
        await run(
          `INSERT INTO mesures_reference (code_patient, parametre, valeur, unite, date, lot_id)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [c[iCode], iPar >= 0 ? c[iPar] : null, iVal >= 0 ? Number(String(c[iVal]).replace(',', '.')) : null, iUni >= 0 ? c[iUni] : null, iDat >= 0 ? c[iDat] : lot.date, id]
        );
      }
    }
  }

  await run("UPDATE lots SET archive = 1 WHERE lower(nom) LIKE 'loot%' OR nom IN ('Glycémie — série incomplète','Créatinine — données manquantes')");

  await synchroniserSignalements({ run, get, all });

  const nbPatients = await compter(get, 'SELECT COUNT(*) AS n FROM patients_identite');
  console.log(`Données de démonstration chargées (machines, lots, ${nbPatients} patients fictifs).`);
}

async function synchroniserSignalements({ run, get, all }) {
  const { problemesLot, colonnesSensibles } = require('./tracabilite');
  const lotsExistants = await all('SELECT * FROM lots');
  for (const lot of lotsExistants) {
    let sensibles = [];
    let contenus = [];
    if (lot.colonnes_csv) {
      try { sensibles = colonnesSensibles(JSON.parse(lot.colonnes_csv) || []); } catch { sensibles = []; }
    }
    const extras = SIGNALEMENTS_EXTRA[lot.nom] || [];
    const problemes = [
      ...problemesLot({
        machine_id: lot.machine_id,
        date: lot.date,
        conditions: lot.conditions,
        anonymise: lot.anonymise,
        sensibles,
        contenus_sensibles: contenus
      }),
      ...extras
    ];
    await run('UPDATE lots SET statut = ? WHERE id = ?', [problemes.length ? 'douteux' : 'ok', lot.id]);
    await run('DELETE FROM signalements WHERE lot_id = ?', [lot.id]);
    for (const raison of problemes) {
      await run('INSERT INTO signalements (lot_id, raison) VALUES (?, ?)', [lot.id, raison]);
    }
  }
}

module.exports = { remplir };
