// Jeu de données du réseau « biologIA Sud » : 12 laboratoires de la région
// Provence-Alpes-Côte d'Azur, leurs analyseurs, un an de contrôles qualité,
// des campagnes inter-laboratoires et des lots de référence.
//
// Ce qui est RÉEL (sources publiques) :
//   - villes, codes INSEE et populations municipales : @etalab/decoupage-administratif 6.0.0 ;
//   - volumes nationaux d'actes remboursés de janvier à juin 2026, par code NABM :
//     Assurance Maladie (Cnam), données mensuelles « biologie médicale 2026 » ;
//   - contours des départements (fichier frontend/donnees/carte-sud.json).
// Ce qui est SIMULÉ (aucun vrai laboratoire, aucun vrai patient) :
//   - les sites du réseau, les analyseurs, les valeurs de contrôle qualité,
//     les dérives, les campagnes inter-laboratoires et les lots de référence.
// La simulation est déterministe (graine fixe) : tout le monde voit les mêmes chiffres.

const VERSION_JEU = 'reseau-sud-v3';

// Population municipale totale de la France (somme des communes du référentiel
// @etalab/decoupage-administratif 6.0.0, métropole + DROM).
const POPULATION_FRANCE = 68_000_000;
// Part de la population d'une commune qui fait ses analyses dans le site du réseau.
const PART_DE_MARCHE = { plateau: 0.24, proximite: 0.32 };

const SITES = [
  { code: 'NIC', nom: 'biologIA Nice Centre', ville: 'Nice', insee: '06088', dep: '06', population: 357737, lat: 43.7031, lon: 7.2661, type: 'plateau', accredite: '2016-11-01', responsable: 'Dr. Amrani' },
  { code: 'MRS', nom: 'biologIA Marseille Prado', ville: 'Marseille', insee: '13055', dep: '13', population: 886040, lat: 43.2780, lon: 5.3880, type: 'plateau', accredite: '2016-06-15', responsable: 'Dr. Chen' },
  { code: 'TLN', nom: 'biologIA Toulon Mayol', ville: 'Toulon', insee: '83137', dep: '83', population: 179116, lat: 43.1242, lon: 5.9280, type: 'plateau', accredite: '2017-03-01', responsable: 'Dr. El Fassi' },
  { code: 'AVI', nom: 'biologIA Avignon Remparts', ville: 'Avignon', insee: '84007', dep: '84', population: 92188, lat: 43.9493, lon: 4.8055, type: 'proximite', plateau: 'MRS', accredite: '2018-10-01', responsable: 'Dr. Chen' },
  { code: 'AIX', nom: 'biologIA Aix Mirabeau', ville: 'Aix-en-Provence', insee: '13001', dep: '13', population: 149695, lat: 43.5297, lon: 5.4474, type: 'proximite', plateau: 'MRS', accredite: '2018-10-01', responsable: 'Dr. Chen' },
  { code: 'ARL', nom: 'biologIA Arles', ville: 'Arles', insee: '13004', dep: '13', population: 51811, lat: 43.6766, lon: 4.6278, type: 'proximite', plateau: 'MRS', accredite: '2019-05-01', responsable: 'Dr. Chen' },
  { code: 'CAN', nom: 'biologIA Cannes Croisette', ville: 'Cannes', insee: '06029', dep: '06', population: 74350, lat: 43.5528, lon: 7.0174, type: 'proximite', plateau: 'NIC', accredite: '2018-04-01', responsable: 'Dr. Amrani' },
  { code: 'ANT', nom: 'biologIA Antibes', ville: 'Antibes', insee: '06004', dep: '06', population: 77637, lat: 43.5808, lon: 7.1251, type: 'proximite', plateau: 'NIC', accredite: '2018-04-01', responsable: 'Dr. Amrani' },
  { code: 'MEN', nom: 'biologIA Menton', ville: 'Menton', insee: '06083', dep: '06', population: 30604, lat: 43.7747, lon: 7.4975, type: 'proximite', plateau: 'NIC', accredite: '2019-09-01', responsable: 'Dr. Amrani' },
  { code: 'FRE', nom: 'biologIA Fréjus', ville: 'Fréjus', insee: '83061', dep: '83', population: 59719, lat: 43.4331, lon: 6.7370, type: 'proximite', plateau: 'TLN', accredite: '2019-01-15', responsable: 'Dr. El Fassi' },
  { code: 'GAP', nom: 'biologIA Gap Alpes', ville: 'Gap', insee: '05061', dep: '05', population: 41293, lat: 44.5594, lon: 6.0786, type: 'proximite', plateau: 'MRS', accredite: '2019-06-01', responsable: 'Dr. Chen' },
  { code: 'DIG', nom: 'biologIA Digne', ville: 'Digne-les-Bains', insee: '04070', dep: '04', population: 17979, lat: 44.0925, lon: 6.2356, type: 'proximite', plateau: 'MRS', accredite: '2020-02-01', responsable: 'Dr. Chen' },
  { code: 'GRA', nom: 'biologIA Grasse', ville: 'Grasse', insee: '06069', dep: '06', population: 50970, lat: 43.6589, lon: 6.9236, type: 'proximite', plateau: 'NIC', accredite: '2019-03-01', responsable: 'Dr. Amrani' },
  { code: 'HYE', nom: 'biologIA Hyères', ville: 'Hyères', insee: '83069', dep: '83', population: 55858, lat: 43.1204, lon: 6.1286, type: 'proximite', plateau: 'TLN', accredite: '2018-11-01', responsable: 'Dr. El Fassi' },
  { code: 'DRA', nom: 'biologIA Draguignan', ville: 'Draguignan', insee: '83050', dep: '83', population: 40826, lat: 43.5366, lon: 6.4646, type: 'proximite', plateau: 'TLN', accredite: '2019-04-01', responsable: 'Dr. El Fassi' },
  { code: 'SAL', nom: 'biologIA Salon-de-Provence', ville: 'Salon-de-Provence', insee: '13103', dep: '13', population: 44194, lat: 43.6403, lon: 5.0973, type: 'proximite', plateau: 'MRS', accredite: '2019-02-01', responsable: 'Dr. Chen' },
  { code: 'MAR', nom: 'biologIA Martigues', ville: 'Martigues', insee: '13056', dep: '13', population: 48298, lat: 43.4053, lon: 5.0476, type: 'proximite', plateau: 'MRS', accredite: '2019-02-01', responsable: 'Dr. Chen' },
  { code: 'MAN', nom: 'biologIA Manosque', ville: 'Manosque', insee: '04112', dep: '04', population: 22718, lat: 43.8343, lon: 5.7836, type: 'proximite', plateau: 'MRS', accredite: '2020-01-15', responsable: 'Dr. Chen' },
  { code: 'BRI', nom: 'biologIA Briançon', ville: 'Briançon', insee: '05023', dep: '05', population: 11411, lat: 44.8986, lon: 6.6436, type: 'proximite', plateau: 'MRS', accredite: '2020-06-01', responsable: 'Dr. Chen' },
  { code: 'CAR', nom: 'biologIA Carpentras', ville: 'Carpentras', insee: '84031', dep: '84', population: 31619, lat: 44.0556, lon: 5.0489, type: 'proximite', plateau: 'MRS', accredite: '2019-10-01', responsable: 'Dr. Chen' }
];

