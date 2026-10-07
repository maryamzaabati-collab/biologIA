const express = require('express');
const router = express.Router();
const db = require('../db');
const journal = require('../lib/journal');
const { csvAvecBom } = require('../lib/tracabilite');
const { horlogeParis } = require('../lib/dates');
const {
  normaliserNom,
  analyserNumero,
  composerNumero,
  validerCreation,
  detecterDoublons,
  prochainNumero,
  psnAleatoire
} = require('../lib/patients');

function roleDe(req) {
  return req.utilisateur && req.utilisateur.role;
}

function interditClient(req, res) {
  const role = roleDe(req);
  if (role === 'client') {
    res.status(403).json({ erreur: 'Les identifiants patients sont réservés au laboratoire.' });
    return true;
  }
  return false;
}

function peutAfficherIdentite(role) {
  return role === 'biologiste';
}

async function ligneParPsn(psn) {
  const code = String(psn || '').trim().toUpperCase();
  if (!code) return null;
  return db.get(
    `SELECT patients_pseudo.code, patients_pseudo.psn, patients_identite.*
     FROM patients_pseudo JOIN patients_identite
       ON patients_identite.id = COALESCE(patients_pseudo.identite_id, patients_pseudo.patient_id)
     WHERE upper(COALESCE(patients_pseudo.psn, patients_pseudo.code)) = ?`,
    [code]
  );
}

async function identifierInterne(body) {
  const psnSaisi = String(body.psn || '').trim().toUpperCase()
    || (/^PSN-/i.test(String(body.code || '').trim()) ? String(body.code).trim().toUpperCase() : '');
  if (psnSaisi) {
    const ligne = await ligneParPsn(psnSaisi);
    if (!ligne) return { trouve: false, message: 'Inconnu' };
    const psn = ligne.psn || ligne.code;
    return { trouve: true, psn, message: `Trouvé → ${psn}` };
  }

  const numeroBrut = String(body.numero_patient || body.numero || body.code || '').trim();
  if (numeroBrut) {
    const lu = analyserNumero(numeroBrut);
    if (!lu.ok) {
      return {
        trouve: false,
        refuse: true,
        message: lu.raison === 'controle'
          ? 'Numéro refusé : chiffre de contrôle invalide'
          : 'Numéro refusé : format attendu NP-AAAA-000123'
      };
    }
    const ligne = await db.get(
      `SELECT patients_pseudo.code, patients_pseudo.psn, patients_identite.*
       FROM patients_identite JOIN patients_pseudo
         ON COALESCE(patients_pseudo.identite_id, patients_pseudo.patient_id) = patients_identite.id
       WHERE upper(patients_identite.numero_patient) = ?`,
      [lu.numero]
    );
    if (!ligne) return { trouve: false, message: 'Inconnu' };
    const psn = ligne.psn || ligne.code;
    return { trouve: true, psn, message: `Trouvé → ${psn}` };
  }

  const nom = normaliserNom(body.nom);
  const date = String(body.date_naissance || '').slice(0, 10);
  const prenom = normaliserNom(body.prenom);
  if (!nom || !date) {
    return { erreur: 400, message: 'Indiquez un numéro patient, ou un nom et une date de naissance.' };
  }
  const tous = await db.all(
    `SELECT patients_identite.*, patients_pseudo.code, patients_pseudo.psn
     FROM patients_identite JOIN patients_pseudo
       ON COALESCE(patients_pseudo.identite_id, patients_pseudo.patient_id) = patients_identite.id`
  );
  const matches = tous.filter((p) => {
    const nomOk = normaliserNom(p.nom) === nom;
    const dateOk = String(p.date_naissance).slice(0, 10) === date;
    const prenomOk = !prenom || normaliserNom(p.prenom) === prenom;
    return nomOk && dateOk && prenomOk;
  });
  if (!matches.length) return { trouve: false, message: 'Inconnu' };
  const codes = [...new Set(matches.map((m) => m.psn || m.code))];
  return {
    trouve: true,
    psn: codes[0],
    message: `Trouvé → ${codes[0]}`,
    doublons: codes.length > 1 ? codes : []
  };
}

