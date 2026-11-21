const { analyserCsv } = require('./tracabilite');
const { composerNumero } = require('./patients');
const { genererJeu } = require('./anonymiser');
const { appliquerReglesSurLot } = require('./alerte-mesures');

const ALPHABET_CODE = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
let tirage = Math.random;
function initialiserHasard(graine) {
  let s = graine >>> 0;
  tirage = () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
function codeDepuisHasard(prefixe, n) {
  let code = prefixe;
  for (let i = 0; i < n; i++) code += ALPHABET_CODE[Math.floor(tirage() * ALPHABET_CODE.length)];
  return code;
}
function codeVerificationStable(nom) {
  const crypto = require('crypto');
  const buf = crypto.createHash('sha256').update(`biologIA|${nom}|20261009`).digest();
  let code = 'LT-';
  for (let i = 0; i < 8; i++) code += ALPHABET_CODE[buf[i] % ALPHABET_CODE.length];
  return code;
}

function csvPoints(parametre, unite, points, codes = [], debut = 0) {
  const lignes = ['code_patient;parametre;valeur;unite;date'];
  points.forEach((p, i) => {
    const code = codes.length
      ? codes[(debut + i) % codes.length]
      : `PSN-${String(i + 1).padStart(8, '0')}`;
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
  for (let i = 0; i < 120; i++) {
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
  const psn = codeDepuisHasard('PSN-', 8);
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

// Parc d'automates du plateau technique de Nice (modèles réels, données fictives).
// [nom, discipline, dernière calibration, état, fabricant, mise en service, secteur]
const MACHINES = [
  ['Cobas 8000', 'biochimie', '2026-09-01', 'en_service', 'Roche', '2019-03-12', 'Biochimie – chaîne principale'],
  ['Cobas pure', 'biochimie', '2026-10-21', 'en_service', 'Roche', '2023-06-05', 'Urgences 24 h/24'],
  ['Alinity ci', 'biochimie', '2026-10-14', 'en_service', 'Abbott', '2022-09-19', 'Biochimie – secours'],
  ['Atellica CH 930', 'biochimie', '2026-08-30', 'en_service', 'Siemens Healthineers', '2021-01-11', 'Biochimie – chaîne principale'],
  ['Sysmex XN-1000', 'hematologie', '2026-08-12', 'en_service', 'Sysmex', '2018-11-26', 'Hématologie'],
  ['Sysmex XN-550', 'hematologie', '2026-10-09', 'en_service', 'Sysmex', '2022-02-14', 'Urgences 24 h/24'],
  ['DxH 900', 'hematologie', '2026-07-28', 'en_service', 'Beckman Coulter', '2020-05-04', 'Hématologie'],
  ['BC-6800 Plus', 'hematologie', '2026-03-17', 'maintenance', 'Mindray', '2021-10-18', 'Hématologie – secours'],
  ['Architect i2000SR', 'immunologie', '2026-07-20', 'en_service', 'Abbott', '2017-09-04', 'Immuno-analyse'],
  ['cobas e 801', 'immunologie', '2026-10-01', 'en_service', 'Roche', '2022-04-25', 'Immuno-analyse'],
  ['Liaison XL', 'immunologie', '2026-09-08', 'en_service', 'DiaSorin', '2020-02-10', 'Sérologies – vitamine D'],
  ['Tosoh HLC-723 G11', 'biochimie', '2026-10-06', 'en_service', 'Tosoh', '2021-06-21', 'HbA1c (diabète)'],
  ['ABL90 FLEX', 'gazometrie', '2026-06-03', 'maintenance', 'Radiometer', '2019-12-02', 'Urgences 24 h/24'],
  ['GEM Premier 5000', 'gazometrie', '2026-10-27', 'en_service', 'Werfen', '2023-01-16', 'Réanimation'],
  ['STA R Max', 'hemostase', '2026-10-02', 'en_service', 'Stago', '2020-08-31', 'Hémostase'],
  ['CS-5100', 'hemostase', '2026-09-24', 'en_service', 'Sysmex', '2021-03-29', 'Hémostase'],
  ['Atellica UAS 800', 'urines', '2026-09-15', 'en_service', 'Siemens Healthineers', '2021-01-11', 'Urines'],
  ['UF-5000', 'urines', '2026-08-18', 'en_service', 'Sysmex', '2022-11-07', 'Urines'],
  ['Vitek 2', 'microbiologie', '2026-05-18', 'en_service', 'bioMérieux', '2016-05-23', 'Microbiologie'],
  ['MALDI Biotyper sirius', 'microbiologie', '2026-09-30', 'en_service', 'Bruker', '2023-09-11', 'Microbiologie'],
  ['BD BACTEC FX', 'hemocultures', '2026-04-28', 'maintenance', 'BD', '2015-10-12', 'Microbiologie'],
  ['BacT/ALERT VIRTUO', 'hemocultures', '2026-10-19', 'en_service', 'bioMérieux', '2024-02-05', 'Microbiologie'],
  ['Capillarys 3 Tera', 'electrophorese', '2026-09-12', 'en_service', 'Sebia', '2022-07-04', 'Protéines'],
  ['GeneXpert XVI', 'biologie_moleculaire', '2026-10-11', 'en_service', 'Cepheid', '2020-04-06', 'Biologie moléculaire'],
  ['Hydrasys 2 Scan', 'electrophorese', '2025-11-03', 'hors_service', 'Sebia', '2014-01-20', 'Protéines – ancien'],
  ['Centrifugeuse Rotina 380', 'centrifugeuse', '2026-09-02', 'en_service', 'Hettich', '2019-05-13', 'Pré-analytique']
];

// Analyses qu'on peut produire sur chaque machine, pour fabriquer des lots réalistes.
// [paramètre, unité, moyenne, écart-type, seuil bas, seuil haut, décimales]
const PARAMETRES = {
  'Cobas 8000': [['Glycémie à jeun', 'g/L', 0.92, 0.05, '0.70', '1.10', 2], ['Créatinine', 'µmol/L', 78, 6, '45', '105', 0], ['Sodium', 'mmol/L', 140, 1.6, '136', '145', 0], ['Calcium', 'mmol/L', 2.38, 0.06, '2.20', '2.60', 2]],
  'Cobas pure': [['Potassium', 'mmol/L', 4.2, 0.12, '3.5', '5.1', 1], ['Troponine T hs', 'ng/L', 8, 2.2, null, '14', 0], ['CRP', 'mg/L', 2.6, 0.5, null, '5.0', 1]],
  'Alinity ci': [['Urée', 'mmol/L', 5.2, 0.5, '2.5', '7.5', 1], ['Bilirubine totale', 'µmol/L', 10, 1.8, null, '21', 0], ['ALAT', 'UI/L', 24, 2.5, '10', '40', 0]],
  'Atellica CH 930': [['Triglycérides', 'g/L', 1.15, 0.12, null, '1.50', 2], ['Acide urique', 'µmol/L', 300, 22, '150', '420', 0], ['Gamma-GT', 'UI/L', 28, 4, null, '55', 0]],
  'Sysmex XN-1000': [['Hémoglobine', 'g/dL', 13.8, 0.25, '12.0', '16.0', 1], ['Plaquettes', 'G/L', 250, 8, '150', '400', 0]],
  'Sysmex XN-550': [['Leucocytes', 'G/L', 6.4, 0.25, '4.0', '10.0', 1], ['Hémoglobine', 'g/dL', 13.7, 0.3, '12.0', '16.0', 1]],
  'DxH 900': [['Hématocrite', '%', 41.5, 0.9, '36', '48', 1], ['VGM', 'fL', 89, 1.4, '80', '100', 0]],
  'BC-6800 Plus': [['Réticulocytes', 'G/L', 55, 6, '20', '120', 0]],
  'Architect i2000SR': [['TSH', 'mUI/L', 1.9, 0.15, '0.4', '4.0', 2], ['Ferritine', 'µg/L', 110, 9, '30', '300', 0]],
  'cobas e 801': [['T4 libre', 'pmol/L', 15.5, 0.9, '12', '22', 1], ['PSA total', 'ng/mL', 1.3, 0.12, null, '4.0', 2], ['Vitamine B12', 'pmol/L', 330, 25, '145', '570', 0]],
  'Liaison XL': [['Vitamine D (25-OH)', 'ng/mL', 31, 2.6, '30', '100', 0]],
  'Tosoh HLC-723 G11': [['HbA1c', '%', 5.6, 0.12, null, '6.0', 1]],
  'ABL90 FLEX': [['pH', '', 7.40, 0.012, '7.35', '7.45', 2], ['Lactate', 'mmol/L', 1.2, 0.15, null, '2.0', 1]],
  'GEM Premier 5000': [['pO2', 'mmHg', 92, 3, '80', '100', 0], ['pCO2', 'mmHg', 40, 1.4, '35', '45', 0]],
  'STA R Max': [['TP (taux de prothrombine)', '%', 99, 1.6, '70', '130', 0], ['Fibrinogène', 'g/L', 3.1, 0.12, '2.0', '4.0', 1]],
  'CS-5100': [['TCA (ratio)', '', 1.02, 0.04, '0.80', '1.20', 2], ['D-dimères', 'µg/mL', 0.32, 0.05, null, '0.50', 2]],
  'Atellica UAS 800': [['Densité urinaire', '', 1.019, 0.002, '1.003', '1.030', 3]],
  'UF-5000': [['Leucocytes urinaires', '/µL', 8, 2, null, '20', 0]],
  'Capillarys 3 Tera': [['Albumine (électrophorèse)', '%', 60, 1.5, '55', '66', 1]],
  // Microbiologie : on suit des contrôles chiffrés (souches de référence, contrôle interne PCR)
  'MALDI Biotyper sirius': [['Score d’identification (souche de contrôle)', '', 2.25, 0.06, '2.00', null, 2]],
  'BacT/ALERT VIRTUO': [['Délai de positivité (souche de contrôle)', 'h', 14, 1.2, null, '24', 1]],
  'BD BACTEC FX': [['Délai de positivité (souche de contrôle)', 'h', 15, 1.3, null, '24', 1]],
  'GeneXpert XVI': [['Ct du contrôle interne (PCR)', '', 28.5, 0.6, '25', '32', 1]],
  'Vitek 2': [['CMI amoxicilline (souche E. coli ATCC 25922)', 'mg/L', 4, 0.45, '2', '8', 1]]
};

// Fabrique, pour chaque machine, un lot par trimestre en 2025–2026 (sauf machines
// sans mesure chiffrée). Quelques lots ont volontairement un défaut, pour que
// le site ait quelque chose à détecter.
function lotsGeneres(csvDecale) {
  const res = [];
  const BIOS = ['Dr. Amrani', 'Dr. Chen', 'Dr. El Fassi'];
  const TRIM = [[2025, 1], [2025, 4], [2025, 7], [2025, 10], [2026, 1], [2026, 4], [2026, 7], [2026, 10]];
  let n25 = 0;
  let n26 = 20;
  const normal = () => Math.sqrt(-2 * Math.log(tirage() + 1e-12)) * Math.cos(2 * Math.PI * tirage());
  Object.entries(PARAMETRES).forEach(([machine, params], im) => {
    const statut = (MACHINES.find((m) => m[0] === machine) || [])[3];
    TRIM.forEach(([annee, mois], it) => {
      const param = params[(it + im) % params.length];
      const [nomP, unite, moy, sd, bas, haut, dec] = param;
      if (statut === 'maintenance' && annee === 2026 && mois >= 7) return; // machine arrêtée
      if ((it + im) % 3 === 2 && annee === 2025) return; // pas de lot ce trimestre-là
      const moisLot = mois + Math.floor(tirage() * 3);
      const jour = 3 + Math.floor(tirage() * 20);
      const date = `${annee}-${String(moisLot).padStart(2, '0')}-${String(jour).padStart(2, '0')}`;
      if (date > '2026-11-15') return;
      const k = (im * 7 + it * 3) % 23; // « dé » déterministe pour choisir les défauts
      const valeurs = [];
      for (let i = 0; i < 25; i++) {
        let v = moy + normal() * sd;
        if (k === 4 && i === 17) v = moy + 4.2 * sd + (haut ? 0 : 0); // point aberrant -> alerte
        valeurs.push(Number(v.toFixed(dec)));
      }
      if (k === 9 && haut) valeurs[12] = Number((Number(haut) * 1.25).toFixed(dec)); // valeur au-dessus du seuil
      // 25 jours de mesures qui se terminent le jour du lot (jamais dans le futur)
      const points = valeurs.map((valeur, i) => {
        const d = new Date(Date.UTC(annee, moisLot - 1, jour - (valeurs.length - 1 - i)));
        return { valeur, date: d.toISOString().slice(0, 10) };
      });
      const recent = date >= '2026-10-01';
      const bio = recent && k % 2 === 0 ? null : BIOS[(im + it) % 3];
      // Une validation dure 12 mois : la plupart des lots de 2025 ont été revalidés en 2026,
      // les autres apparaissent « à revalider » (validation périmée).
      let dateVal = bio ? `${date.slice(0, 8)}${String(Math.min(28, jour + 3)).padStart(2, '0')}` : null;
      if (bio && annee === 2025 && k % 3 !== 0) dateVal = `2026-${String(Math.min(10, moisLot)).padStart(2, '0')}-${String(Math.min(28, jour + 2)).padStart(2, '0')}`;
      const reactif = `${nomP.slice(0, 1).toUpperCase()}-${100 + ((im * 13 + it * 7) % 400)}`;
      const lot = {
        nom: null,
        machine,
        date,
        conditions: k === 13
          ? 'Température 21°C'
          : `Température ${18 + (k % 6)}°C, Lot de réactifs ${reactif}, Calibration ${['matin', 'hebdomadaire', '2 niveaux', '3 niveaux'][k % 4]}`,
        csv: csvDecale(nomP, unite, points),
        biologiste: bio,
        date_validation: bio ? `${dateVal} ${String(9 + (k % 8)).padStart(2, '0')}:${String((k * 7) % 60).padStart(2, '0')}:00` : undefined,
        regles: [{ parametre: nomP, seuil_bas: bas, seuil_haut: haut, unite }]
      };
      res.push(lot);
    });
  });
  // Numérotation dans l'ordre des dates, comme dans un vrai registre.
  res.sort((a, b) => a.date.localeCompare(b.date) || a.machine.localeCompare(b.machine));
  for (const lot of res) {
    lot.nom = lot.date.startsWith('2025') ? `LOT-2025-${String(++n25).padStart(3, '0')}` : `LOT-2026-${String(++n26).padStart(3, '0')}`;
  }
  return res;
}

async function remplir({ run, get, all }) {
  initialiserHasard(20261009);
  const machineIds = {};
  for (const m of MACHINES) {
    const [nom, type, cal, statut, fabricant, miseEnService, secteur] = m;
    const serie = `${fabricant.slice(0, 3).toUpperCase()}-${codeVerificationStable(nom).slice(3, 9)}`;
    const existante = await get('SELECT id FROM machines WHERE nom = ?', [nom]);
    if (existante) {
      machineIds[nom] = existante.id;
      await run(
        `UPDATE machines SET type = ?, date_calibration = COALESCE(date_calibration, ?), statut_service = COALESCE(statut_service, ?),
          fabricant = ?, numero_serie = COALESCE(numero_serie, ?), mise_en_service = COALESCE(mise_en_service, ?), secteur = ? WHERE id = ?`,
        [type, cal, statut, fabricant, serie, miseEnService, secteur, existante.id]
      );
    } else {
      const { id } = await run(
        `INSERT INTO machines (nom, type, date_calibration, statut_service, fabricant, numero_serie, mise_en_service, secteur)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [nom, type, cal, statut, fabricant, serie, miseEnService, secteur]
      );
      machineIds[nom] = id;
    }
  }

  await remplirPatients({ run, get, all });
  const pseudos = await all('SELECT COALESCE(psn, code) AS code FROM patients_pseudo ORDER BY id');
  const codesPsn = (pseudos || []).map((p) => p.code);

  let decalagePsn = 0;
  function csvDecale(parametre, unite, points) {
    const csv = csvPoints(parametre, unite, points, codesPsn, decalagePsn);
    decalagePsn += Math.max(1, points.length);
    return csv;
  }

  const csvGlycemie = csvDecale('Glycémie à jeun', 'g/L', serieGlycemie());
  const csvHba1c = csvDecale('HbA1c', '%', [
    5.4, 5.6, 5.5, 5.8, 5.3, 5.7, 5.4, 5.6, 5.5, 5.9,
    5.4, 5.5, 5.7, 5.6, 5.4, 5.8, 5.5, 5.6, 5.3, 5.7, 5.5, 5.4, 5.6, 5.8, 5.5
  ].map((valeur, i) => ({ valeur, date: `2026-03-${String(i + 1).padStart(2, '0')}` })));
  const csvHb = csvDecale('Hémoglobine', 'g/dL', [
    13.2, 13.8, 14.1, 13.5, 13.9, 14.0, 13.4, 13.6, 13.7, 13.9,
    13.3, 13.8, 14.0, 13.5, 13.6, 13.9, 13.4, 13.7, 13.8, 14.1, 13.6, 13.5, 13.9, 13.7, 13.4
  ].map((valeur, i) => ({ valeur, date: `2026-02-${String(i + 1).padStart(2, '0')}` })));

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
      csv: csvDecale('TSH', 'mUI/L', [1.2, 1.8, 2.1, 1.5, 1.9, 2.0, 1.4, 1.7, 1.6, 1.9, 1.5, 1.8, 2.0, 1.6, 1.7, 1.9, 1.4, 1.8, 1.6, 2.0, 1.7, 1.5, 1.9, 1.6, 1.8].map((valeur, i) => ({ valeur, date: `2026-04-${String(i + 1).padStart(2, '0')}` }))),
      biologiste: 'Dr. Amrani',
      regles: [{ parametre: 'TSH', seuil_bas: '0.3', seuil_haut: '4.5', unite: 'mUI/L' }]
    },
    {
      nom: 'LOT-2026-005',
      machine: 'Cobas 8000',
      date: '2026-05-12',
      conditions: 'Température 22°C, Lot de réactifs C-18, Calibration journalière',
      csv: csvDecale('CRP', 'mg/L', [2.1, 3.4, 1.8, 4.2, 2.9, 3.1, 2.4, 2.8, 3.0, 2.6, 2.2, 3.3, 2.7, 2.9, 3.1, 2.5, 2.8, 3.2, 2.4, 2.7, 3.0, 2.6, 2.9, 3.1, 2.5].map((valeur, i) => ({ valeur, date: `2026-05-${String(i + 1).padStart(2, '0')}` }))),
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
      csv: csvDecale('Contrôle négatif', '', [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0].map((valeur, i) => ({ valeur, date: `2025-08-${String(i + 1).padStart(2, '0')}` }))),
      biologiste: 'Dr. Amrani',
      date: '2025-08-11',
      date_validation: '2025-08-12 09:00:00',
      regles: []
    },
    {
      nom: 'TEST — données fictives',
      machine: 'Cobas 8000',
      date: null,
      conditions: '',
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
      csv: csvDecale('Potassium', 'mmol/L', serieJours(2026, 7, [
        4.1, 4.2, 4.0, 4.3, 4.1, 4.2, 4.0, 4.1, 4.3, 4.2,
        4.1, 4.0, 4.2, 4.3, 4.1, 4.2, 6.9, 4.1, 4.0, 4.2,
        4.1, 4.3, 4.2, 4.0, 4.1
      ])),
      biologiste: 'Dr. Chen',
      regles: [{ parametre: 'Potassium', seuil_bas: '3.5', seuil_haut: '5.1', unite: 'mmol/L' }]
    },
    {
      nom: 'LOT-2026-009',
      machine: 'Architect i2000SR',
      date: '2026-09-04',
      conditions: '21',
      csv: csvDecale('Créatinine', 'µmol/L', serieJours(2026, 9, [78, 82, 80, 85, 79, 81, 83, 80])),
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
      csv: csvDecale('pH', '', serieJours(2026, 8, [
        7.38, 7.40, 7.39, 7.41, 7.38, 7.40, 7.39, 7.42, 7.38, 7.40,
        7.39, 7.41, 7.40, 7.38, 7.39, 7.41, 7.40, 7.38, 7.39, 7.40,
        7.41, 7.38, 7.40, 7.39, 7.41
      ])),
      biologiste: null,
      regles: [{ parametre: 'pH', seuil_bas: '7.35', seuil_haut: '7.45', unite: '' }]
    },
    {
      nom: 'LOT-2026-012',
      machine: 'Cobas 8000',
      date: '2026-08-28',
      conditions: 'Température 21°C, Lot de réactifs L-11, Calibration hebdomadaire',
      csv: csvDecale('Cholestérol total', 'g/L', serieJours(2026, 8, [
        1.82, 1.90, 1.86, 1.88, 1.84, 1.91, 1.87, 1.85, 1.89, 1.86,
        1.84, 1.90, 1.88, 1.85, 1.87, 1.89, 1.86, 1.84, 1.91, 1.88,
        1.85, 1.87, 1.90, 1.86, 1.88
      ])),
      biologiste: 'Dr. El Fassi',
      regles: [{ parametre: 'Cholestérol total', seuil_bas: null, seuil_haut: '2.00', unite: 'g/L' }]
    },
    {
      nom: 'LOT-2026-013',
      machine: 'Sysmex XN-1000',
      date: '2026-09-18',
      conditions: 'Température 22°C, Lot de réactifs S-18, Calibration 3 niveaux',
      csv: csvDecale('Plaquettes', 'G/L', serieJours(2026, 9, [
        245, 252, 238, 260, 241, 255, 248, 250, 243, 257,
        246, 251, 239, 258, 244, 249, 253, 247, 242, 256,
        250, 248, 245, 252, 249
      ])),
      biologiste: 'Dr. Amrani',
      date: '2026-09-18',
      date_validation: '2026-09-20 10:15:00',
      regles: [{ parametre: 'Plaquettes', seuil_bas: '150', seuil_haut: '400', unite: 'G/L' }]
    },
    {
      nom: 'LOT-2026-014',
      machine: 'STA R Max',
      date: '2026-08-27',
      conditions: 'Température 21°C, Lot de réactifs H-12, Calibration 2 niveaux',
      csv: csvDecale('TP (taux de prothrombine)', '%', serieJours(2026, 8, [
        98, 101, 99, 97, 100, 102, 98, 99, 101, 100,
        97, 99, 103, 98, 100, 101, 99, 98, 102, 100,
        99, 101, 98, 100, 99
      ])),
      biologiste: 'Dr. Amrani',
      date_validation: '2026-08-29 09:40:00',
      regles: [{ parametre: 'TP (taux de prothrombine)', seuil_bas: '70', seuil_haut: '130', unite: '%' }]
    },
    {
      nom: 'LOT-2026-015',
      machine: 'STA R Max',
      date: '2026-09-27',
      conditions: 'Température 21°C, Lot de réactifs H-12, Calibration 2 niveaux',
      csv: csvDecale('Fibrinogène', 'g/L', serieJours(2026, 9, [
        3.1, 3.0, 3.2, 3.1, 2.9, 3.3, 3.0, 3.1, 3.2, 3.0,
        2.9, 3.1, 3.2, 3.0, 3.1, 3.3, 3.0, 2.9, 3.1, 3.2,
        3.0, 4.4, 3.1, 3.0, 3.2
      ])),
      regles: [{ parametre: 'Fibrinogène', seuil_bas: '2.0', seuil_haut: '4.0', unite: 'g/L' }]
    },
    {
      nom: 'LOT-2026-016',
      machine: 'Atellica UAS 800',
      date: '2026-10-27',
      conditions: 'Température 22°C, Lot de bandelettes U-07, Calibration matin',
      csv: csvDecale('Densité urinaire', '', serieJours(2026, 10, [
        1.018, 1.020, 1.016, 1.022, 1.019, 1.017, 1.021, 1.018, 1.020, 1.019,
        1.016, 1.023, 1.018, 1.017, 1.020, 1.019, 1.021, 1.018, 1.016, 1.022,
        1.019, 1.020, 1.017, 1.018, 1.021
      ])),
      biologiste: 'Dr. Chen',
      date_validation: '2026-10-29 14:05:00',
      regles: [{ parametre: 'Densité urinaire', seuil_bas: '1.003', seuil_haut: '1.030', unite: '' }]
    },
    {
      nom: 'LOT-2026-017',
      machine: 'Cobas 8000',
      date: '2026-10-28',
      conditions: 'Température 21°C, Lot de réactifs R-455, Calibration matin',
      csv: csvDecale('ASAT', 'UI/L', serieJours(2026, 10, [
        26, 28, 25, 27, 29, 26, 28, 27, 25, 30,
        27, 26, 28, 29, 27, 25, 28, 26, 27, 29,
        28, 26, 27, 28, 25
      ])),
      biologiste: 'Dr. Amrani',
      date_validation: '2026-10-31 11:20:00',
      regles: [{ parametre: 'ASAT', seuil_bas: '10', seuil_haut: '40', unite: 'UI/L' }]
    },
    {
      nom: 'LOT-2026-018',
      machine: 'Cobas 8000',
      date: '2026-10-30',
      conditions: 'Température 21°C, Lot de réactifs R-455, Calibration matin',
      csv: csvDecale('ALAT', 'UI/L', serieJours(2026, 10, [
        24, 26, 23, 25, 27, 24, 26, 25, 23, 28,
        25, 24, 26, 27, 25, 23, 26, 24, 25, 27,
        26, 24, 25, 26, 23
      ])),
      regles: [{ parametre: 'ALAT', seuil_bas: '10', seuil_haut: '40', unite: 'UI/L' }]
    },
    {
      nom: 'LOT-2026-019',
      machine: 'Architect i2000SR',
      date: '2026-09-28',
      conditions: 'Température 22°C, Lot de réactifs I-31, Calibration 3 niveaux',
      csv: csvDecale('TSH', 'mUI/L', serieJours(2026, 9, [
        1.8, 2.0, 1.9, 2.1, 1.7, 2.0, 1.8, 1.9, 2.2, 1.8,
        2.0, 1.9, 1.7, 2.1, 1.9, 2.0, 1.8, 2.2, 1.9, 2.0,
        1.8, 1.9, 2.1, 1.9, 2.0
      ])),
      biologiste: 'Dr. Chen',
      date_validation: '2026-09-30 08:50:00',
      regles: [{ parametre: 'TSH', seuil_bas: '0.4', seuil_haut: '4.0', unite: 'mUI/L' }]
    },
    {
      nom: 'LOT-2026-020',
      machine: 'Sysmex XN-1000',
      date: '2026-11-02',
      conditions: 'Température 22°C, Lot de réactifs S-21, Calibration 3 niveaux',
      csv: csvDecale('Leucocytes', 'G/L', serieJours(2026, 10, [
        6.2, 6.5, 6.0, 6.8, 6.3, 6.1, 6.6, 6.4, 6.2, 6.7,
        6.0, 6.3, 6.5, 6.1, 6.4, 6.6, 6.2, 6.0, 6.5, 6.3,
        6.4, 6.1, 6.6, 6.2, 6.3
      ])),
      regles: [{ parametre: 'Leucocytes', seuil_bas: '4.0', seuil_haut: '10.0', unite: 'G/L' }]
    }
  ];
  lots.push(...lotsGeneres(csvDecale));

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
        codeVerificationStable(lot.nom),
        moyenne,
        valeurs.length ? JSON.stringify(valeurs) : null,
        dates && dates.length ? JSON.stringify(dates) : null,
        lot.archive ? 1 : 0,
        lot.est_test ? 1 : 0
      ]
      );
      id = ins.id;
    }

    await run('UPDATE lots SET code_verification = ? WHERE id = ?', [codeVerificationStable(lot.nom), id]);

    if (lot.biologiste) {
      const dateVal = lot.date_validation || `${lot.date || '2026-01-25'} 16:00:00`;
      const dejaVal = await get('SELECT id FROM validations WHERE lot_id = ? AND nom_biologiste = ?', [id, lot.biologiste]);
      if (!dejaVal) {
        await run(
          'INSERT INTO validations (lot_id, nom_biologiste, date_validation) VALUES (?, ?, ?)',
          [id, lot.biologiste, dateVal]
        );
      } else {
        await run(
          'UPDATE validations SET date_validation = ? WHERE lot_id = ? AND nom_biologiste = ?',
          [dateVal, id, lot.biologiste]
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
    if (lignesCsv.length > 1 && /code_patient/i.test(lignesCsv[0])) {
      await run('DELETE FROM mesures_reference WHERE lot_id = ?', [id]);
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
      try { await appliquerReglesSurLot({ run, get, all }, id); } catch { /* seed */ }
    }

    const dateCrea = lot.date ? `${lot.date} 08:30:00` : '2026-01-10 08:30:00';
    const dejaHist = await get("SELECT id FROM historique_lots WHERE lot_id = ? AND champ = 'création'", [id]);
    if (!dejaHist) {
      await run(
        `INSERT INTO historique_lots (lot_id, champ, ancienne_valeur, nouvelle_valeur, date, utilisateur, motif)
         VALUES (?, 'création', '', ?, ?, 'système', 'jeu de démonstration')`,
        [id, lot.nom, dateCrea]
      );
    }
    if (lot.biologiste) {
      const dejaValH = await get("SELECT id FROM historique_lots WHERE lot_id = ? AND champ = 'validation'", [id]);
      if (!dejaValH) {
        await run(
          `INSERT INTO historique_lots (lot_id, champ, ancienne_valeur, nouvelle_valeur, date, utilisateur, motif)
           VALUES (?, 'validation', '', ?, ?, ?, 'signature du lot')`,
          [id, lot.biologiste, lot.date_validation || `${lot.date || '2026-01-25'} 16:00:00`, lot.biologiste]
        );
      }
    }
    if (lot.archive) {
      const dejaArch = await get("SELECT id FROM historique_lots WHERE lot_id = ? AND champ = 'archivage'", [id]);
      if (!dejaArch) {
        await run(
          `INSERT INTO historique_lots (lot_id, champ, ancienne_valeur, nouvelle_valeur, date, utilisateur, motif)
           VALUES (?, 'archivage', 'actif', 'archivé', ?, 'système', 'jeu de démonstration')`,
          [id, lot.date ? `${lot.date} 18:00:00` : dateCrea]
        );
      }
    }
    const dejaJ = await get("SELECT id FROM journal_audit WHERE cible = ? AND action = 'création lot'", [`lot ${id}`]);
    if (!dejaJ) {
      await run(
        `INSERT INTO journal_audit (utilisateur_id, nom_affiche, action, cible, details, date)
         VALUES (NULL, 'système', 'création lot', ?, ?, ?)`,
        [`lot ${id}`, lot.nom, dateCrea]
      );
    }
    if (lot.biologiste) {
      const dejaJv = await get("SELECT id FROM journal_audit WHERE cible = ? AND action = 'validation lot'", [`lot ${id}`]);
      if (!dejaJv) {
        await run(
          `INSERT INTO journal_audit (utilisateur_id, nom_affiche, action, cible, details, date)
           VALUES (NULL, ?, 'validation lot', ?, ?, ?)`,
          [lot.biologiste, `lot ${id}`, lot.biologiste, lot.date_validation || `${lot.date || '2026-01-25'} 16:00:00`]
        );
      }
    }
  }

  await run("UPDATE lots SET archive = 1 WHERE lower(nom) LIKE 'loot%' OR nom IN ('Glycémie — série incomplète','Créatinine — données manquantes')");

  await synchroniserSignalements({ run, get, all });

  const brutes = await all(`
    SELECT patients_identite.id AS personne_id,
      patients_identite.date_naissance, patients_identite.sexe, patients_identite.departement,
      patients_identite.code_postal, mesures_reference.parametre, mesures_reference.valeur,
      mesures_reference.unite, mesures_reference.date
    FROM mesures_reference
    JOIN patients_pseudo ON upper(COALESCE(patients_pseudo.psn, patients_pseudo.code)) = upper(mesures_reference.code_patient)
    JOIN patients_identite ON patients_identite.id = COALESCE(patients_pseudo.identite_id, patients_pseudo.patient_id)
  `);
  const jeu = genererJeu(brutes || []);
  await run('DELETE FROM donnees_anonymisees');
  for (const l of jeu.lignes) {
    await run(
      `INSERT INTO donnees_anonymisees (tranche_age, sexe, territoire, parametre, valeur, unite, mois)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [l.tranche_age, l.sexe, l.territoire, l.parametre, l.valeur, l.unite, l.mois]
    );
  }
  await run('DELETE FROM anonymisation_meta');
  await run(
    `INSERT INTO anonymisation_meta (genere_le, genere_par, nb_lignes, generalisees, supprimees, k_min)
     VALUES (?, 'système', ?, ?, ?, ?)`,
    ['2026-09-21 11:00:00', jeu.nb_lignes, jeu.generalisees, jeu.supprimees, jeu.k_min]
  );

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