// Analytes suivis. actes_s1_2026 = actes remboursés en France de janvier à juin 2026 (Cnam).
// cible_n1 / cible_n2 : valeurs des deux niveaux de contrôle (bas / haut).
// cv : imprécision analytique typique (%). eta : erreur totale admissible (%),
// valeurs indicatives inspirées de la réglementation américaine CLIA (2024)
// et de la base de variation biologique EFLM.
const ANALYTES = [
  { code: 'HB', libelle: 'Hémoglobine (NFS)', unite: 'g/dL', nabm: '1104', libelle_nabm: 'Hémogramme y compris plaquettes', actes_s1_2026: 35921622, montant_s1_2026: 118663468, cible_n1: 8.0, cible_n2: 14.5, cv: 0.8, eta: 4, discipline: 'hematologie', ref_bas: 12.0, ref_haut: 16.0, moy_pop: 13.9, sd_pop: 1.2, decimales: 1 },
  { code: 'CREA', libelle: 'Créatinine', unite: 'µmol/L', nabm: '0592', libelle_nabm: 'Créatinine (créatininémie)', actes_s1_2026: 34469747, montant_s1_2026: 41074254, cible_n1: 90, cible_n2: 400, cv: 2.4, eta: 10, discipline: 'biochimie', ref_bas: 45, ref_haut: 105, moy_pop: 78, sd_pop: 15, decimales: 0 },
  { code: 'K', libelle: 'Potassium (ionogramme)', unite: 'mmol/L', nabm: '1609', libelle_nabm: 'Ionogramme (Na + K ± Cl)', actes_s1_2026: 26960306, montant_s1_2026: 47764830, cible_n1: 4.0, cible_n2: 6.5, cv: 1.3, eta: 7.5, discipline: 'biochimie', ref_bas: 3.5, ref_haut: 5.1, moy_pop: 4.25, sd_pop: 0.38, decimales: 2 },
  { code: 'ALAT', libelle: 'ALAT (transaminases)', unite: 'UI/L', nabm: '0522', libelle_nabm: 'Transaminases ALAT et ASAT', actes_s1_2026: 26134266, montant_s1_2026: 45501521, cible_n1: 35, cible_n2: 150, cv: 3.0, eta: 15, discipline: 'biochimie', ref_bas: 7, ref_haut: 45, moy_pop: 24, sd_pop: 9, decimales: 0 },
  { code: 'CRP', libelle: 'CRP', unite: 'mg/L', nabm: '1804', libelle_nabm: 'Protéine C réactive', actes_s1_2026: 20924098, montant_s1_2026: 28430745, cible_n1: 8, cible_n2: 60, cv: 3.5, eta: 20, discipline: 'biochimie', ref_bas: null, ref_haut: 5, moy_pop: 2.4, sd_pop: 1.3, decimales: 1 },
  { code: 'CHOL', libelle: 'Cholestérol total', unite: 'g/L', nabm: '0996', libelle_nabm: 'Exploration d’une anomalie lipidique', actes_s1_2026: 19198021, montant_s1_2026: 56621705, cible_n1: 1.6, cible_n2: 2.8, cv: 2.0, eta: 10, discipline: 'biochimie', ref_bas: null, ref_haut: 2.0, moy_pop: 1.9, sd_pop: 0.32, decimales: 2 },
  { code: 'TSH', libelle: 'TSH', unite: 'mUI/L', nabm: '1208', libelle_nabm: 'TSH (sang)', actes_s1_2026: 16121768, montant_s1_2026: 57955532, cible_n1: 0.9, cible_n2: 9.0, cv: 4.0, eta: 20, discipline: 'immunologie', ref_bas: 0.4, ref_haut: 4.0, moy_pop: 1.8, sd_pop: 0.75, decimales: 2 },
  { code: 'FERR', libelle: 'Ferritine', unite: 'µg/L', nabm: '1213', libelle_nabm: 'Ferritine (dosage)', actes_s1_2026: 15235228, montant_s1_2026: 47138066, cible_n1: 60, cible_n2: 400, cv: 4.0, eta: 20, discipline: 'immunologie', ref_bas: 30, ref_haut: 300, moy_pop: 110, sd_pop: 55, decimales: 0 },
  { code: 'HBA1C', libelle: 'HbA1c', unite: '%', nabm: '1577', libelle_nabm: 'HbA1c (dosage)', actes_s1_2026: 10333555, montant_s1_2026: 28998872, cible_n1: 5.5, cible_n2: 9.5, cv: 1.6, eta: 8, discipline: 'biochimie', ref_bas: null, ref_haut: 6.0, moy_pop: 5.6, sd_pop: 0.45, decimales: 1 },
  { code: 'PSA', libelle: 'PSA (prostate)', unite: 'ng/mL', nabm: '7318', libelle_nabm: 'Antigène prostatique spécifique (PSA total)', actes_s1_2026: 4812512, montant_s1_2026: 27429931, cible_n1: 1.0, cible_n2: 20, cv: 3.5, eta: 20, discipline: 'immunologie', ref_bas: null, ref_haut: 4.0, moy_pop: 1.3, sd_pop: 0.9, decimales: 2 },
  // Analyses suivies seulement en volume (pas de contrôle quantitatif dans la simulation)
  { code: 'ECBU', libelle: 'ECBU (urines)', unite: null, nabm: '5201', libelle_nabm: 'Examen cytobactériologique des urines', actes_s1_2026: 5234141, montant_s1_2026: 47775415, discipline: 'microbiologie', qc: false },
  { code: 'HEPB', libelle: 'Hépatite B (dépistage)', unite: null, nabm: '4500', libelle_nabm: 'Hépatite B : dépistage et/ou diagnostic', actes_s1_2026: 2288309, montant_s1_2026: 38401017, discipline: 'serologie', qc: false },
  { code: 'HEPC', libelle: 'Hépatite C (dépistage)', unite: null, nabm: '3784', libelle_nabm: 'Hépatite C : anticorps anti-VHC', actes_s1_2026: 2274280, montant_s1_2026: 24425728, discipline: 'serologie', qc: false },
  { code: 'VIH', libelle: 'VIH (dépistage)', unite: null, nabm: '0388', libelle_nabm: 'Infection à VIH 1 et 2 : dépistage', actes_s1_2026: 2357451, montant_s1_2026: 23589266, discipline: 'serologie', qc: false }
];

