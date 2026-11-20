/* reseau.js — page « Observatoire du réseau » */
(function () {
  const { nombre, compact, esc, moisCourt } = G;
  const etat = { resume: null, sites: [], perf: [], derives: [], analytes: {}, rep: null, lotsPage: 1, charge: {} };
  const LIB_ETAT = { ok: 'Conforme', surveiller: 'À surveiller', alerte: 'Alerte' };
  const COUL_ETAT = { ok: 'var(--ok)', surveiller: 'var(--wait)', alerte: 'var(--flag)' };
  const LIB_STATUT = { valide: 'Validé', a_valider: 'À valider', a_revalider: 'À revalider' };
  const BADGE_STATUT = { valide: 'ok', a_valider: 'a-valider', a_revalider: 'a-revalider' };
  const LIB_TYPE = { decalage: 'Décalage brutal', tendance: 'Dérive progressive', imprecision: 'Perte de précision' };
  const DECAL_NOM = { ANT: [14, 24, 'start'], CAN: [-12, 28, 'end'], FRE: [0, 40], MRS: [-34, 0], NIC: [-6, 0] };
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
    const f = { carte: dessinerCarte, repartition: dessinerRepartition, qualite: dessinerQualite, derives: dessinerDerives, interlabos: dessinerEeq, lots: dessinerLots, donnees: dessinerDonnees }[nom];
    if (f && !etat.charge[nom]) { etat.charge[nom] = true; f().catch(erreur); }
  }
  function erreur(err) { afficherMessage('erreur-page', err.message || String(err)); }

  // ---------- 1. Vue d'ensemble ----------
  function dessinerEnsemble() {
    const r = etat.resume;
    document.getElementById('intro').innerHTML = `${r.sites} laboratoires (dont ${r.plateaux} plateaux techniques), ${r.analyseurs} analyseurs,
      ${nombre(r.controles_qc)} contrôles qualité et ${compact(r.examens_10_mois)} examens de janvier à octobre 2026.
      <span class="pastille-donnees">Volumes calés sur des données réelles · détails dans « Données »</span>`;
    const baisse = r.resultats_exposes_sans ? Math.round(100 * (1 - r.resultats_exposes_avec / r.resultats_exposes_sans)) : 0;
    document.getElementById('kpis').innerHTML = `
      <div class="stat"><div class="label"><span class="stat-dot" style="background:var(--accent)"></span>Examens (janv.–oct.)</div><div class="valeur">${compact(r.examens_10_mois)}</div><div class="sous">9 analyses · ${r.couples_suivis} couples analyseur × analyse</div></div>
      <a class="stat" href="#qualite"><div class="label"><span class="stat-dot" style="background:var(--ok)"></span>Sigma médian</div><div class="valeur">${nombre(r.sigma_median, 1)}</div><div class="sous">${r.couples_sigma_faible} mesures sous 4 Sigma</div></a>
      <a class="stat stat-alert" href="#derives"><div class="label"><span class="stat-dot" style="background:var(--flag)"></span>Dérives détectées</div><div class="valeur">${r.derives}</div><div class="sous">vues en ${nombre(r.delai_moyen_detection, 1)} j en moyenne</div></a>
      <a class="stat stat-reval" href="#lots"><div class="label"><span class="stat-dot" style="background:var(--reval)"></span>Lots à revalider</div><div class="valeur">${r.lots.a_revalider || 0}</div><div class="sous">sur ${r.lots.total} lots de référence</div></a>
      <a class="stat stat-wait" href="#interlabos"><div class="label"><span class="stat-dot" style="background:var(--wait)"></span>Écarts inter-labos</div><div class="valeur">${r.eeq_hors_limites}</div><div class="sous">résultats |z| > 2 sur ${r.eeq_resultats}</div></a>
      <div class="stat stat-ok"><div class="label"><span class="stat-dot" style="background:var(--ok)"></span>Résultats faux évités</div><div class="valeur">−${baisse} %</div><div class="sous">par rapport à une revue mensuelle</div></div>`;
    G.ligne(document.getElementById('g-mois'), {
      etiquettes: r.examens_par_mois.map((m) => moisCourt(m.mois)),
      series: [{ valeurs: r.examens_par_mois.map((m) => m.n), couleur: G.couleur('--accent'), aire: true }]
    });
    const max = r.resultats_exposes_sans || 1;
    document.getElementById('impact').innerHTML = `
      <p class="hint">Sur les ${r.derives} dérives simulées de l’année, nombre de résultats patients rendus pendant que l’appareil mesurait faux :</p>
      <div class="impact-barre"><span>Revue mensuelle du contrôle qualité</span><b>${nombre(r.resultats_exposes_sans)}</b>
        <span class="piste"><i style="width:100%;background:var(--flag)"></i></span></div>
      <div class="impact-barre"><span>Avec biologIA (Westgard chaque jour)</span><b>${nombre(r.resultats_exposes_avec)}</b>
        <span class="piste"><i style="width:${(100 * r.resultats_exposes_avec / max).toFixed(1)}%;background:var(--ok)"></i></span></div>
      <p class="impact-phrase"><b>${r.jours_gagnes} jours</b> de dérive en moins sur l’année, et chaque dérive est reliée automatiquement aux lots de référence à revalider.</p>
      <a class="btn-link" href="#derives">Voir les dérives</a>`;
    const tri = [...etat.sites].sort((a, b) => b.indice_qualite - a.indice_qualite);
    document.getElementById('classement').innerHTML = `<table class="table-audit table-classement"><thead><tr>
      <th>#</th><th>Laboratoire</th><th>Type</th><th class="num">Examens</th><th class="num">Sigma moyen</th><th class="num">|z| inter-labos</th><th class="num">Lots à revoir</th><th>Indice qualité</th><th>État</th></tr></thead><tbody>
      ${tri.map((s, i) => `<tr data-site="${s.code}">
        <td>${i + 1}</td><td><a href="#carte" data-voir-site="${s.code}">${esc(s.ville)}</a><div class="meta">${esc(s.nom)}</div></td>
        <td>${s.type === 'plateau' ? 'Plateau technique' : 'Proximité'}</td>
        <td class="num">${compact(s.examens_10_mois)}</td>
        <td class="num">${nombre(s.sigma_moyen, 1)}${s.sigma_min < 3 ? ` <span class="meta">(min ${nombre(s.sigma_min, 1)})</span>` : ''}</td>
        <td class="num">${nombre(s.eeq_z_moyen, 2)}</td>
        <td class="num">${s.lots_a_revalider + s.lots_a_valider}</td>
        <td><span class="score-mini"><i style="width:${s.indice_qualite}%;background:${COUL_ETAT[s.etat]}"></i></span> ${s.indice_qualite}</td>
        <td>${badgeEtat(s.etat)}</td></tr>`).join('')}</tbody></table>`;
  }

  // ---------- 2. Carte ----------
  async function dessinerCarte() {
    const geo = await fetch('donnees/carte-sud.json').then((r) => r.json());
    const P = geo.projection;
    const xy = (lon, lat) => [((lon * P.k) - P.minx) * P.s + P.marge, ((-lat) - P.miny) * P.s + P.marge];
    const maxEx = Math.max(...etat.sites.map((s) => s.examens_10_mois));
    const rayon = (s) => 7 + 22 * Math.sqrt(s.examens_10_mois / maxEx);
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
    const points = [...etat.sites].sort((a, b) => b.examens_10_mois - a.examens_10_mois).map((s) => {
      const [x, y] = pos[s.code];
      const c = G.couleur(s.etat === 'ok' ? '--ok' : s.etat === 'alerte' ? '--flag' : '--wait');
      const r = rayon(s);
      return `<g class="site-pt" data-site="${s.code}" tabindex="0">
        ${s.type === 'plateau' ? `<circle cx="${x}" cy="${y}" r="${r + 5}" fill="none" stroke="${c}" stroke-width="2" opacity="0.6"/>` : ''}
        <circle cx="${x}" cy="${y}" r="${r}" fill="${c}" fill-opacity="0.82" stroke="#fff" stroke-width="1.5"/>
        <text x="${x + (DECAL_NOM[s.code] || [0, 0])[0]}" y="${y - r - (s.type === 'plateau' ? 9 : 5) + (DECAL_NOM[s.code] || [0, 0])[1]}" class="site-nom" text-anchor="${(DECAL_NOM[s.code] || [])[2] || 'middle'}">${esc(s.ville)}</text>
        <title>${esc(s.nom)} — ${compact(s.examens_10_mois)} examens · indice ${s.indice_qualite}</title></g>`;
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
      <p class="meta">${esc(s.ville)} (${s.departement}) · ${s.type === 'plateau' ? 'plateau technique' : 'site de proximité → ' + esc(ville(s.plateau))}
        · accrédité ISO 15189 depuis ${fdate(s.accredite_depuis)} · ${esc(s.responsable)}</p>
      <div class="mini-stats">
        <div><b>${compact(s.examens_10_mois)}</b><span>examens</span></div>
        <div><b>${nombre(s.population)}</b><span>habitants (INSEE)</span></div>
        <div><b>${s.indice_qualite}</b><span>indice qualité</span></div>
        <div><b>${s.derives}</b><span>dérive(s)</span></div>
      </div>
      ${recoit.length ? `<p class="hint">Reçoit les analyses spécialisées de : ${recoit.map(esc).join(', ')}.</p>` : ''}
      <h3 style="margin-top:14px">Ses analyses, de la plus fragile à la plus fiable</h3>
      <div class="liste-perf">${perf.map((p) => `
        <button type="button" class="ligne-perf" data-lj="${p.analyseur}|${p.analyte}">
          <span>${esc(p.analyte_libelle)}<span class="meta"> · ${esc(p.analyseur_nom)}</span></span>
          <span class="sigma-pastille${fonce(p.sigma)}" style="background:${G.couleurSigma(p.sigma)}">${nombre(p.sigma, 1)} σ</span>
        </button>`).join('')}</div>
      ${s.code === 'NIC' ? '<p class="hint" style="margin-top:12px">Les analyseurs de Nice sont aussi ceux du registre détaillé : <a href="machines.html">voir les machines</a>.</p>' : ''}`;
    document.querySelectorAll('#fiche-site [data-lj]').forEach((b) => b.addEventListener('click', () => {
      const [a, an] = b.dataset.lj.split('|');
      voirLJ(a, an);
    }));
  }

  // ---------- 3. Répartition ----------
  async function dessinerRepartition() {
    const r = etat.rep || (etat.rep = await api('/reseau/repartition'));
    G.barres(document.getElementById('g-analytes'), {
      legende: '<span><i style="background:var(--accent)"></i>Réseau biologIA Sud</span><span><i class="g-legende-2"></i>France (Cnam)</span>',
      max: Math.max(...r.par_analyte.map((a) => Math.max(a.part_reseau, a.part_nationale))),
      lignes: r.par_analyte.map((a) => ({
        libelle: a.libelle, valeur: a.part_reseau, valeur2: a.part_nationale,
        texte: `${nombre(a.part_reseau, 1)} % · ${nombre(a.part_nationale, 1)} %`,
        titre: `${a.libelle} — code NABM ${a.nabm} : ${nombre(a.examens)} examens dans le réseau, ${nombre(a.actes_nationaux_s1_2026)} actes remboursés en France au 1er semestre 2026`
      }))
    });
    G.barres(document.getElementById('g-dep'), {
      lignes: r.par_departement.map((d) => ({ libelle: `${DEP[d.departement] || d.departement} (${d.departement})`, valeur: d.examens }))
    });
    const LIB_DISC = { biochimie: 'Biochimie', hematologie: 'Hématologie', immunologie: 'Immunologie' };
    G.barres(document.getElementById('g-disc'), {
      lignes: r.par_discipline.map((d) => ({ libelle: LIB_DISC[d.discipline] || d.discipline, valeur: d.examens, couleur: 'var(--reval)' }))
    });
    G.barres(document.getElementById('g-flux'), {
      lignes: r.flux_vers_plateaux.map((f) => ({ libelle: `${ville(f.depuis)} → ${ville(f.vers)}`, valeur: f.examens, couleur: 'var(--wait)' }))
    });
  }

  // ---------- 4. Qualité ----------
  async function dessinerQualite() {
    const codesAnalytes = Object.keys(etat.analytes);
    const sitesOrd = [...etat.sites].sort((a, b) => (a.type === b.type ? b.examens_10_mois - a.examens_10_mois : a.type === 'plateau' ? -1 : 1));
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
      .sort((a, b) => a.analyseur.localeCompare(b.analyseur));
    selA.innerHTML = analyseurs.map((p) => `<option value="${p.analyseur}">${esc(p.analyseur_nom)}${p.site !== 'NIC' ? '' : ' · Nice'}</option>`).join('');
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
    if (!etat.charge.qualite) { ouvrir('qualite'); return; }
    ouvrir('qualite');
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
    document.getElementById('titre-lj').textContent = `Carte de contrôle — ${p ? p.analyseur_nom + ' · ' + p.analyte_libelle : ''}`;
    G.leveyJennings(document.getElementById('lj'), { points, derive: r.derive });
    const rejets = points.filter((x) => x.rejet).length / 2;
    document.getElementById('lj-info').innerHTML = `${nombre(points.length / 2)} séries de contrôle · ${nombre(rejets)} rejetée(s)
      ${p ? ` · Sigma ${nombre(p.sigma, 1)} (${esc(p.niveau_sigma)})` : ''}
      ${r.derive ? ` · <b>Dérive</b> : ${esc(LIB_TYPE[r.derive.type])} commencée le ${fdate(r.derive.debut)}, vue le ${fdate(r.derive.detection)} par la règle ${esc(r.derive.regles)}.` : ''}`;
  }

  // ---------- 5. Dérives ----------
  async function dessinerDerives() {
    const el = document.getElementById('liste-derives');
    el.innerHTML = etat.derives.map((d, i) => {
      const max = Math.max(d.resultats_exposes_sans, 1);
      return `<article class="card derive">
        <div class="derive-tete">
          <div><span class="badge douteux">${esc(LIB_TYPE[d.type])}</span>
            <h2>${esc(d.analyte_libelle)} · ${esc(d.analyseur_nom)}</h2>
            <p class="meta">${esc(d.site_nom)}</p></div>
          <button type="button" class="secondary" data-lj="${d.analyseur}|${d.analyte}">Voir la carte de contrôle</button>
        </div>
        <ol class="frise">
          <li><b>${fdate(d.debut)}</b><span>Début de la dérive</span></li>
          <li class="frise-ok"><b>${fdate(d.detection)}</b><span>Détectée par biologIA<br><span class="mono petit">${esc(d.regles)}</span></span></li>
          <li><b>${fdate(d.correction)}</b><span>Appareil corrigé</span></li>
          <li class="frise-sans"><b>${fdate(d.revue_mensuelle)}</b><span>Date où une revue<br>mensuelle l’aurait vue</span></li>
        </ol>
        <div class="derive-corps">
          <div>
            <p><b>Cause :</b> ${esc(d.cause)}</p>
            <p><b>Action corrective :</b> ${esc(d.action)}</p>
            <p><b>Lots de référence touchés :</b> ${d.lots_impactes.map((l) => `<a href="#lots" data-lot-filtre="${esc(d.site)}|${esc(d.analyte)}">${esc(l.nom)}</a> <span class="badge ${BADGE_STATUT[l.statut]}">${LIB_STATUT[l.statut]}</span>`).join(' ') || 'aucun'}</p>
          </div>
          <div class="derive-chiffres">
            <div class="impact-barre"><span>Sans registre (revue mensuelle) · ${d.jours_exposition_sans} j</span><b>${nombre(d.resultats_exposes_sans)}</b>
              <span class="piste"><i style="width:100%;background:var(--flag)"></i></span></div>
            <div class="impact-barre"><span>Avec biologIA · ${d.jours_exposition_avec} j</span><b>${nombre(d.resultats_exposes_avec)}</b>
              <span class="piste"><i style="width:${(100 * d.resultats_exposes_avec / max).toFixed(1)}%;background:var(--ok)"></i></span></div>
            <p class="hint">Résultats patients rendus pendant la dérive (estimés à partir du volume quotidien du site).</p>
          </div>
        </div>
      </article>`;
    }).join('');
    el.querySelectorAll('[data-lj]').forEach((b) => b.addEventListener('click', () => {
      const [a, an] = b.dataset.lj.split('|');
      voirLJ(a, an);
    }));
    el.querySelectorAll('[data-lot-filtre]').forEach((a) => a.addEventListener('click', (e) => {
      e.preventDefault();
      const [site, an] = a.dataset.lotFiltre.split('|');
      etat.lotsFiltre = { site, analyte: an };
      etat.charge.lots = false;
      ouvrir('lots');
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
    const campagnes = [...new Set(lignes.map((l) => l.campagne))].sort();
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
        return `<div class="alerte-ligne"><span class="badge douteux">Biais persistant</span>
          <b>${esc(ville(x.site))}</b> s’écarte du groupe en moyenne de z = ${nombre(x.moy, 2)} (${x.hors} campagne(s) hors limites).
          ${p ? `Biais estimé ${nombre(p.biais, 1)} % → Sigma ${nombre(p.sigma, 1)}. ` : ''}Le contrôle interne ne le voit pas : il compare l’appareil à lui-même. Action : revoir l’étalonnage avec le fournisseur.</div>`;
      }).join('')
      : '<p class="hint">Aucun biais persistant sur cette analyse : tous les sites restent alignés sur le groupe.</p>';
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
    const PAGE = 15;
    const pages = Math.max(1, Math.ceil(lots.length / PAGE));
    etat.lotsPage = Math.min(etat.lotsPage, pages);
    const tranche = lots.slice((etat.lotsPage - 1) * PAGE, etat.lotsPage * PAGE);
    const n = (s) => lots.filter((l) => l.statut === s).length;
    document.getElementById('lots-compte').textContent = `${lots.length} lots · ${n('a_revalider')} à revalider · ${n('a_valider')} à valider · ${n('valide')} validés`;
    document.getElementById('table-lots').innerHTML = `<div class="table-defile"><table class="table-audit table-lots-reseau"><thead><tr>
      <th>Lot</th><th>Site</th><th>Analyse</th><th>Période</th><th class="num">Résultats</th><th class="num">Seuils d’alerte</th><th>Statut</th><th>Validé par</th></tr></thead><tbody>
      ${tranche.map((l) => `<tr${l.derive_liee ? ' class="ligne-alerte"' : ''}>
        <td class="mono">${esc(l.nom)}</td><td>${esc(l.ville)}</td><td>${esc(l.analyte_libelle)}<div class="meta">${esc(l.analyseur_nom)}</div></td>
        <td>${fdate(l.periode_debut)} → ${fdate(l.periode_fin)}</td><td class="num">${nombre(l.nb_resultats)}</td>
        <td class="num">${l.seuil_bas != null ? nombre(l.seuil_bas, dec(l.seuil_haut)) + ' – ' : '< '}${nombre(l.seuil_haut, dec(l.seuil_haut))} ${esc(l.unite)}</td>
        <td><span class="badge ${BADGE_STATUT[l.statut]}">${LIB_STATUT[l.statut]}</span>${l.derive_liee ? `<div class="meta">${nombre(l.resultats_exposes)} résultats pendant une dérive</div>` : ''}</td>
        <td>${esc(l.valide_par || '—')}</td></tr>`).join('') || '<tr><td colspan="8" class="empty">Aucun lot.</td></tr>'}
    </tbody></table></div>`;
    document.getElementById('pagination-reseau').innerHTML = pages > 1
      ? `<button type="button" class="secondary" data-p="${etat.lotsPage - 1}" ${etat.lotsPage <= 1 ? 'disabled' : ''}>Précédent</button>
         <span>Page ${etat.lotsPage} / ${pages}</span>
         <button type="button" class="secondary" data-p="${etat.lotsPage + 1}" ${etat.lotsPage >= pages ? 'disabled' : ''}>Suivant</button>` : '';
  }

  // ---------- 8. Données ----------
  async function dessinerDonnees() {
    const d = await api('/reseau/dictionnaire');
    const LIB = { 'réel': 'ok', 'référentiel': 'a-revalider', 'simulé': 'a-valider' };
    document.getElementById('sources').innerHTML = `<table class="table-audit"><thead><tr><th>Donnée</th><th>Origine</th><th>Nature</th></tr></thead><tbody>
      ${d.sources.map((s) => `<tr><td>${esc(s.libelle)}</td><td>${esc(s.origine)}</td><td><span class="badge ${LIB[s.type]}">${esc(s.type)}</span></td></tr>`).join('')}
    </tbody></table>
    <p class="hint" style="margin-top:10px">Pourquoi simuler ? Les vraies valeurs de contrôle qualité d’un laboratoire ne sont pas publiques, et les résultats patients sont protégés (RGPD, secret médical). La simulation est donc <b>calée sur les volumes réels</b> et suit les lois statistiques des contrôles qualité (loi normale, règles de Westgard), avec une graine fixe : chaque lancement donne les mêmes chiffres.</p>`;
    const COMPTES = { sites: etat.sites.length, analytes: Object.keys(etat.analytes).length, analyseurs: etat.resume.analyseurs, qc: etat.resume.controles_qc, derives: etat.resume.derives, activite: null, eeq: etat.resume.eeq_resultats, lots: etat.resume.lots.total };
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
      const ordre = ['HB', 'CREA', 'K', 'ALAT', 'CRP', 'CHOL', 'TSH', 'FERR', 'HBA1C'];
      etat.analytes = Object.fromEntries(ordre.filter((c) => etat.analytes[c]).map((c) => [c, etat.analytes[c]]));
      dessinerEnsemble();
      const h = location.hash.slice(1);
      ouvrir(h && document.querySelector(`[data-panneau="${h}"]`) ? h : 'ensemble');
    } catch (err) {
      erreur(err);
    }
  })();
})();