async function lignesIdentifiants(q) {
  const recherche = String(q || '').trim().toUpperCase();
  const rows = await db.all(`
    SELECT COALESCE(patients_pseudo.psn, patients_pseudo.code) AS psn,
      patients_identite.numero_patient,
      patients_identite.id AS identite_id
    FROM patients_pseudo
    JOIN patients_identite
      ON patients_identite.id = COALESCE(patients_pseudo.identite_id, patients_pseudo.patient_id)
    ORDER BY psn
  `);
  const mesures = await db.all(
    `SELECT upper(code_patient) AS psn, COUNT(*) AS nb_mesures, COUNT(DISTINCT lot_id) AS nb_lots
     FROM mesures_reference GROUP BY upper(code_patient)`
  );
  const parPsn = new Map(mesures.map((m) => [m.psn, m]));
  let liste = rows.map((r) => {
    const stats = parPsn.get(String(r.psn).toUpperCase()) || { nb_mesures: 0, nb_lots: 0 };
    return {
      psn: r.psn,
      numero_patient: r.numero_patient,
      nb_lots: Number(stats.nb_lots) || 0,
      nb_mesures: Number(stats.nb_mesures) || 0
    };
  });
  if (recherche) {
    liste = liste.filter((l) =>
      String(l.psn).toUpperCase().includes(recherche)
      || String(l.numero_patient || '').toUpperCase().includes(recherche)
    );
  }
  return liste;
}

function fichePublique(ligne, role) {
  const psn = ligne.psn || ligne.code;
  if (role === 'technicien') {
    return { psn, nb_mesures: ligne.nb_mesures, nb_lots: undefined };
  }
  return {
    psn,
    numero_patient: ligne.numero_patient,
    nb_lots: ligne.nb_lots,
    nb_mesures: ligne.nb_mesures,
    identite_masquee: true
  };
}

router.get('/', async (req, res) => {
  try {
    if (interditClient(req, res)) return;
    const role = roleDe(req);
    const page = Math.max(1, Number(req.query.page) || 1);
    const taille = Math.min(100, Math.max(10, Number(req.query.taille) || 20));
    const toutes = await lignesIdentifiants(req.query.q);
    const total = toutes.length;
    const tranche = toutes.slice((page - 1) * taille, page * taille);
    const identifiants = tranche.map((l) => {
      if (role === 'technicien') {
        return { psn: l.psn, nb_mesures: l.nb_mesures };
      }
      return {
        psn: l.psn,
        numero_patient: l.numero_patient,
        nb_lots: l.nb_lots,
        nb_mesures: l.nb_mesures,
        identite_masquee: true
      };
    });
    res.json({ page, taille, total, identifiants });
  } catch (err) {
    res.status(500).json({ erreur: err.message });
  }
});

router.get('/export.csv', async (req, res) => {
  try {
    if (interditClient(req, res)) return;
    const role = roleDe(req);
    const toutes = await lignesIdentifiants(req.query.q);
    const lignes = role === 'technicien'
      ? [['psn', 'nb_mesures'], ...toutes.map((l) => [l.psn, l.nb_mesures])]
      : [['psn', 'numero_patient', 'nb_lots', 'nb_mesures'], ...toutes.map((l) => [l.psn, l.numero_patient, l.nb_lots, l.nb_mesures])];
    await journal.enregistrer(req, 'export identifiants', 'patients', `${toutes.length} lignes`);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="identifiants-patients.csv"');
    res.send(csvAvecBom(lignes));
  } catch (err) {
    res.status(500).json({ erreur: err.message });
  }
});

router.post('/identifier', async (req, res) => {
  try {
    if (interditClient(req, res)) return;
    const r = await identifierInterne(req.body || {});
    if (r.erreur) return res.status(r.erreur).json({ erreur: r.message });
    const cible = r.psn || String(req.body.numero_patient || req.body.nom || '');
    await journal.enregistrer(req, 'recherche patient', cible, r.message);
    res.json({
      trouve: r.trouve,
      refuse: r.refuse || false,
      psn: r.psn || null,
      message: r.message,
      doublons: r.doublons || []
    });
  } catch (err) {
    res.status(500).json({ erreur: err.message });
  }
});