const BIOCHIMIE_PLATEAU = ['CREA', 'K', 'ALAT', 'CRP', 'CHOL', 'HBA1C'];
const BIOCHIMIE_PROXIMITE = ['CREA', 'K', 'ALAT', 'CRP'];
const IMMUNO = ['TSH', 'FERR', 'PSA'];

// Analyseurs : à Nice, on réutilise les machines déjà présentes dans le registre.
const MODELES = {
  NIC: { biochimie: ['Cobas 8000', 'Roche'], immunologie: ['Architect i2000SR', 'Abbott'], hematologie: ['Sysmex XN-1000', 'Sysmex'] },
  MRS: { biochimie: ['Atellica CH 930', 'Siemens'], immunologie: ['Atellica IM 1600', 'Siemens'], hematologie: ['Sysmex XN-2000', 'Sysmex'] },
  TLN: { biochimie: ['cobas pro c 503', 'Roche'], immunologie: ['cobas pro e 801', 'Roche'], hematologie: ['Sysmex XN-1500', 'Sysmex'] },
  proximite: { biochimie: ['Alinity ci', 'Abbott'], hematologie: ['Sysmex XN-550', 'Sysmex'] }
};

// Incidents simulés : ce que le registre doit détecter, tracer et relier aux lots.
const INCIDENTS = [
  { site: 'TLN', discipline: 'biochimie', analyte: 'K', debut: '2026-06-09', type: 'decalage', ampleur: 2.4,
    cause: 'Nouveau lot de réactif potassium (K-58) mis en service sans recalibration.',
    action: 'Recalibration, contrôle des 2 niveaux, repasse des échantillons du jour.' },
  { site: 'MRS', discipline: 'immunologie', analyte: 'TSH', debut: '2026-03-16', type: 'decalage', ampleur: 2.1,
    cause: 'Calibration TSH réalisée avec un calibrant mal reconstitué.',
    action: 'Nouvelle calibration avec un calibrant neuf, information des prescripteurs.' },
  { site: 'CAN', discipline: 'biochimie', analyte: 'CRP', debut: '2026-08-18', type: 'decalage', ampleur: -2.6,
    cause: 'Réactif CRP stocké hors froid pendant un week-end de canicule.',
    action: 'Réactif détruit, nouveau flacon, contrôle de la chaîne du froid.' },
  { site: 'GAP', discipline: 'hematologie', analyte: 'HB', debut: '2026-09-01', type: 'tendance', ampleur: 0.07,
    cause: 'Lampe de mesure de l’hémoglobine en fin de vie (maintenance repoussée).',
    action: 'Remplacement de la lampe par le fabricant, maintenance préventive replanifiée.' },
  { site: 'AVI', discipline: 'biochimie', analyte: 'CREA', debut: '2026-10-06', type: 'imprecision', ampleur: 2.8,
    cause: 'Aiguille de prélèvement encrassée : volumes pipetés irréguliers.',
    action: 'Nettoyage et changement de l’aiguille, vérification de la répétabilité.' },
  { site: 'MRS', discipline: 'hematologie', analyte: 'HB', debut: '2025-02-10', type: 'decalage', ampleur: 2.3,
    cause: 'Nouveau lot de réactif de lyse mis en service sans vérification sur les contrôles.',
    action: 'Retour à l’ancien lot, vérification du nouveau lot, repasse des NFS du jour.' },
  { site: 'NIC', discipline: 'immunologie', analyte: 'FERR', debut: '2025-05-12', type: 'tendance', ampleur: 0.06,
    cause: 'Calibrant ferritine utilisé au-delà de sa durée de stabilité après ouverture.',
    action: 'Nouveau calibrant, recalibration, rappel de la règle de stabilité aux techniciens.' },
  { site: 'HYE', discipline: 'biochimie', analyte: 'CRP', debut: '2025-11-17', type: 'imprecision', ampleur: 2.6,
    cause: 'Bulles d’air dans le circuit de réactif après une maintenance.',
    action: 'Purge du circuit, contrôle de répétabilité, maintenance validée par un second technicien.' }
];

