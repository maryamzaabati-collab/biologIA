// Remplit labo.db avec des machines, lots complets, CSV anonymises et validations.
const fs = require('fs');
const path = require('path');
const db = require('./db');
const { analyserCsv, problemesLot, colonnesSensibles, genererCodeVerification } = require('./lib/tracabilite');

const csvDir = path.join(__dirname, 'data', 'csv');

function lireCsv(fichier) {
  return fs.readFileSync(path.join(csvDir, fichier), 'utf8');
}

async function verifierEtSignaler(lotId, champs) {
  const problemes = problemesLot(champs);
  const statut = problemes.length === 0 ? 'ok' : 'douteux';
  await db.run('UPDATE lots SET statut = ? WHERE id = ?', [statut, lotId]);
  await db.run('DELETE FROM signalements WHERE lot_id = ?', [lotId]);
  for (const raison of problemes) {
    await db.run('INSERT INTO signalements (lot_id, raison) VALUES (?, ?)', [lotId, raison]);
  }
  return statut;
}

async function seed() {
  await db.init();

  await db.run('DELETE FROM regles_alerte');
  await db.run('DELETE FROM historique_lots');
  await db.run('DELETE FROM signalements');
  await db.run('DELETE FROM validations');
  await db.run('DELETE FROM lots');
  await db.run('DELETE FROM machines');
  await db.run("DELETE FROM sqlite_sequence");

  const machines = [
    ['Cobas 8000', 'biochimie'],
    ['Sysmex XN-1000', 'hematologie'],
    ['Architect i2000SR', 'immunologie'],
    ['ABL90 FLEX', 'gazometrie'],
    ['Vitek 2', 'microbiologie']
  ];
  const machineIds = {};
  for (const [nom, type] of machines) {
    const { id } = await db.run('INSERT INTO machines (nom, type) VALUES (?, ?)', [nom, type]);
    machineIds[nom] = id;
  }

  const lots = [
    {
      nom: 'Glycémie — série janvier',
      machine: 'Cobas 8000',
      date: '2026-01-14',
      conditions: 'Calibration matin, 21°C, contrôle interne passé',
      csv: 'glycemie-janvier.csv',
      biologiste: 'Dr. Amrani',
      regles: [
        { parametre: 'Glycémie à jeun', seuil_bas: '0.70', seuil_haut: '1.10', unite: 'g/L' },
        { parametre: 'Glycémie post-prandiale', seuil_bas: null, seuil_haut: '1.40', unite: 'g/L' }
      ]
    },
    {
      nom: 'HbA1c — contrôle T1',
      machine: 'Cobas 8000',
      date: '2026-03-02',
      conditions: 'Réactif lot R-441, calibration hebdomadaire',
      csv: 'hba1c-q1.csv',
      biologiste: 'Dr. Chen',
      regles: [
        { parametre: 'HbA1c', seuil_bas: null, seuil_haut: '6.0', unite: '%' }
      ]
    },
    {
      nom: 'NFS — série du matin',
      machine: 'Sysmex XN-1000',
      date: '2026-02-18',
      conditions: 'Contrôle 3 niveaux, agitation 10 min',
      csv: 'nfs-matin.csv',
      biologiste: 'Dr. El Fassi',
      regles: [
        { parametre: 'Hémoglobine', seuil_bas: '12.0', seuil_haut: '16.0', unite: 'g/dL' },
        { parametre: 'Leucocytes', seuil_bas: '4.0', seuil_haut: '10.0', unite: 'G/L' },
        { parametre: 'Plaquettes', seuil_bas: '150', seuil_haut: '400', unite: 'G/L' }
      ]
    },
    {
      nom: 'Plaquettes — série référence',
      machine: 'Sysmex XN-1000',
      date: '2026-02-19',
      conditions: 'Même calibration que la série NFS',
      csv: 'plaquettes.csv',
      biologiste: 'Dr. El Fassi',
      regles: [
        { parametre: 'Plaquettes', seuil_bas: '150', seuil_haut: '400', unite: 'G/L' }
      ]
    },
    {
      nom: 'TSH — données de référence',
      machine: 'Architect i2000SR',
      date: '2026-04-08',
      conditions: 'Chambre 4°C, réactif ouvert J+2',
      csv: 'tsh-reference.csv',
      biologiste: 'Dr. Amrani',
      regles: [
        { parametre: 'TSH', seuil_bas: '0.3', seuil_haut: '4.5', unite: 'mUI/L' }
      ]
    },
    {
      nom: 'Troponine hs — seuil d’alerte',
      machine: 'Architect i2000SR',
      date: '2026-04-09',
      conditions: 'Contrôle bas / haut validés',
      csv: 'troponine.csv',
      biologiste: 'Dr. Chen',
      regles: [
        { parametre: 'Troponine hs', seuil_bas: null, seuil_haut: '0.014', unite: 'µg/L' }
      ]
    },
    {
      nom: 'CRP — série inflammation',
      machine: 'Cobas 8000',
      date: '2026-05-12',
      conditions: 'Température ambiante 22°C, CQ journalier OK',
      csv: 'crp-serie.csv',
      biologiste: 'Dr. Amrani',
      regles: [
        { parametre: 'CRP', seuil_bas: null, seuil_haut: '5.0', unite: 'mg/L' }
      ]
    },
    {
      nom: 'Créatinine — série rénale',
      machine: 'Cobas 8000',
      date: '2026-05-13',
      conditions: 'Méthode enzymatique, blanc réactif OK',
      csv: 'creatinine.csv',
      biologiste: 'Dr. Chen',
      regles: [
        { parametre: 'Créatinine', seuil_bas: null, seuil_haut: '12.0', unite: 'mg/L' }
      ]
    },
    {
      nom: 'Ionogramme — série électrolytes',
      machine: 'Cobas 8000',
      date: '2026-06-03',
      conditions: 'ISE calibrées, pente dans les limites',
      csv: 'ionogramme.csv',
      biologiste: 'Dr. El Fassi',
      regles: [
        { parametre: 'Sodium', seuil_bas: '135', seuil_haut: '145', unite: 'mmol/L' },
        { parametre: 'Potassium', seuil_bas: '3.5', seuil_haut: '5.0', unite: 'mmol/L' }
      ]
    },
    {
      nom: 'Bilan hépatique — série enzymes',
      machine: 'Cobas 8000',
      date: '2026-06-04',
      conditions: 'Cinétique 37°C, contrôles N et P OK',
      csv: 'bilan-hepatique.csv',
      biologiste: 'Dr. Amrani',
      regles: [
        { parametre: 'ALAT', seuil_bas: null, seuil_haut: '50', unite: 'UI/L' },
        { parametre: 'ASAT', seuil_bas: null, seuil_haut: '40', unite: 'UI/L' }
      ]
    },
    {
      nom: 'Gaz du sang — calibration ABL',
      machine: 'ABL90 FLEX',
      date: '2026-07-21',
      conditions: 'Cassette neuve, auto-QC passé',
      csv: 'gazometrie.csv',
      biologiste: 'Dr. Chen',
      regles: [
        { parametre: 'pH', seuil_bas: '7.35', seuil_haut: '7.45', unite: '' },
        { parametre: 'pO2', seuil_bas: '75', seuil_haut: null, unite: 'mmHg' },
        { parametre: 'pCO2', seuil_bas: '35', seuil_haut: '45', unite: 'mmHg' }
      ]
    },
    {
      nom: 'Lactate — série urgence',
      machine: 'ABL90 FLEX',
      date: '2026-07-22',
      conditions: 'Même cassette que la série gazométrie',
      csv: 'lactate.csv',
      biologiste: 'Dr. El Fassi',
      regles: [
        { parametre: 'Lactate', seuil_bas: null, seuil_haut: '2.0', unite: 'mmol/L' }
      ]
    },
    {
      nom: 'Hémocultures — contrôles négatifs',
      machine: 'Vitek 2',
      date: '2026-08-11',
      conditions: 'Enceinte 35°C, cartes identification lot C-19',
      csv: 'hemoculture.csv',
      biologiste: 'Dr. Amrani',
      regles: []
    },
    {
      nom: 'Glycémie — série incomplète',
      machine: 'Cobas 8000',
      date: '2026-09-10',
      conditions: '', // Incomplete: no conditions
      csv: 'glycemie-janvier.csv',
      biologiste: null, // Incomplete: no validation
      regles: [
        { parametre: 'Glycémie à jeun', seuil_bas: '0.70', seuil_haut: '1.10', unite: 'g/L' }
      ]
    },
    {
      nom: 'Créatinine — données manquantes',
      machine: 'Cobas 8000',
      date: null, // Incomplete: no date
      conditions: 'Méthode enzymatique',
      csv: 'creatinine.csv',
      biologiste: null, // Incomplete: no validation
      regles: [
        { parametre: 'Créatinine', seuil_bas: null, seuil_haut: '12.0', unite: 'mg/L' }
      ]
    },
    {
      nom: 'Hémoglobine — sans validation',
      machine: 'Sysmex XN-1000',
      date: '2026-09-12',
      conditions: 'Contrôle interne OK',
      csv: 'nfs-matin.csv',
      biologiste: null, // Incomplete: no validation
      regles: [
        { parametre: 'Hémoglobine', seuil_bas: '12.0', seuil_haut: '16.0', unite: 'g/dL' }
      ]
    }
  ];

  let conformes = 0;
  let valides = 0;

  for (const lot of lots) {
    const csvTexte = lireCsv(lot.csv);
    const { colonnes, sensibles, valeurs, moyenne } = analyserCsv(csvTexte);
    if (sensibles.length) {
      throw new Error(`CSV non conforme (${lot.csv}) : ${sensibles.join(', ')}`);
    }

    const machine_id = machineIds[lot.machine];
    const colonnes_csv = JSON.stringify(colonnes);
    const { id } = await db.run(
      `INSERT INTO lots (nom, machine_id, date, conditions, anonymise, colonnes_csv, alerte_identite,
        code_verification, moyenne_controle, valeurs_controle)
       VALUES (?, ?, ?, ?, 1, ?, 0, ?, ?, ?)`,
      [lot.nom, machine_id, lot.date, lot.conditions, colonnes_csv,
        genererCodeVerification(), moyenne, valeurs.length ? JSON.stringify(valeurs) : null]
    );

    const statut = await verifierEtSignaler(id, {
      machine_id,
      date: lot.date,
      conditions: lot.conditions,
      anonymise: 1,
      sensibles: colonnesSensibles(colonnes)
    });
    if (statut === 'ok') {
      conformes += 1;
    } else {
      console.log(`Le lot "${lot.nom}" est ${statut} (attendu pour lot incomplet).`);
    }

    // Only validate if biologiste is specified
    if (lot.biologiste) {
      const dateVal = lot.nom.includes('Hémocultures')
        ? "datetime('now', '-14 months', 'localtime')"
        : "datetime('now', 'localtime')";
      await db.run(
        `INSERT INTO validations (lot_id, nom_biologiste, date_validation) VALUES (?, ?, ${dateVal})`,
        [id, lot.biologiste]
      );
      valides += 1;
    } else {
      console.log(`Le lot "${lot.nom}" n'a pas de biologiste (attendu pour lot incomplet).`);
    }

    // Insert regles_alerte for this lot
    if (lot.regles && lot.regles.length > 0) {
      for (const regle of lot.regles) {
        await db.run(
          'INSERT INTO regles_alerte (lot_id, parametre, seuil_bas, seuil_haut, unite) VALUES (?, ?, ?, ?, ?)',
          [id, regle.parametre, regle.seuil_bas, regle.seuil_haut, regle.unite]
        );
      }
    }
  }

  const glycemie = await db.get("SELECT id, conditions FROM lots WHERE nom LIKE 'Glycémie — série janvier%'");
  if (glycemie) {
    const nouvelle = glycemie.conditions + ' — recontrôle après maintenance';
    await db.run(
      'INSERT INTO historique_lots (lot_id, champ, ancienne_valeur, nouvelle_valeur) VALUES (?, ?, ?, ?)',
      [glycemie.id, 'conditions', glycemie.conditions, nouvelle]
    );
    await db.run('UPDATE lots SET conditions = ? WHERE id = ?', [nouvelle, glycemie.id]);
  }

  const { nMachines } = await db.get('SELECT COUNT(*) AS nMachines FROM machines');
  const { nLots } = await db.get('SELECT COUNT(*) AS nLots FROM lots');
  const { nOk } = await db.get("SELECT COUNT(*) AS nOk FROM lots WHERE statut = 'ok'");
  const { nSig } = await db.get('SELECT COUNT(*) AS nSig FROM signalements WHERE resolu = 0');

  console.log(`Machines : ${nMachines}`);
  console.log(`Lots : ${nLots} (conformes : ${nOk}, validés : ${valides})`);
  console.log(`Signalements ouverts : ${nSig}`);
  console.log('Base de demonstration prete.');
  db.fermer();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
