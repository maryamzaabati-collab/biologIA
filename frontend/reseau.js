/* reseau.js — page « Observatoire du réseau » */
(function () {
  const { nombre, compact, esc, moisCourt } = G;
  const etat = { resume: null, sites: [], perf: [], derives: [], analytes: {}, rep: null, lotsPage: 1, charge: {} };
  const LIB_ETAT = { ok: 'Bon', surveiller: 'À surveiller', alerte: 'Problème' };
  const COUL_ETAT = { ok: 'var(--ok)', surveiller: 'var(--wait)', alerte: 'var(--flag)' };
  const LIB_STATUT = { valide: 'Validé', a_valider: 'À valider', a_revalider: 'À revalider', revalide: 'Revalidé' };
  const BADGE_STATUT = { valide: 'ok', a_valider: 'a-valider', a_revalider: 'a-revalider', revalide: 'ok' };
  const LIB_TYPE = { decalage: 'Erreur soudaine', tendance: 'Erreur qui grandit petit à petit', imprecision: 'Mesures qui partent dans tous les sens' };
  const DECAL_NOM = { ANT: [14, 24, 'start'], CAN: [-10, 30, 'end'], GRA: [-14, 6, 'end'], FRE: [0, 40], MRS: [8, 0, 'start'], NIC: [-6, 0], MAR: [-14, 26, 'end'], SAL: [0, 0], ARL: [-12, 12, 'end'], AIX: [16, 6, 'start'], HYE: [14, 24, 'start'], CAR: [14, 10, 'start'], DRA: [0, 0] };
  const DEP = { '04': 'Alpes-de-Haute-Provence', '05': 'Hautes-Alpes', '06': 'Alpes-Maritimes', '13': 'Bouches-du-Rhône', '83': 'Var', '84': 'Vaucluse' };

  function fonce(sigma) { return sigma >= 6 || sigma < 3 ? ' fonce' : ''; }
  function dec(v) { return v >= 20 ? 0 : v >= 2 ? 1 : 2; }
  function fdate(d) { return d ? formatDate(d) : '—'; }
  function ville(code) { const s = etat.sites.find((x) => x.code === code); return s ? s.ville : code; }
  function badgeEtat(e) { return `<span class="badge ${e === 'ok' ? 'ok' : e === 'alerte' ? 'douteux' : 'a-valider'}">${LIB_ETAT[e]}</span>`; }

  // ---------- Onglets ----------
  function ouvrir(nom) {
    document.querySelectorAll('#onglets [data-onglet]').forEach((b) => b.classList.toggle('actif', b.dataset.onglet === nom));
    document.querySelectorAll('[data-panneau]').forEach((p) => { p.hidden = p.dataset.panneau !== nom; });
    if (location.hash.slice(1) !== nom) history.replaceState(null, '', '#' + nom);
    const f = { carte: dessinerCarte, activite: dessinerActivite, machines: dessinerQualite, alertes: dessinerAlertes, donnees: dessinerDonnees }[nom];
    if (f && !etat.charge[nom]) { etat.charge[nom] = true; f().catch(erreur); }
  }
  function erreur(err) { afficherMessage('erreur-page', err.message || String(err)); }

  // ---------- 1. Vue d'ensemble ----------
  function dessinerEnsemble() {
    const r = etat.resume;
    document.getElementById('intro').innerHTML = `${r.sites} laboratoires, ${r.analyseurs} machines, ${compact(r.examens_total)} analyses
      de janvier 2025 à octobre 2026. <span class="pastille-donnees">Chiffres calés sur des données officielles · voir « Données »</span>`;
    const baisse = r.resultats_exposes_sans ? Math.round(100 * (1 - r.resultats_exposes_avec / r.resultats_exposes_sans)) : 0;
    document.getElementById('kpis').innerHTML = `
      <a class="stat" href="#carte"><div class="label"><span class="stat-dot" style="background:var(--accent)"></span>Laboratoires</div><div class="valeur">${r.sites}</div><div class="sous">dans 6 départements · ${compact(r.population_communes)} habitants</div></a>
      <a class="stat" href="#activite"><div class="label"><span class="stat-dot" style="background:var(--reval)"></span>Analyses</div><div class="valeur">${compact(r.examens_total)}</div><div class="sous">${r.analyses} types d’analyses · ${compact(r.depense_remboursee_estimee)} € remboursés</div></a>
      <a class="stat" href="#machines"><div class="label"><span class="stat-dot" style="background:var(--ok)"></span>Machines surveillées</div><div class="valeur">${r.analyseurs}</div><div class="sous">${compact(r.controles_qc)} contrôles vérifiés</div></a>
      <a class="stat stat-alert" href="#alertes"><div class="label"><span class="stat-dot" style="background:var(--flag)"></span>Pannes détectées</div><div class="valeur">${r.derives}</div><div class="sous">repérées en ${nombre(r.delai_moyen_detection, 1)} jours en moyenne</div></a>`;
    const max = r.resultats_exposes_sans || 1;
    document.getElementById('impact').innerHTML = `
      <p class="hint">Pendant les ${r.derives} pannes de mesure, combien de résultats de patients sont partis faux ?</p>
      <div class="impact-barre"><span>Sans biologIA (on vérifie une fois par mois)</span><b>${nombre(r.resultats_exposes_sans)}</b>
        <span class="piste"><i style="width:100%;background:var(--flag)"></i></span></div>
      <div class="impact-barre"><span>Avec biologIA (on vérifie chaque jour)</span><b>${nombre(r.resultats_exposes_avec)}</b>
        <span class="piste"><i style="width:${(100 * r.resultats_exposes_avec / max).toFixed(1)}%;background:var(--ok)"></i></span></div>
      <p class="impact-phrase gros"><b>${baisse} % de résultats faux en moins.</b></p>
      <a class="btn-link" href="#alertes">Voir les pannes</a>`;
    const tri = [...etat.sites].sort((a, b) => b.indice_qualite - a.indice_qualite);
    document.getElementById('classement').innerHTML = `<div class="table-defile"><table class="table-audit table-classement"><thead><tr>
      <th>#</th><th>Laboratoire</th><th class="num">Analyses</th><th>Note /100</th><th>État</th><th>Pourquoi ?</th></tr></thead><tbody>
      ${tri.map((s, i) => `<tr>
        <td>${i + 1}</td><td><a href="#carte" data-voir-site="${s.code}">${esc(s.ville)}</a><div class="meta">${s.type === 'plateau' ? 'gros laboratoire (plateau technique)' : 'laboratoire de proximité'}</div></td>
        <td class="num">${compact(s.examens_total)}</td>
        <td><span class="score-mini"><i style="width:${s.indice_qualite}%;background:${COUL_ETAT[s.etat]}"></i></span> <b>${s.indice_qualite}</b></td>
        <td>${badgeEtat(s.etat)}</td><td class="meta">${raison(s)}</td></tr>`).join('')}</tbody></table></div>`;
  }

  function raison(s) {
    const r = [];
    if (s.sigma_min < 3) r.push('une machine peu fiable');
    if (s.lots_a_revalider) r.push(`${s.lots_a_revalider} lot à revalider`);
    if (s.eeq_z_moyen > 0.7) r.push('écart avec les autres labos');
    if (s.sigma_min >= 3 && s.sigma_moyen < 5.3) r.push('machines moyennement fiables');
    if (s.lots_a_valider) r.push(`${s.lots_a_valider} lot${s.lots_a_valider > 1 ? 's' : ''} en attente de validation`);
    if (s.derives) r.push(`${s.derives} panne${s.derives > 1 ? 's' : ''} réparée${s.derives > 1 ? 's' : ''}`);
    return r.length ? r.join(' · ') : 'rien à signaler';
  }

  // ---------- 2. Carte ----------
  async function dessinerCarte() {
    const geo = await fetch('donnees/carte-sud.json').then((r) => r.json());
    const P = geo.projection;
    const xy = (lon, lat) => [((lon * P.k) - P.minx) * P.s + P.marge, ((-lat) - P.miny) * P.s + P.marge];
    const maxEx = Math.max(...etat.sites.map((s) => s.examens_total));
    const rayon = (s) => 7 + 22 * Math.sqrt(s.examens_total / maxEx);
    const deps = geo.departements.map((d) => `<path d="${d.d}" class="dep"><title>${esc(d.nom)} (${d.code})</title></path>`).join('');
    const pos = Object.fromEntries(etat.sites.map((s) => [s.code, xy(s.lon, s.lat)]));
    const liens = etat.sites.filter((s) => s.plateau).map((s) => {
      const [x1, y1] = pos[s.code]; const [x2, y2] = pos[s.plateau];
      return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="flux"/>`;
    }).join('');
    const etiquettesDep = geo.departements.map((d) => {
      const nums = d.d.match(/-?\d+(\.\d+)?/g).map(Number);
      let sx = 0, sy = 0, n = 0;
      for (let i = 0; i < nums.length; i += 2) { sx += nums[i]; sy += nums[i + 1]; n++; }
      const decal = { '06': [10, -40], '13': [-20, 30], '83': [0, 40], '84': [-10, -25], '04': [10, 30], '05': [0, 0] }[d.code] || [0, 0];
      return `<text x="${sx / n + decal[0]}" y="${sy / n + decal[1]}" class="dep-nom" text-anchor="middle">${esc(d.nom)}</text>`;
    }).join('');
    const points = [...etat.sites].sort((a, b) => b.examens_total - a.examens_total).map((s) => {
      const [x, y] = pos[s.code];
      const c = G.couleur(s.etat === 'ok' ? '--ok' : s.etat === 'alerte' ? '--flag' : '--wait');
      const r = rayon(s);
      return `<g class="site-pt" data-site="${s.code}" tabindex="0">
        ${s.type === 'plateau' ? `<circle cx="${x}" cy="${y}" r="${r + 5}" fill="none" stroke="${c}" stroke-width="2" opacity="0.6"/>` : ''}
        <circle cx="${x}" cy="${y}" r="${r}" fill="${c}" fill-opacity="0.82" stroke="#fff" stroke-width="1.5"/>
        <text x="${x + (DECAL_NOM[s.code] || [0, 0])[0]}" y="${y - r - (s.type === 'plateau' ? 9 : 5) + (DECAL_NOM[s.code] || [0, 0])[1]}" class="site-nom" text-anchor="${(DECAL_NOM[s.code] || [])[2] || 'middle'}">${esc(s.ville)}</text>
        <title>${esc(s.nom)} — ${compact(s.examens_total)} analyses · note ${s.indice_qualite}/100</title></g>`;
    }).join('');
    const el = document.getElementById('carte');
    el.innerHTML = `<svg viewBox="0 0 ${geo.largeur} ${geo.hauteur}" class="g-svg carte-svg-reseau">${deps}${etiquettesDep}${liens}${points}</svg>
      <p class="source-carte">${esc(geo.source)}</p>`;
    el.querySelectorAll('.site-pt').forEach((g) => {
      const f = () => ficheSite(g.dataset.site);
      g.addEventListener('click', f);
      g.addEventListener('keydown', (e) => { if (e.key === 'Enter') f(); });
    });
    ficheSite(etat.siteChoisi || 'NIC');
  }

  function ficheSite(code) {
    etat.siteChoisi = code;
    const s = etat.sites.find((x) => x.code === code);
    if (!s) return;
    document.querySelectorAll('.site-pt').forEach((g) => g.classList.toggle('choisi', g.dataset.site === code));
    const perf = etat.perf.filter((p) => p.site === code).sort((a, b) => a.sigma - b.sigma);
    const recoit = etat.sites.filter((x) => x.plateau === code).map((x) => x.ville);
    document.getElementById('fiche-site').innerHTML = `
      <div class="titre-ligne"><h2>${esc(s.nom)}</h2>${badgeEtat(s.etat)}</div>
      <p class="meta">${esc(s.ville)} (${s.departement}) · ${s.type === 'plateau' ? 'gros laboratoire' : 'petit laboratoire, envoie ses analyses spécialisées à ' + esc(ville(s.plateau))}
        · accrédité ISO 15189 depuis ${fdate(s.accredite_depuis)} · ${esc(s.responsable)}</p>
      <div class="mini-stats">
        <div><b>${compact(s.examens_total)}</b><span>analyses</span></div>
        <div><b>${nombre(s.population)}</b><span>habitants (INSEE)</span></div>
        <div><b>${s.indice_qualite}/100</b><span>note qualité</span></div>
        <div><b>${s.derives}</b><span>panne(s)</span></div>
      </div>
      ${recoit.length ? `<p class="hint">Reçoit les analyses spécialisées de : ${recoit.map(esc).join(', ')}.</p>` : ''}
      <h3 style="margin-top:14px">Ses machines : note de fiabilité par analyse</h3><p class="hint">De la moins fiable à la plus fiable. Cliquez pour voir les contrôles.</p>
      <div class="liste-perf">${perf.map((p) => `
        <button type="button" class="ligne-perf" data-lj="${p.analyseur}|${p.analyte}">
          <span>${esc(p.analyte_libelle)}<span class="meta"> · ${esc(p.analyseur_nom)}</span></span>
          <span class="sigma-pastille${fonce(p.sigma)}" style="background:${G.couleurSigma(p.sigma)}">${nombre(p.sigma, 1)} σ</span>
        </button>`).join('')}</div>
      ${s.code === 'NIC' ? '<p class="hint" style="margin-top:12px">Les machines de Nice ont aussi une fiche détaillée : <a href="machines.html">voir les machines de Nice</a>.</p>' : ''}`;
    document.querySelectorAll('#fiche-site [data-lj]').forEach((b) => b.addEventListener('click', () => {
      const [a, an] = b.dataset.lj.split('|');
      voirLJ(a, an);
    }));
  }

  // ---------- 3. Répartition ----------
  async function dessinerActivite() {
    const r = etat.rep || (etat.rep = await api('/reseau/repartition'));
    const res = etat.resume;
    G.ligne(document.getElementById('g-mois'), {
      etiquettes: res.examens_par_mois.map((m) => `${moisCourt(m.mois).replace(/ \d{4}$/, '')} ${m.mois.slice(2, 4)}`),
      series: [{ valeurs: res.examens_par_mois.map((m) => m.n), couleur: G.couleur('--accent'), aire: true }]
    });
    G.barres(document.getElementById('g-analytes'), {
      legende: '<span><i style="background:var(--accent)"></i>Notre réseau</span><span><i class="g-legende-2"></i>France</span>',
      max: Math.max(...r.par_analyte.map((a) => Math.max(a.part_reseau, a.part_nationale))),
      lignes: r.par_analyte.map((a) => ({
        libelle: a.libelle, valeur: a.part_reseau, valeur2: a.part_nationale,
        texte: `${nombre(a.part_reseau, 1)} % · ${nombre(a.part_nationale, 1)} %`,
        titre: `${a.libelle} (code ${a.nabm}) : ${nombre(a.examens)} analyses dans le réseau en 2026, ${nombre(a.actes_nationaux_s1_2026)} en France au 1er semestre 2026`
      }))
    });
    G.barres(document.getElementById('g-prix'), {
      lignes: [...r.par_analyte].sort((a, b) => b.euros_par_acte - a.euros_par_acte).map((a) => ({
        libelle: a.libelle, valeur: a.euros_par_acte, couleur: 'var(--reval)', texte: `${nombre(a.euros_par_acte, 2)} €`
      }))
    });
    G.barres(document.getElementById('g-dep'), {
      lignes: r.par_departement.map((d) => ({ libelle: `${DEP[d.departement] || d.departement} (${d.departement})`, valeur: d.examens }))
    });
    const sel = document.getElementById('res-analyte');
    sel.innerHTML = Object.values(etat.analytes).map((a) => `<option value="${a.code}">${esc(a.libelle)}</option>`).join('');
    sel.value = 'HB';
    sel.addEventListener('change', chargerResultats);
    await chargerResultats();
  }

  async function chargerResultats() {
    const code = document.getElementById('res-analyte').value;
    const r = await api(`/reseau/resultats?analyte=${encodeURIComponent(code)}`);
    G.histogramme(document.getElementById('g-hist'), { classes: r.classes, bas: r.ref_bas, haut: r.ref_haut, unite: r.unite });
    const i = r.interpretation;
    const pc = (n) => `${nombre(100 * (n || 0) / Math.max(1, r.n), 0)} %`;
    document.getElementById('res-chiffres').innerHTML = `
      <div><b>${nombre(r.n)}</b><span>résultats</span></div>
      <div><b>${pc(i.normal)}</b><span>normaux</span></div>
      <div><b>${pc(i.bas)}</b><span>trop bas</span></div>
      <div><b>${pc(i.haut)}</b><span>trop hauts</span></div>`;
    const ages = [...new Set(r.par_groupe.map((g) => g.classe_age))];
    const cell = (sexe, age) => {
      const g = r.par_groupe.find((x) => x.sexe === sexe && x.classe_age === age);
      return g ? `<td class="num">${nombre(g.moyenne, g.moyenne < 2 ? 2 : g.moyenne < 30 ? 1 : 0)}<div class="meta">${nombre(g.part_hors, 0)} % anormaux</div></td>` : '<td class="num meta">—</td>';
    };
    document.getElementById('res-groupes').innerHTML = `<h3>Moyenne selon l’âge et le sexe</h3>
      <table class="table-audit"><thead><tr><th>Âge</th><th class="num">Femmes</th><th class="num">Hommes</th></tr></thead><tbody>
      ${ages.map((a) => `<tr><td>${esc(a)} ans</td>${cell('F', a)}${cell('M', a)}</tr>`).join('')}</tbody></table>
      <p class="hint">Unité : ${esc(r.unite)}. Valeurs normales : ${r.ref_bas != null ? nombre(r.ref_bas, 1) + ' à ' : 'moins de '}${nombre(r.ref_haut, 1)}${['HB', 'CREA', 'FERR'].includes(code) ? ' (elles changent selon le sexe)' : ''}.</p>`;
    const k = r.k_anonymat;
    const ex = k.par_ville.exemples[0];
    document.getElementById('res-kanon').innerHTML = `<div class="kanon ${k.respecte ? 'ok' : ''}">
      <b>Vérification de l’anonymat (règle des 5) :</b> on ne partage jamais un groupe de moins de 5 personnes, sinon on pourrait les reconnaître.
      ${k.par_ville.groupes_trop_petits
        ? `Par ville, <b>${k.par_ville.groupes_trop_petits}</b> groupe est trop petit${ex ? ` (${esc(ville(ex.site))}, ${ex.sexe === 'F' ? 'femmes' : 'hommes'} de ${esc(ex.classe_age)} ans : ${ex.n} personnes)` : ''}. biologIA regroupe donc par <b>département</b> avant tout partage : le plus petit groupe a alors <b>${k.par_departement.k_min}</b> personnes. ✔`
        : `Tous les groupes ont au moins ${k.par_ville.k_min} personnes. ✔`}
      <span class="meta"> · ${nombre(r.total_resultats)} résultats, ${nombre(r.patients_pseudonymises)} codes patients, aucun nom.</span></div>`;
  }

  // ---------- 4. Qualité ----------
  async function dessinerQualite() {
    const codesAnalytes = Object.keys(etat.analytes);
    const sitesOrd = [...etat.sites].sort((a, b) => (a.type === b.type ? b.examens_total - a.examens_total : a.type === 'plateau' ? -1 : 1));
    const cell = (site, an) => {
      const p = etat.perf.find((x) => x.site === site && x.analyte === an);
      if (!p) return '<div class="hm-case vide" title="Analyse envoyée au plateau technique">·</div>';
      return `<button type="button" class="hm-case${fonce(p.sigma)}" style="background:${G.couleurSigma(p.sigma)}" data-lj="${p.analyseur}|${an}"
        title="${esc(p.analyseur_nom)} — ${esc(p.analyte_libelle)} : Sigma ${nombre(p.sigma, 1)} (CV ${nombre(p.cv, 2)} %, biais ${nombre(p.biais, 2)} %, ETa ${p.eta} %)">${nombre(p.sigma, 1)}</button>`;
    };
    document.getElementById('heatmap-sigma').innerHTML = `<div class="hm" style="grid-template-columns: 150px repeat(${codesAnalytes.length}, minmax(54px, 1fr))">
      <div></div>${codesAnalytes.map((c) => `<div class="hm-entete" title="${esc(etat.analytes[c].libelle)}">${esc(etat.analytes[c].libelle.replace(/ \(.*\)/, ''))}</div>`).join('')}
      ${sitesOrd.map((s) => `<div class="hm-ligne">${esc(s.ville)}${s.type === 'plateau' ? ' <span class="meta">plateau</span>' : ''}</div>${codesAnalytes.map((c) => cell(s.code, c)).join('')}`).join('')}
    </div>`;
    document.querySelectorAll('#heatmap-sigma [data-lj]').forEach((b) => b.addEventListener('click', () => {
      const [a, an] = b.dataset.lj.split('|');
      voirLJ(a, an, true);
    }));
    // Sélecteurs de la carte de contrôle
    const selA = document.getElementById('lj-analyseur');
    const analyseurs = [...new Map(etat.perf.map((p) => [p.analyseur, p])).values()]
      .sort((a, b) => a.ville.localeCompare(b.ville) || a.analyseur.localeCompare(b.analyseur));
    selA.innerHTML = analyseurs.map((p) => `<option value="${p.analyseur}">${esc(p.ville)} · ${esc(p.analyseur_nom.replace(/ · .*/, ''))}</option>`).join('');
    selA.addEventListener('change', () => { remplirAnalytesLJ(); chargerLJ(); });
    document.getElementById('lj-analyte').addEventListener('change', chargerLJ);
    document.getElementById('lj-periode').addEventListener('change', chargerLJ);
    const premier = etat.ljDemande || ['TLN-BIO', 'K'];
    selA.value = premier[0];
    remplirAnalytesLJ();
    document.getElementById('lj-analyte').value = premier[1];
    if (premier[1] === 'K' && premier[0] === 'TLN-BIO') document.getElementById('lj-periode').value = '180';
    await chargerLJ();
    dessinerTablePerf();
  }

  function dessinerTablePerf() {
    const toutes = [...etat.perf].sort((a, b) => a.sigma - b.sigma);
    const lignes = etat.perfTout ? toutes : toutes.slice(0, 12);
    document.getElementById('table-perf').innerHTML = `<div class="table-defile"><table class="table-audit"><thead><tr>
      <th>Laboratoire</th><th>Analyseur</th><th>Analyse</th><th class="num">CV %</th><th class="num">Biais %</th><th class="num">ETa %</th><th class="num">Sigma</th><th>Niveau</th><th>Règles conseillées</th><th>Fréquence</th></tr></thead><tbody>
      ${lignes.map((p) => `<tr><td>${esc(p.ville)}</td><td>${p.machine_id ? `<a href="machine.html?id=${p.machine_id}">${esc(p.analyseur_nom)}</a>` : esc(p.analyseur_nom)}</td><td>${esc(p.analyte_libelle)}</td>
        <td class="num">${nombre(p.cv, 2)}</td><td class="num">${nombre(p.biais, 2)}</td><td class="num">${p.eta}</td>
        <td class="num"><span class="sigma-pastille${fonce(p.sigma)}" style="background:${G.couleurSigma(p.sigma)}">${nombre(p.sigma, 1)}</span></td>
        <td>${esc(p.niveau_sigma)}</td><td class="mono petit">${esc(p.regles_conseillees)}</td><td>${esc(p.frequence)}</td></tr>`).join('')}
    </tbody></table></div>
    <button type="button" class="secondary" id="perf-tout" style="margin-top:10px">${etat.perfTout ? 'Afficher seulement les 12 plus fragiles' : `Afficher les ${toutes.length} analyses`}</button>`;
    document.getElementById('perf-tout').onclick = () => { etat.perfTout = !etat.perfTout; dessinerTablePerf(); };
  }

  function remplirAnalytesLJ() {
    const a = document.getElementById('lj-analyseur').value;
    const liste = etat.perf.filter((p) => p.analyseur === a);
    document.getElementById('lj-analyte').innerHTML = liste.map((p) => `<option value="${p.analyte}">${esc(p.analyte_libelle)}</option>`).join('');
  }

  function voirLJ(analyseur, analyte, defiler) {
    etat.ljDemande = [analyseur, analyte];
    if (!etat.charge.machines) { ouvrir('machines'); return; }
    ouvrir('machines');
    document.getElementById('lj-analyseur').value = analyseur;
    remplirAnalytesLJ();
    document.getElementById('lj-analyte').value = analyte;
    chargerLJ();
    if (defiler !== false) document.getElementById('bloc-lj').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function chargerLJ() {
    const a = document.getElementById('lj-analyseur').value;
    const an = document.getElementById('lj-analyte').value;
    if (!a || !an) return;
    const jours = Number(document.getElementById('lj-periode').value);
    const p = etat.perf.find((x) => x.analyseur === a && x.analyte === an);
    let debut = new Date(Date.parse('2026-11-14') - jours * 86400000).toISOString().slice(0, 10);
    const r = await api(`/reseau/qc?analyseur=${encodeURIComponent(a)}&analyte=${encodeURIComponent(an)}`);
    if (r.derive && jours < 365 && r.derive.debut < debut) {
      // on centre la fenêtre sur la dérive pour qu'elle reste visible
      const d = new Date(Date.parse(r.derive.debut) - 45 * 86400000);
      debut = d.toISOString().slice(0, 10);
      const fin = new Date(Date.parse(debut) + jours * 86400000).toISOString().slice(0, 10);
      r.points = r.points.filter((x) => x.date <= fin);
    }
    const points = r.points.filter((x) => x.date >= debut);
    document.getElementById('titre-lj').textContent = `Les contrôles de la machine — ${p ? p.ville + ' · ' + p.analyte_libelle : ''}`;
    G.leveyJennings(document.getElementById('lj'), { points, derive: r.derive });
    const rejets = points.filter((x) => x.rejet).length / 2;
    document.getElementById('lj-info').innerHTML = `${nombre(points.length / 2)} jours de contrôle · ${nombre(rejets)} alerte(s)
      ${p ? ` · note de fiabilité ${nombre(p.sigma, 1)} (${esc(p.niveau_sigma)})` : ''}
      ${r.derive ? ` · <b>Panne</b> : ${esc(LIB_TYPE[r.derive.type]).toLowerCase()}, commencée le ${fdate(r.derive.debut)}, repérée le ${fdate(r.derive.detection)}.` : ''}`;
  }

  // ---------- 5. Dérives ----------
  async function dessinerAlertes() {
    const r = etat.resume;
    const gagnes = etat.derives.reduce((t, d) => t + d.jours_gagnes, 0);
    document.getElementById('resume-alertes').innerHTML = `
      <div class="stat stat-alert"><div class="label"><span class="stat-dot" style="background:var(--flag)"></span>Pannes de mesure</div><div class="valeur">${r.derives}</div><div class="sous">en 2025 et 2026</div></div>
      <div class="stat stat-ok"><div class="label"><span class="stat-dot" style="background:var(--ok)"></span>Repérées en</div><div class="valeur">${nombre(r.delai_moyen_detection, 1)} j</div><div class="sous">en moyenne (au lieu de la fin du mois)</div></div>
      <div class="stat"><div class="label"><span class="stat-dot" style="background:var(--accent)"></span>Jours de panne évités</div><div class="valeur">${gagnes}</div><div class="sous">au total</div></div>
      <div class="stat stat-reval"><div class="label"><span class="stat-dot" style="background:var(--reval)"></span>Lots à revoir</div><div class="valeur">${(r.lots.a_revalider || 0) + (r.lots.revalide || 0)}</div><div class="sous">${r.lots.revalide || 0} déjà revalidés</div></div>`;
    await dessinerDerives();
    await dessinerEeq();
  }

  async function dessinerDerives() {
    const el = document.getElementById('liste-derives');
    const derives = [...etat.derives].sort((a, b) => b.debut.localeCompare(a.debut));
    el.innerHTML = `<h2 class="section-titre" style="margin-top:6px">Les ${derives.length} pannes, de la plus récente à la plus ancienne</h2>
      <p class="hint">Cliquez sur une panne pour voir ce qui s’est passé.</p>` + derives.map((d, i) => {
      const max = Math.max(d.resultats_exposes_sans, 1);
      const evites = d.resultats_exposes_sans - d.resultats_exposes_avec;
      return `<details class="card derive"${i === 0 ? ' open' : ''}>
        <summary class="derive-resume">
          <span class="derive-date">${fdate(d.debut)}</span>
          <span><b>${esc(d.ville)}</b> · ${esc(d.analyte_libelle)}</span>
          <span class="meta">${d.delai_detection_jours === 0 ? 'repérée le jour même' : `repérée en ${d.delai_detection_jours} jour${d.delai_detection_jours > 1 ? 's' : ''}`}</span>
          <span class="badge ok">${nombre(evites)} résultats faux évités</span>
        </summary>
        <div class="derive-tete">
          <div><span class="badge douteux">${esc(LIB_TYPE[d.type])}</span>
            <h2>${esc(d.analyte_libelle)} · ${esc(d.analyseur_nom)}</h2>
            <p class="meta">${esc(d.site_nom)}</p></div>
          <button type="button" class="secondary" data-lj="${d.analyseur}|${d.analyte}">Voir les contrôles</button>
        </div>
        <ol class="frise">
          <li><b>${fdate(d.debut)}</b><span>La machine commence à se tromper</span></li>
          <li class="frise-ok"><b>${fdate(d.detection)}</b><span>biologIA donne l’alerte<br><span class="mono petit">règle ${esc(d.regles)}</span></span></li>
          <li><b>${fdate(d.correction)}</b><span>Machine réparée</span></li>
          <li class="frise-sans"><b>${fdate(d.revue_mensuelle)}</b><span>Sans biologIA, on l’aurait<br>vue seulement ici</span></li>
        </ol>
        <div class="derive-corps">
          <div>
            <p><b>Pourquoi :</b> ${esc(d.cause)}</p>
            <p><b>Ce qu’on a fait :</b> ${esc(d.action)}</p>
            <p><b>Données à refaire :</b> ${d.lots_impactes.map((l) => `<a href="#donnees" data-lot-filtre="${esc(d.site)}|${esc(d.analyte)}">${esc(l.nom)}</a> <span class="badge ${BADGE_STATUT[l.statut]}">${LIB_STATUT[l.statut]}</span>`).join(' ') || 'aucun'}</p>
          </div>
          <div class="derive-chiffres">
            <div class="impact-barre"><span>Sans biologIA · ${d.jours_exposition_sans} jours de panne</span><b>${nombre(d.resultats_exposes_sans)}</b>
              <span class="piste"><i style="width:100%;background:var(--flag)"></i></span></div>
            <div class="impact-barre"><span>Avec biologIA · ${d.jours_exposition_avec} jour${d.jours_exposition_avec > 1 ? 's' : ''} de panne</span><b>${nombre(d.resultats_exposes_avec)}</b>
              <span class="piste"><i style="width:${(100 * d.resultats_exposes_avec / max).toFixed(1)}%;background:var(--ok)"></i></span></div>
            <p class="hint">Nombre de résultats de patients rendus pendant la panne (estimé).</p>
          </div>
        </div>
      </details>`;
    }).join('');
    el.querySelectorAll('[data-lj]').forEach((b) => b.addEventListener('click', () => {
      const [a, an] = b.dataset.lj.split('|');
      voirLJ(a, an);
    }));
    el.querySelectorAll('[data-lot-filtre]').forEach((a) => a.addEventListener('click', (e) => {
      e.preventDefault();
      const [site, an] = a.dataset.lotFiltre.split('|');
      etat.lotsFiltre = { site, analyte: an };
      etat.charge.donnees = false;
      ouvrir('donnees');
    }));
  }

  // ---------- 6. Inter-laboratoires ----------
  async function dessinerEeq() {
    const sel = document.getElementById('eeq-analyte');
    sel.innerHTML = Object.values(etat.analytes).map((a) => `<option value="${a.code}">${esc(a.libelle)}</option>`).join('');
    sel.value = 'CREA';
    sel.addEventListener('change', chargerEeq);
    await chargerEeq();
  }
  async function chargerEeq() {
    const an = document.getElementById('eeq-analyte').value;
    const lignes = await api(`/reseau/eeq?analyte=${encodeURIComponent(an)}`);
    const campagnes = [...new Set(lignes.map((l) => l.campagne))].sort().slice(-12); // les 12 derniers mois
    const sites = [...new Set(lignes.map((l) => l.site))];
    document.getElementById('heatmap-eeq').innerHTML = `<div class="hm" style="grid-template-columns: 150px repeat(${campagnes.length}, minmax(48px, 1fr))">
      <div></div>${campagnes.map((c) => `<div class="hm-entete">${moisCourt(c)}</div>`).join('')}
      ${sites.map((s) => `<div class="hm-ligne">${esc(ville(s))}</div>${campagnes.map((c) => {
        const l = lignes.find((x) => x.site === s && x.campagne === c);
        return l ? `<div class="hm-case${Math.abs(l.z) > 3 ? ' fonce' : ''}" style="background:${G.couleurZ(l.z)}" title="${esc(ville(s))} · ${moisCourt(c)} : ${l.valeur} pour une cible de ${l.cible} (z = ${nombre(l.z, 2)})">${nombre(l.z, 1)}</div>` : '<div class="hm-case vide">·</div>';
      }).join('')}`).join('')}
    </div>`;
    // Biais persistants : moyenne des z d'un site
    const parSite = sites.map((s) => {
      const z = lignes.filter((l) => l.site === s).map((l) => l.z);
      return { site: s, moy: z.reduce((a, b) => a + b, 0) / z.length, hors: z.filter((v) => Math.abs(v) > 2).length };
    }).filter((x) => Math.abs(x.moy) > 1.2 || x.hors >= 2);
    const perfBiais = (s) => etat.perf.find((p) => p.site === s && p.analyte === an);
    document.getElementById('eeq-alertes').innerHTML = parSite.length
      ? parSite.map((x) => {
        const p = perfBiais(x.site);
        return `<div class="alerte-ligne"><span class="badge douteux">Toujours à côté</span>
          <b>${esc(ville(x.site))}</b> mesure ${x.moy > 0 ? 'trop haut' : 'trop bas'} presque chaque mois${p ? ` (environ ${nombre(Math.abs(p.biais), 1)} % ${x.moy > 0 ? 'de trop' : 'de moins'})` : ''}.
          ${p ? `Note de fiabilité : ${nombre(p.sigma, 1)}. ` : ''}À faire : refaire le réglage de la machine avec le fabricant.</div>`;
      }).join('')
      : '<p class="hint">Pour cette analyse, tous les laboratoires sont d’accord entre eux. ✔</p>';
  }

  // ---------- 7. Lots de référence ----------
  async function dessinerLots() {
    const selS = document.getElementById('lots-site');
    const selA = document.getElementById('lots-analyte');
    if (selS.options.length <= 1) {
      selS.innerHTML += etat.sites.map((s) => `<option value="${s.code}">${esc(s.ville)}</option>`).join('');
      selA.innerHTML += Object.values(etat.analytes).map((a) => `<option value="${a.code}">${esc(a.libelle)}</option>`).join('');
      ['lots-site', 'lots-analyte', 'lots-statut'].forEach((id) => document.getElementById(id).addEventListener('change', () => { etat.lotsPage = 1; chargerLots(); }));
      document.getElementById('pagination-reseau').addEventListener('click', (e) => {
        const b = e.target.closest('[data-p]');
        if (!b || b.disabled) return;
        etat.lotsPage = Number(b.dataset.p);
        chargerLots();
      });
    }
    if (etat.lotsFiltre) {
      selS.value = etat.lotsFiltre.site || '';
      selA.value = etat.lotsFiltre.analyte || '';
      document.getElementById('lots-statut').value = '';
      etat.lotsFiltre = null;
      etat.lotsPage = 1;
    }
    await chargerLots();
  }
  async function chargerLots() {
    const q = new URLSearchParams();
    for (const [id, cle] of [['lots-site', 'site'], ['lots-analyte', 'analyte'], ['lots-statut', 'statut']]) {
      const v = document.getElementById(id).value;
      if (v) q.set(cle, v);
    }
    const lots = await api('/reseau/lots' + (q.toString() ? '?' + q : ''));
    const PAGE = 10;
    const pages = Math.max(1, Math.ceil(lots.length / PAGE));
    etat.lotsPage = Math.min(etat.lotsPage, pages);
    const tranche = lots.slice((etat.lotsPage - 1) * PAGE, etat.lotsPage * PAGE);
    const n = (s) => lots.filter((l) => l.statut === s).length;
    document.getElementById('lots-compte').textContent = `${nombre(lots.length)} lots · ${n('a_revalider')} à revalider · ${n('a_valider')} à valider · ${n('revalide')} revalidés · ${n('valide')} validés`;
    const trimestre = (nom) => { const m = /(\d{4})T(\d)$/.exec(nom); return m ? `${m[2]}${m[2] === '1' ? 'er' : 'e'} trim. ${m[1]}` : ''; };
    document.getElementById('table-lots').innerHTML = `<div class="table-defile"><table class="table-audit table-lots-reseau"><thead><tr>
      <th>Lot</th><th>Laboratoire</th><th>Analyse</th><th>Période</th><th class="num">Résultats utilisés</th><th class="num">Limites normales calculées</th><th>Statut</th></tr></thead><tbody>
      ${tranche.map((l) => `<tr${l.derive_liee && l.statut === 'a_revalider' ? ' class="ligne-alerte"' : ''}>
        <td class="mono">${esc(l.nom)}</td><td>${esc(l.ville)}</td><td>${esc(l.analyte_libelle)}</td>
        <td>${trimestre(l.nom)}</td><td class="num">${nombre(l.nb_resultats)}</td>
        <td class="num">${l.seuil_bas != null ? nombre(l.seuil_bas, dec(l.seuil_haut)) + ' – ' : '< '}${nombre(l.seuil_haut, dec(l.seuil_haut))} ${esc(l.unite)}</td>
        <td><span class="badge ${BADGE_STATUT[l.statut]}">${LIB_STATUT[l.statut]}</span>${l.derive_liee ? `<div class="meta">touché par une panne</div>` : ''}</td></tr>`).join('') || '<tr><td colspan="7" class="empty">Aucun lot.</td></tr>'}
    </tbody></table></div>`;
    document.getElementById('pagination-reseau').innerHTML = pages > 1
      ? `<button type="button" class="secondary" data-p="${etat.lotsPage - 1}" ${etat.lotsPage <= 1 ? 'disabled' : ''}>Précédent</button>
         <span>Page ${etat.lotsPage} / ${pages}</span>
         <button type="button" class="secondary" data-p="${etat.lotsPage + 1}" ${etat.lotsPage >= pages ? 'disabled' : ''}>Suivant</button>` : '';
  }

  // ---------- 8. Données ----------
  async function dessinerDonnees() {
    await dessinerLots();
    const d = await api('/reseau/dictionnaire');
    const LIB = { 'réel': 'ok', 'référentiel': 'a-revalider', 'simulé': 'a-valider' };
    document.getElementById('sources').innerHTML = `<table class="table-audit"><thead><tr><th>Donnée</th><th>Origine</th><th>Nature</th></tr></thead><tbody>
      ${d.sources.map((s) => `<tr><td>${esc(s.libelle)}</td><td>${esc(s.origine)}</td><td><span class="badge ${LIB[s.type]}">${esc(s.type)}</span></td></tr>`).join('')}
    </tbody></table>
    <p class="hint" style="margin-top:10px">Pourquoi simuler ? Les vraies valeurs de contrôle qualité d’un laboratoire ne sont pas publiques, et les résultats patients sont protégés (RGPD, secret médical). La simulation est donc <b>calée sur les volumes réels</b> et suit les lois statistiques des contrôles qualité (loi normale, règles de Westgard), avec une graine fixe : chaque lancement donne les mêmes chiffres.</p>`;
    const COMPTES = { sites: etat.sites.length, analytes: etat.resume.analyses, analyseurs: etat.resume.analyseurs, qc: etat.resume.controles_qc, derives: etat.resume.derives, activite: null, eeq: etat.resume.eeq_resultats, lots: etat.resume.lots.total, resultats: etat.resume.resultats_pseudonymises };
    document.getElementById('jeux').innerHTML = Object.entries(d.tables).map(([nom, t]) => `
      <details class="jeu">
        <summary><span><b>${esc(nom)}</b> — ${esc(t.description)}</span>
          <span>${COMPTES[nom] != null ? `<span class="meta">${nombre(COMPTES[nom])} lignes</span>` : ''}
          <a class="btn-link" href="/api/reseau/export/${nom}" download>CSV</a></span></summary>
        <table class="table-audit"><tbody>${Object.entries(t.colonnes).map(([c, desc]) => `<tr><td class="mono">${esc(c)}</td><td>${esc(desc)}</td></tr>`).join('')}</tbody></table>
      </details>`).join('');
  }

  // ---------- Démarrage ----------
  document.getElementById('onglets').addEventListener('click', (e) => {
    const b = e.target.closest('[data-onglet]');
    if (b) ouvrir(b.dataset.onglet);
  });
  window.addEventListener('hashchange', () => {
    const h = location.hash.slice(1);
    if (h && document.querySelector(`[data-panneau="${h}"]`)) ouvrir(h);
  });
  document.addEventListener('click', (e) => {
    const a = e.target.closest('[data-voir-site]');
    if (a) { etat.siteChoisi = a.dataset.voirSite; if (etat.charge.carte) ficheSite(etat.siteChoisi); }
  });

  (async () => {
    try {
      const [resume, sites, perf, derives] = await Promise.all([
        api('/reseau/resume'), api('/reseau/sites'), api('/reseau/performance'), api('/reseau/derives')
      ]);
      Object.assign(etat, { resume, sites, perf, derives });
      for (const p of perf) {
        etat.analytes[p.analyte] = etat.analytes[p.analyte] || { code: p.analyte, libelle: p.analyte_libelle, unite: p.unite };
      }
      const ordre = ['HB', 'CREA', 'K', 'ALAT', 'CRP', 'CHOL', 'TSH', 'FERR', 'HBA1C', 'PSA'];
      etat.analytes = Object.fromEntries(ordre.filter((c) => etat.analytes[c]).map((c) => [c, etat.analytes[c]]));
      dessinerEnsemble();
      const h = location.hash.slice(1);
      ouvrir(h && document.querySelector(`[data-panneau="${h}"]`) ? h : 'ensemble');
    } catch (err) {
      erreur(err);
    }
  })();
})();