const BIAIS_STRUCTURELS = [
  { analyseur: 'DIG-BIO', analyte: 'CREA', biais: 6.2, explication: 'Étalonnage de la méthode de Jaffé non aligné sur la méthode de référence (IDMS).' },
  { analyseur: 'FRE-BIO', analyte: 'ALAT', biais: -7.6, explication: 'Réactif ALAT sans phosphate de pyridoxal : sous-estimation chez certains patients.' }
];

const DEBUT = '2025-01-06';
const FIN = '2026-11-14';

function creerHasard(graine) {
  let s = graine >>> 0;
  const unif = () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return (s + 0.5) / 4294967296;
  };
  const normal = () => Math.sqrt(-2 * Math.log(unif())) * Math.cos(2 * Math.PI * unif());
  return { unif, normal };
}

function joursOuvres(debut, fin) {
  const jours = [];
  const d = new Date(`${debut}T00:00:00Z`);
  const f = new Date(`${fin}T00:00:00Z`);
  while (d <= f) {
    if (d.getUTCDay() !== 0) jours.push(d.toISOString().slice(0, 10)); // du lundi au samedi
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return jours;
}

function finDeMois(jour) {
  const d = new Date(`${jour}T00:00:00Z`);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).toISOString().slice(0, 10);
}

function ecartJours(a, b) {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);
}

function arrondi(v, n) {
  const p = 10 ** n;
  return Math.round(v * p) / p;
}

// Règles de Westgard appliquées à un analyseur pour un analyte.
// historique = tableau des runs précédents [{ z1, z2 }] (z = écart à la cible en écarts-types).
function reglesWestgard(historique, z1, z2) {
  const rejet = [];
  const avert = Math.abs(z1) > 2 || Math.abs(z2) > 2;
  if (Math.abs(z1) > 3 || Math.abs(z2) > 3) rejet.push('1-3s');
  if ((z1 > 2 && z2 > 2) || (z1 < -2 && z2 < -2)) rejet.push('2-2s');
  const prec = historique[historique.length - 1];
  if (prec) {
    for (const [a, b] of [[prec.z1, z1], [prec.z2, z2]]) {
      if ((a > 2 && b > 2) || (a < -2 && b < -2)) { if (!rejet.includes('2-2s')) rejet.push('2-2s'); }
    }
  }
  if ((z1 > 2 && z2 < -2) || (z1 < -2 && z2 > 2)) rejet.push('R-4s');
  // 4-1s et 10x : sur les 2 niveaux mélangés (lecture « à travers les runs »)
  const serie = historique.slice(-4).flatMap((h) => [h.z1, h.z2]).concat([z1, z2]);
  const quatre = serie.slice(-4);
  if (quatre.length === 4 && (quatre.every((z) => z > 1) || quatre.every((z) => z < -1))) rejet.push('4-1s');
  const dix = historique.slice(-4).flatMap((h) => [h.z1, h.z2]).concat([z1, z2]).slice(-10);
  if (dix.length === 10 && (dix.every((z) => z > 0) || dix.every((z) => z < 0))) rejet.push('10x');
  return { rejet, avert };
}