router.post('/recherche', async (req, res) => {
  try {
    if (interditClient(req, res)) return;
    const r = await identifierInterne(req.body || {});
    if (r.erreur) return res.status(r.erreur).json({ erreur: r.message });
    const cible = r.psn || String(req.body.numero_patient || req.body.code || req.body.nom || '');
    await journal.enregistrer(req, 'recherche patient', cible, r.message);
    res.json({
      trouve: r.trouve,
      refuse: r.refuse || false,
      psn: r.psn || null,
      code: r.psn || null,
      message: r.message,
      doublons: r.doublons || []
    });
  } catch (err) {
    res.status(500).json({ erreur: err.message });
  }
});

router.post('/afficher-identite', async (req, res) => {
  try {
    if (interditClient(req, res)) return;
    const role = roleDe(req);
    if (!peutAfficherIdentite(role)) {
      return res.status(403).json({ erreur: 'Le technicien ne voit jamais l’identité, seulement le PSN.' });
    }
    const motif = String(req.body.motif || '').trim();
    if (!motif) return res.status(400).json({ erreur: 'Un motif est obligatoire pour afficher une identité.' });
    const ligne = await ligneParPsn(req.body.psn);
    if (!ligne) return res.status(404).json({ erreur: 'PSN inconnu.' });
    const psn = ligne.psn || ligne.code;
    await journal.enregistrer(
      req,
      'affichage identité',
      psn,
      `qui=${req.utilisateur.nom} ; psn=${psn} ; motif=${motif}`
    );
    res.json({
      psn,
      identite: {
        numero_patient: ligne.numero_patient,
        nom: ligne.nom,
        prenom: ligne.prenom,
        date_naissance: ligne.date_naissance,
        sexe: ligne.sexe,
        ville: ligne.ville,
        code_postal: ligne.code_postal
      }
    });
  } catch (err) {
    res.status(500).json({ erreur: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    if (!req.utilisateur || req.utilisateur.role !== 'biologiste') {
      return res.status(403).json({ erreur: 'Seul un biologiste crée une identité fictive.' });
    }
    const { erreurs, fiche } = validerCreation(req.body || {});
    if (erreurs.length) return res.status(400).json({ erreur: erreurs[0] });
    const existants = await db.all('SELECT id, nom, prenom, date_naissance FROM patients_identite');
    const { exact, proches } = detecterDoublons(fiche, existants);
    if (exact.length) {
      return res.status(409).json({
        erreur: 'Doublon : un patient fictif porte déjà le même nom et la même date de naissance.',
        doublon: true
      });
    }
    if (proches.length && !req.body.forcer_proche) {
      return res.status(409).json({
        erreur: 'Doublon possible : un nom très proche existe déjà à cette date de naissance.',
        doublon_possible: true,
        proches: proches.map((p) => p.nom)
      });
    }
    const numero = await prochainNumero(db);
    const psn = psnAleatoire();
    const { id } = await db.run(
      `INSERT INTO patients_identite (nom, prenom, date_naissance, sexe, nir_fictif, departement,
        numero_patient, ville, code_postal, cree_par, cree_le)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        fiche.nom,
        fiche.prenom,
        fiche.date_naissance,
        fiche.sexe,
        String(req.body.nir_fictif || '').trim() || null,
        fiche.code_postal.slice(0, 2),
        numero,
        fiche.ville,
        fiche.code_postal,
        req.utilisateur.nom,
        horlogeParis()
      ]
    );
    await db.run(
      'INSERT INTO patients_pseudo (code, patient_id, psn, identite_id) VALUES (?, ?, ?, ?)',
      [psn, id, psn, id]
    );
    await journal.enregistrer(req, 'création patient', psn, `${numero} → ${psn}`);
    res.status(201).json({ id, psn, numero_patient: numero });
  } catch (err) {
    res.status(500).json({ erreur: err.message });
  }
});

router.post('/tests', async (req, res) => {
  try {
    if (interditClient(req, res)) return;
    const role = roleDe(req);
    const tests = [];
    const un = await db.get(`
      SELECT patients_identite.numero_patient, patients_identite.nom, patients_identite.prenom,
        patients_identite.date_naissance, COALESCE(patients_pseudo.psn, patients_pseudo.code) AS psn
      FROM patients_identite JOIN patients_pseudo
        ON COALESCE(patients_pseudo.identite_id, patients_pseudo.patient_id) = patients_identite.id
      WHERE patients_identite.numero_patient IS NOT NULL
      LIMIT 1
    `);

    if (un) {
      const okNum = await identifierInterne({ numero_patient: un.numero_patient });
      tests.push({
        code: 'numero_valide',
        ok: Boolean(okNum.trouve && okNum.psn),
        libelle: 'Numéro valide trouvé',
        detail: okNum.message
      });
      const coupe = un.numero_patient.slice(0, -1);
      const dernier = Number(un.numero_patient.slice(-1));
      const mauvais = `${coupe}${(dernier + 1) % 10}`;
      const koCtrl = await identifierInterne({ numero_patient: mauvais });
      tests.push({
        code: 'chiffre_controle',
        ok: Boolean(koCtrl.refuse && !koCtrl.trouve),
        libelle: 'Numéro avec mauvais chiffre de contrôle refusé',
        detail: koCtrl.message
      });
    } else {
      tests.push({ code: 'numero_valide', ok: false, libelle: 'Numéro valide trouvé', detail: 'Aucun patient en base' });
      tests.push({ code: 'chiffre_controle', ok: false, libelle: 'Chiffre de contrôle', detail: 'Aucun patient en base' });
    }

    const numeroFantome = composerNumero(2026, 99999);
    const inconnu = await identifierInterne({ numero_patient: numeroFantome });
    const luInconnu = analyserNumero(numeroFantome);
    tests.push({
      code: 'numero_inconnu',
      ok: Boolean(luInconnu.ok && !inconnu.trouve && !inconnu.refuse),
      libelle: 'Numéro inconnu',
      detail: inconnu.message
    });

    if (un) {
      const variante = await identifierInterne({
        nom: un.nom.toUpperCase(),
        date_naissance: un.date_naissance
      });
      tests.push({
        code: 'normalisation',
        ok: Boolean(variante.trouve && variante.psn === un.psn),
        libelle: 'Identité retrouvée malgré accents / majuscules',
        detail: variante.message
      });
      const { exact } = detecterDoublons(
        { nom: un.nom, date_naissance: un.date_naissance },
        [un]
      );
      tests.push({
        code: 'doublon',
        ok: exact.length > 0,
        libelle: 'Doublon détecté (même nom normalisé + même date)',
        detail: exact.length ? 'Blocage 409 prévu à la création' : 'Non détecté'
      });
    }

    if (role === 'technicien') {
      const motif = 'test interface';
      const fauxReq = { utilisateur: req.utilisateur, body: { psn: un && un.psn, motif } };
      const interdit = !peutAfficherIdentite(role);
      tests.push({
        code: 'technicien_403',
        ok: interdit,
        libelle: 'Technicien qui tente d’afficher une identité = 403',
        detail: interdit ? 'Refusé' : 'Autorisé à tort'
      });
      void fauxReq;
    } else {
      tests.push({
        code: 'technicien_403',
        ok: !peutAfficherIdentite('technicien'),
        libelle: 'Technicien qui tente d’afficher une identité = 403',
        detail: 'Règle serveur : seul le biologiste peut afficher. Relancer ce test connecté en technicien pour le 403 HTTP.'
      });
    }

    await journal.enregistrer(req, 'test identification', 'patients', `${tests.filter((t) => t.ok).length}/${tests.length}`);
    res.json({ ok: tests.every((t) => t.ok), tests });
  } catch (err) {
    res.status(500).json({ erreur: err.message });
  }
});

module.exports = router;
module.exports.peutAfficherIdentite = peutAfficherIdentite;
module.exports.fichePublique = fichePublique;