function construireJeu() {
  const h = creerHasard(20261120);
  const jours = joursOuvres(DEBUT, FIN);
  const analyte = Object.fromEntries(ANALYTES.map((a) => [a.code, a]));

  // 1. Analyseurs
  const analyseurs = [];
  for (const site of SITES) {
    const modeles = MODELES[site.code] || MODELES.proximite;
    for (const discipline of ['biochimie', 'immunologie', 'hematologie']) {
      if (!modeles[discipline]) continue;
      let codes;
      if (discipline === 'hematologie') codes = ['HB'];
      else if (discipline === 'immunologie') codes = IMMUNO;
      else codes = site.type === 'plateau' ? BIOCHIMIE_PLATEAU : BIOCHIMIE_PROXIMITE;
      const [modele, fabricant] = modeles[discipline];
      analyseurs.push({
        code: `${site.code}-${discipline.slice(0, 3).toUpperCase()}`,
        site: site.code,
        nom: site.code === 'NIC' ? modele : `${modele} · ${site.ville}`,
        modele,
        fabricant,
        discipline,
        analytes: codes,
        // qualité propre à chaque appareil : un peu plus ou moins précis, petit biais
        facteur_cv: arrondi(0.7 + h.unif() * 0.55, 2),
        biais: Object.fromEntries(codes.map((c) => [c, arrondi((h.normal()) * 0.35 * analyte[c].cv, 2)]))
      });
      // Biais systématiques simulés : invisibles au contrôle interne (le labo se compare
      // à sa propre moyenne), ils n'apparaissent qu'en comparaison inter-laboratoires.
      const dernier = analyseurs[analyseurs.length - 1];
      for (const b of BIAIS_STRUCTURELS) {
        if (b.analyseur === dernier.code) dernier.biais[b.analyte] = b.biais;
      }
    }
  }

  // 2. Contrôles qualité quotidiens + détection des incidents
  const qc = [];
  const derives = [];
  for (const app of analyseurs) {
    for (const code of app.analytes) {
      const a = analyte[code];
      const sdRel = a.cv * app.facteur_cv / 100;
      const incident = INCIDENTS.find((i) => i.site === app.site && i.discipline === app.discipline && i.analyte === code);
      const histo = [];
      let detecte = null;
      let premiereAlerte = null;
      let corrige = null;
      let violations = [];
      for (const jour of jours) {
        // z est calculé par rapport à la moyenne propre du laboratoire (règles de Westgard)
        let decal = 0;
        let facteurBruit = 1;
        const actif = incident && jour >= incident.debut && (!corrige || jour < corrige);
        if (actif) {
          if (incident.type === 'decalage') decal += incident.ampleur;
          if (incident.type === 'tendance') decal += incident.ampleur * ecartJours(incident.debut, jour);
          if (incident.type === 'imprecision') facteurBruit = incident.ampleur;
        }
        const z1 = decal + h.normal() * facteurBruit;
        const z2 = decal + h.normal() * facteurBruit;
        const { rejet, avert } = reglesWestgard(histo, z1, z2);
        histo.push({ z1, z2 });
        if (actif && avert && !premiereAlerte) premiereAlerte = jour;
        if (actif && rejet.length && !detecte) {
          detecte = jour;
          violations = rejet;
          const idx = jours.indexOf(jour);
          corrige = jours[Math.min(idx + 1, jours.length - 1)];
        }
        for (const [niveau, z, cible] of [['N1', z1, a.cible_n1], ['N2', z2, a.cible_n2]]) {
          qc.push({
            analyseur: app.code,
            analyte: code,
            niveau,
            date: jour,
            valeur: arrondi(cible * (1 + app.biais[code] / 100 + z * sdRel), a.decimales + 2),
            cible,
            ecart_type: arrondi(cible * a.cv / 100, a.decimales + 3),
            z: arrondi(z, 2),
            regle: rejet.length ? rejet.join(' ') : (avert ? '1-2s' : null),
            rejet: rejet.length ? 1 : 0,
            pendant_incident: actif ? 1 : 0
          });
        }
      }
      if (incident) {
        derives.push({
          analyseur: app.code,
          site: app.site,
          analyte: code,
          type: incident.type,
          debut: incident.debut,
          premiere_alerte: premiereAlerte,
          detection: detecte,
          regles: violations.join(' '),
          revue_mensuelle: finDeMois(incident.debut),
          correction: corrige,
          cause: incident.cause,
          action: incident.action
        });
      }
    }
  }

  // 3. Activité mensuelle par site et par analyte (volumes calés sur la Cnam)
  const MOIS = [];
  for (const an of [2025, 2026]) {
    for (let m = 1; m <= 12; m++) {
      if (an === 2026 && m > 10) break;
      MOIS.push(`${an}-${String(m).padStart(2, '0')}`);
    }
  }
  const PROFIL = [1.08, 1.03, 1.05, 1.0, 0.97, 1.0, 0.9, 0.78, 1.02, 1.06, 1.02, 0.95];
  // 2025 : même rythme que 2026, un peu plus bas (l'activité de biologie augmente chaque année)
  const SAISON = MOIS.map((m) => PROFIL[Number(m.slice(5)) - 1] * (m.startsWith('2025') ? 0.97 : 1));
  const activite = [];
  for (const site of SITES) {
    const part = PART_DE_MARCHE[site.type];
    const analyseSur = (code) => {
      if (site.type === 'plateau') return site.code;
      return [...BIOCHIMIE_PROXIMITE, 'HB'].includes(code) ? site.code : site.plateau;
    };
    for (const a of ANALYTES) {
      const mensuelNational = a.actes_s1_2026 / 6;
      const base = mensuelNational * (site.population / POPULATION_FRANCE) * part;
      MOIS.forEach((mois, i) => {
        const nb = Math.round(base * SAISON[i] * (1 + h.normal() * 0.04));
        activite.push({ site: site.code, site_analyse: analyseSur(a.code), mois, analyte: a.code, nb_examens: nb });
      });
    }
  }

  // 4. Évaluation externe de la qualité (comparaison inter-laboratoires, mensuelle)
  const eeq = [];
  const MOIS_EEQ = MOIS;
  for (const app of analyseurs) {
    for (const code of app.analytes) {
      const a = analyte[code];
      const d = derives.find((x) => x.analyseur === app.code && x.analyte === code);
      MOIS_EEQ.forEach((mois, i) => {
        const cible = arrondi(a.cible_n1 * (1.1 + 0.15 * Math.sin(i)), a.decimales + 1);
        let biaisPct = app.biais[code];
        // une campagne tombe pendant un incident : le labo s'écarte du groupe
        if (d && d.debut.slice(0, 7) === mois) {
          const sdRel = a.cv * app.facteur_cv;
          biaisPct += d.type === 'decalage' ? (INCIDENTS.find((x) => x.site === d.site && x.analyte === code).ampleur * sdRel * 1.2) : 0;
          if (d.type === 'tendance') biaisPct += -1.6;
          if (d.type === 'imprecision') biaisPct += 2.5 * sdRel * (h.unif() > 0.5 ? 1 : -1);
        }
        // Menton : ferritine traitée à Nice → biais structurel de transport (échantillons tardifs)
        const sdGroupe = a.cv * 1.25; // dispersion inter-laboratoires (%)
        const mesure = cible * (1 + (biaisPct + h.normal() * a.cv * 0.6) / 100);
        eeq.push({
          site: app.site,
          analyseur: app.code,
          analyte: code,
          campagne: mois,
          valeur: arrondi(mesure, a.decimales + 2),
          cible,
          sd_groupe: arrondi(cible * sdGroupe / 100, a.decimales + 3),
          z: arrondi((mesure - cible) / (cible * sdGroupe / 100), 2)
        });
      });
    }
  }

  // 5. Lots de référence : chaque trimestre, chaque analyseur construit un lot
  // à partir des résultats patients pseudonymisés pour recalculer ses seuils d'alerte.
  const TRIMESTRES = [
    ['2025T1', '2025-01-01', '2025-03-31'], ['2025T2', '2025-04-01', '2025-06-30'],
    ['2025T3', '2025-07-01', '2025-09-30'], ['2025T4', '2025-10-01', '2025-12-31'],
    ['2026T1', '2026-01-01', '2026-03-31'], ['2026T2', '2026-04-01', '2026-06-30'],
    ['2026T3', '2026-07-01', '2026-09-30'], ['2026T4', '2026-10-01', '2026-11-14']
  ];
  const lots = [];
  for (const app of analyseurs) {
    const site = SITES.find((s) => s.code === app.site);
    for (const code of app.analytes) {
      const a = analyte[code];
      const vol = activite.filter((x) => x.site === app.site && x.analyte === code && x.site_analyse === app.site)
        .reduce((s, x) => s + x.nb_examens, 0) / MOIS.length;
      for (const [t, debut, fin] of TRIMESTRES) {
        const d = derives.find((x) => x.analyseur === app.code && x.analyte === code);
        const chevauche = Boolean(d && d.debut <= fin && (d.correction || FIN) >= debut);
        const jours = Math.max(1, ecartJours(chevauche ? d.debut : debut, chevauche ? (d.correction || fin) : fin));
        // seuils calculés sur la population de référence (2,5e et 97,5e percentiles)
        let decalPct = app.biais[code];
        if (chevauche) {
          const inc = INCIDENTS.find((x) => x.site === d.site && x.analyte === code);
          const partDuLot = Math.min(1, jours / Math.max(1, ecartJours(debut, fin)));
          if (inc.type === 'decalage') decalPct += inc.ampleur * a.cv * app.facteur_cv * partDuLot;
          if (inc.type === 'tendance') decalPct += -inc.ampleur * 8 * a.cv * partDuLot;
        }
        // même calcul si la dérive n'avait été vue qu'à la revue mensuelle du CQ
        let decalSans = app.biais[code];
        if (chevauche) {
          const inc = INCIDENTS.find((x) => x.site === d.site && x.analyte === code);
          const finSans = d.revue_mensuelle < fin ? d.revue_mensuelle : fin;
          const part = Math.min(1, Math.max(1, ecartJours(d.debut, finSans)) / Math.max(1, ecartJours(debut, fin)));
          if (inc.type === 'decalage') decalSans += inc.ampleur * a.cv * app.facteur_cv * part;
          if (inc.type === 'tendance') decalSans += -inc.ampleur * 8 * a.cv * part * 2;
          if (inc.type === 'imprecision') decalSans += 0;
        }
        // Limites « normal / anormal » recalculées sur le lot : les valeurs usuelles de
        // l'analyse, décalées par le biais propre de la machine (et par la panne éventuelle).
        const seuilHautSans = arrondi(a.ref_haut * (1 + decalSans / 100), a.decimales + 1);
        const k = 1 + decalPct / 100;
        const p975 = a.ref_haut * k;
        const p025 = a.ref_bas == null ? null : a.ref_bas * k;
        const enCours = t === '2026T4';
        let statut = 'valide';
        // en 2025, les lots touchés ont déjà été recalculés et revalidés par un biologiste
        if (chevauche) statut = t.startsWith('2025') ? 'revalide' : 'a_revalider';
        else if (enCours) statut = h.unif() < 0.55 ? 'a_valider' : 'valide';
        lots.push({
          nom: `REF-${app.site}-${code}-${t}`,
          analyseur: app.code,
          site: app.site,
          analyte: code,
          periode_debut: debut,
          periode_fin: fin,
          nb_resultats: Math.round(vol * (enCours ? 1.5 : 3) * 0.85),
          seuil_bas: a.ref_bas == null ? null : arrondi(p025, a.decimales + 1),
          seuil_haut: arrondi(p975, a.decimales + 1),
          statut,
          derive_liee: chevauche ? `${d.analyseur}|${code}` : null,
          seuil_haut_sans_registre: chevauche ? seuilHautSans : null,
          valide_par: statut === 'valide' || statut === 'revalide' ? site.responsable : null,
          resultats_exposes: chevauche ? Math.round((vol / 26) * Math.max(1, ecartJours(d.debut, d.correction || fin)) * 6 / 7) : 0
        });
      }
    }
  }

  // 6. Échantillon de résultats patients pseudonymisés (2026) : 1 résultat sur 100.
  // Sert à vérifier les seuils d'alerte et la k-anonymisation (aucun vrai patient).
  const resultats = construireResultats(h, activite, analyte);

  return { analyseurs, qc, derives, activite, eeq, lots, resultats };
}

const CLASSES_AGE = [['0-17', 0.12], ['18-39', 0.22], ['40-59', 0.27], ['60-74', 0.23], ['75+', 0.16]];

// Valeurs usuelles selon le sexe quand elles diffèrent (hémoglobine, créatinine, ferritine).
function seuilsPour(a, sexe) {
  if (a.code === 'HB') return sexe === 'F' ? [12.0, 16.0] : [13.0, 17.0];
  if (a.code === 'CREA') return sexe === 'F' ? [45, 90] : [60, 110];
  if (a.code === 'FERR') return sexe === 'F' ? [15, 150] : [30, 300];
  return [a.ref_bas, a.ref_haut];
}

function tirerValeur(h, a, sexe, iAge) {
  const age = iAge; // 0 à 4
  const malade = h.unif() < 0.14; // la population qui fait une prise de sang n'est pas « en bonne santé »
  const n = h.normal();
  switch (a.code) {
    case 'HB': return (sexe === 'F' ? 13.4 : 14.8) - (age >= 4 ? 0.6 : 0) + n * 1.1 - (malade ? 2.6 * h.unif() + 0.8 : 0);
    case 'CREA': return ((sexe === 'F' ? 66 : 84) + age * 4) * Math.exp(n * 0.16) * (malade ? 1.4 + h.unif() * 1.5 : 1);
    case 'K': return 4.25 + n * 0.36 + (malade ? (h.unif() < 0.5 ? -0.9 : 1.1) * h.unif() + (h.unif() < 0.5 ? -0.3 : 0.3) : 0);
    case 'ALAT': return (sexe === 'F' ? 18 : 25) * Math.exp(n * 0.4) * (malade ? 2 + h.unif() * 3 : 1);
    case 'CRP': return 1.4 * Math.exp(n * 0.9) * (malade ? 6 + h.unif() * 30 : 1);
    case 'CHOL': return 1.65 + age * 0.08 + n * 0.32 + (malade ? 0.5 * h.unif() : 0);
    case 'TSH': return 1.6 * Math.exp(n * 0.45) * (malade ? (h.unif() < 0.5 ? 0.12 : 3.5) : 1);
    case 'FERR': return (sexe === 'F' ? 60 : 140) * Math.exp(n * 0.6) * (malade ? (h.unif() < 0.5 ? 0.25 : 3) : 1);
    case 'HBA1C': return 5.3 + age * 0.12 + n * 0.3 + (malade ? 1 + h.unif() * 3 : 0);
    case 'PSA': return (0.6 + age * 0.45) * Math.exp(n * 0.6) * (malade ? 3 + h.unif() * 4 : 1);
    default: return null;
  }
}

function construireResultats(h, activite, analyte) {
  const lignes = [];
  let numero = 0;
  for (const act of activite) {
    if (!act.mois.startsWith('2026')) continue;
    const a = analyte[act.analyte];
    if (!a || a.qc === false) continue;
    const n = Math.round(act.nb_examens / 100);
    const [an, mm] = act.mois.split('-').map(Number);
    const joursDuMois = new Date(Date.UTC(an, mm, 0)).getUTCDate();
    for (let i = 0; i < n; i++) {
      let sexe = h.unif() < 0.56 ? 'F' : 'M'; // les femmes font davantage d'analyses
      if (a.code === 'PSA') sexe = 'M';
      let r = h.unif();
      let iAge = 0;
      for (; iAge < CLASSES_AGE.length - 1; iAge++) { r -= CLASSES_AGE[iAge][1]; if (r < 0) break; }
      if (a.code === 'PSA' && iAge < 2) iAge = 2;
      const v = Math.max(0.01, tirerValeur(h, a, sexe, iAge));
      const [bas, haut] = seuilsPour(a, sexe);
      const interpretation = bas != null && v < bas ? 'bas' : v > haut ? 'haut' : 'normal';
      numero++;
      const jour = String(1 + Math.floor(h.unif() * joursDuMois)).padStart(2, '0');
      lignes.push({
        pseudo: `PSN-${(Math.imul(numero, 2654435761) >>> 0).toString(16).toUpperCase().padStart(8, '0')}`,
        site: act.site,
        date: `${act.mois}-${jour}`,
        analyte: a.code,
        sexe,
        classe_age: CLASSES_AGE[iAge][0],
        valeur: arrondi(v, a.decimales),
        interpretation
      });
    }
  }
  return lignes;
}

async function creerTables(run) {
  await run(`CREATE TABLE IF NOT EXISTS reseau_meta (cle TEXT PRIMARY KEY, valeur TEXT)`);
  await run(`CREATE TABLE IF NOT EXISTS reseau_sites (
    code TEXT PRIMARY KEY, nom TEXT, ville TEXT, code_insee TEXT, departement TEXT,
    population INTEGER, lat REAL, lon REAL, type TEXT, plateau TEXT,
    accredite_depuis TEXT, responsable TEXT)`);
  await run(`CREATE TABLE IF NOT EXISTS reseau_analytes (
    code TEXT PRIMARY KEY, libelle TEXT, unite TEXT, code_nabm TEXT, libelle_nabm TEXT,
    actes_s1_2026 INTEGER, montant_s1_2026 INTEGER, cible_n1 REAL, cible_n2 REAL, cv_cible REAL, eta REAL,
    discipline TEXT, ref_bas REAL, ref_haut REAL, controle_qualite INTEGER)`);
  await run(`CREATE TABLE IF NOT EXISTS reseau_resultats (
    id INTEGER PRIMARY KEY AUTOINCREMENT, pseudo TEXT, site TEXT, date TEXT, analyte TEXT,
    sexe TEXT, classe_age TEXT, valeur REAL, interpretation TEXT)`);
  await run('CREATE INDEX IF NOT EXISTS idx_reseau_resultats ON reseau_resultats(analyte, site)');
  await run(`CREATE TABLE IF NOT EXISTS reseau_analyseurs (
    code TEXT PRIMARY KEY, site TEXT, nom TEXT, modele TEXT, fabricant TEXT, discipline TEXT,
    analytes TEXT, machine_id INTEGER)`);
  await run(`CREATE TABLE IF NOT EXISTS reseau_qc (
    id INTEGER PRIMARY KEY AUTOINCREMENT, analyseur TEXT, analyte TEXT, niveau TEXT, date TEXT,
    valeur REAL, cible REAL, ecart_type REAL, z REAL, regle TEXT, rejet INTEGER, pendant_incident INTEGER)`);
  await run('CREATE INDEX IF NOT EXISTS idx_reseau_qc ON reseau_qc(analyseur, analyte, date)');
  await run(`CREATE TABLE IF NOT EXISTS reseau_derives (
    id INTEGER PRIMARY KEY AUTOINCREMENT, analyseur TEXT, site TEXT, analyte TEXT, type TEXT,
    debut TEXT, premiere_alerte TEXT, detection TEXT, regles TEXT, revue_mensuelle TEXT,
    correction TEXT, cause TEXT, action TEXT)`);
  await run(`CREATE TABLE IF NOT EXISTS reseau_activite (
    site TEXT, site_analyse TEXT, mois TEXT, analyte TEXT, nb_examens INTEGER)`);
  await run(`CREATE TABLE IF NOT EXISTS reseau_eeq (
    id INTEGER PRIMARY KEY AUTOINCREMENT, site TEXT, analyseur TEXT, analyte TEXT, campagne TEXT,
    valeur REAL, cible REAL, sd_groupe REAL, z REAL)`);
  await run(`CREATE TABLE IF NOT EXISTS reseau_lots (
    id INTEGER PRIMARY KEY AUTOINCREMENT, nom TEXT UNIQUE, analyseur TEXT, site TEXT, analyte TEXT,
    periode_debut TEXT, periode_fin TEXT, nb_resultats INTEGER, seuil_bas REAL, seuil_haut REAL,
    statut TEXT, derive_liee TEXT, valide_par TEXT, resultats_exposes INTEGER, seuil_haut_sans_registre REAL)`);
}

const TABLES = ['reseau_resultats', 'reseau_sites', 'reseau_analytes', 'reseau_analyseurs', 'reseau_qc', 'reseau_derives', 'reseau_activite', 'reseau_eeq', 'reseau_lots'];

async function remplir({ run, get }, { forcer = false } = {}) {
  await run(`CREATE TABLE IF NOT EXISTS reseau_meta (cle TEXT PRIMARY KEY, valeur TEXT)`);
  const meta = await get("SELECT valeur FROM reseau_meta WHERE cle = 'version'");
  if (!forcer && meta && meta.valeur === VERSION_JEU) return false;
  // Nouvelle version du jeu : on supprime les anciennes tables (leur structure a pu changer).
  for (const t of TABLES) await run(`DROP TABLE IF EXISTS ${t}`);
  await creerTables(run);

  const t0 = Date.now();
  const jeu = construireJeu();
  await run('BEGIN');
  try {
    for (const s of SITES) {
      await run(`INSERT INTO reseau_sites VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
        [s.code, s.nom, s.ville, s.insee, s.dep, s.population, s.lat, s.lon, s.type, s.plateau || null, s.accredite, s.responsable]);
    }
    for (const a of ANALYTES) {
      await run(`INSERT INTO reseau_analytes (code, libelle, unite, code_nabm, libelle_nabm, actes_s1_2026, montant_s1_2026,
        cible_n1, cible_n2, cv_cible, eta, discipline, ref_bas, ref_haut, controle_qualite) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [a.code, a.libelle, a.unite ?? null, a.nabm, a.libelle_nabm, a.actes_s1_2026, a.montant_s1_2026, a.cible_n1 ?? null, a.cible_n2 ?? null,
          a.cv ?? null, a.eta ?? null, a.discipline, a.ref_bas ?? null, a.ref_haut ?? null, a.qc === false ? 0 : 1]);
    }
    for (const r of jeu.resultats) {
      await run(`INSERT INTO reseau_resultats (pseudo, site, date, analyte, sexe, classe_age, valeur, interpretation) VALUES (?,?,?,?,?,?,?,?)`,
        [r.pseudo, r.site, r.date, r.analyte, r.sexe, r.classe_age, r.valeur, r.interpretation]);
    }
    for (const app of jeu.analyseurs) {
      let machineId = null;
      if (app.site === 'NIC') {
        const m = await get('SELECT id FROM machines WHERE nom = ?', [app.modele]);
        machineId = m ? m.id : null;
      }
      await run(`INSERT INTO reseau_analyseurs VALUES (?,?,?,?,?,?,?,?)`,
        [app.code, app.site, app.nom, app.modele, app.fabricant, app.discipline, app.analytes.join(','), machineId]);
    }
    for (const q of jeu.qc) {
      await run(`INSERT INTO reseau_qc (analyseur, analyte, niveau, date, valeur, cible, ecart_type, z, regle, rejet, pendant_incident)
        VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
        [q.analyseur, q.analyte, q.niveau, q.date, q.valeur, q.cible, q.ecart_type, q.z, q.regle, q.rejet, q.pendant_incident]);
    }
    for (const d of jeu.derives) {
      await run(`INSERT INTO reseau_derives (analyseur, site, analyte, type, debut, premiere_alerte, detection, regles, revue_mensuelle, correction, cause, action)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
        [d.analyseur, d.site, d.analyte, d.type, d.debut, d.premiere_alerte, d.detection, d.regles, d.revue_mensuelle, d.correction, d.cause, d.action]);
    }
    for (const x of jeu.activite) {
      await run('INSERT INTO reseau_activite VALUES (?,?,?,?,?)', [x.site, x.site_analyse, x.mois, x.analyte, x.nb_examens]);
    }
    for (const e of jeu.eeq) {
      await run(`INSERT INTO reseau_eeq (site, analyseur, analyte, campagne, valeur, cible, sd_groupe, z) VALUES (?,?,?,?,?,?,?,?)`,
        [e.site, e.analyseur, e.analyte, e.campagne, e.valeur, e.cible, e.sd_groupe, e.z]);
    }
    for (const l of jeu.lots) {
      await run(`INSERT INTO reseau_lots (nom, analyseur, site, analyte, periode_debut, periode_fin, nb_resultats, seuil_bas, seuil_haut, statut, derive_liee, valide_par, resultats_exposes, seuil_haut_sans_registre)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [l.nom, l.analyseur, l.site, l.analyte, l.periode_debut, l.periode_fin, l.nb_resultats, l.seuil_bas, l.seuil_haut, l.statut, l.derive_liee, l.valide_par, l.resultats_exposes, l.seuil_haut_sans_registre]);
    }
    await run(`INSERT OR REPLACE INTO reseau_meta (cle, valeur) VALUES ('version', ?)`, [VERSION_JEU]);
    await run(`INSERT OR REPLACE INTO reseau_meta (cle, valeur) VALUES ('genere_le', datetime('now'))`);
    await run('COMMIT');
  } catch (err) {
    await run('ROLLBACK');
    throw err;
  }
  console.log(`Réseau biologIA Sud : ${SITES.length} sites, ${jeu.analyseurs.length} analyseurs, ${jeu.qc.length} contrôles qualité, ${jeu.lots.length} lots de référence, ${jeu.resultats.length} résultats pseudonymisés (${Date.now() - t0} ms).`);
  return true;
}

module.exports = { remplir, construireJeu, reglesWestgard, SITES, ANALYTES, INCIDENTS, BIAIS_STRUCTURELS, VERSION_JEU };
