// app.js - fonctions partagees par toutes les pages

async function api(chemin, options = {}) {
  let reponse;
  try {
    reponse = await fetch(`/api${chemin}`, {
      headers: { 'Content-Type': 'application/json' },
      ...options
    });
  } catch {
    throw new Error("Impossible de joindre le serveur. Vérifiez qu'il est bien lancé.");
  }
  const type = reponse.headers.get('content-type') || '';
  if (!type.includes('application/json')) {
    if (!reponse.ok) throw new Error('Une erreur est survenue.');
    return reponse;
  }
  const data = await reponse.json().catch(() => ({}));
  if (!reponse.ok) throw new Error(data.erreur || 'Une erreur est survenue.');
  return data;
}

function formatDate(chaineISO) {
  if (!chaineISO) return 'non renseignée';
  const d = new Date(chaineISO);
  if (isNaN(d)) return chaineISO;
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatDateHeure(chaineISO) {
  if (!chaineISO) return '-';
  const d = new Date(chaineISO.includes(' ') ? chaineISO.replace(' ', 'T') : chaineISO);
  if (isNaN(d)) return chaineISO;
  return d.toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function refLot(id) {
  return 'L-' + String(id).padStart(3, '0');
}

function echap(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function afficherMessage(id, texte, type = 'erreur') {
  const el = document.getElementById(id);
  if (!el) {
    if (texte) alert(texte);
    return;
  }
  el.textContent = texte || '';
  el.className = type === 'ok' ? 'message ok' : 'message erreur';
  el.hidden = !texte;
}

async function lireFichierTexte(input) {
  const fichier = input?.files?.[0];
  if (!fichier) return '';
  return fichier.text();
}

function roleActuel() {
  return localStorage.getItem('roleLabo') || 'technicien';
}

function appliquerRole() {
  const role = roleActuel();
  document.body.dataset.role = role;
  document.querySelectorAll('[data-role-option]').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.roleOption === role);
  });
}

function themeActuel() {
  return localStorage.getItem('themeLabo') || 'sombre';
}

function appliquerTheme() {
  const theme = themeActuel();
  document.documentElement.dataset.theme = theme;
  const btn = document.getElementById('btn-theme');
  if (btn) btn.textContent = theme === 'sombre' ? 'Thème clair' : 'Thème sombre';
}

function classeBadge(code) {
  if (code === 'ok') return 'ok';
  if (code === 'a_valider' || code === 'a_revalider') return 'attente';
  return 'douteux';
}

function aide(texte) {
  return `<span class="aide" tabindex="0" aria-label="Aide">?<span class="aide-bulle">${echap(texte)}</span></span>`;
}

function icone(nom) {
  const svg = {
    machine: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="7" width="18" height="12" rx="1"/><path d="M7 7V5h10v2M8 11h2m4 0h2"/></svg>',
    date: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="5" width="16" height="15" rx="1"/><path d="M8 3v4M16 3v4M4 10h16"/></svg>',
    biologiste: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3"/><path d="M5 20c1.5-4 12.5-4 14 0"/></svg>',
    lot: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7l8-3 8 3v10l-8 3-8-3z"/><path d="M12 4v16M4 7l8 3 8-3"/></svg>',
    regle: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5h14v4H5zM5 11h10v4H5zM5 17h7v2H5z"/></svg>',
    alerte: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l9 16H3z"/><path d="M12 10v4m0 2v1"/></svg>'
  };
  return `<span class="icone">${svg[nom] || ''}</span>`;
}

function htmlJauge(score, libelle = 'Score de confiance', detail) {
  const n = Number(score) || 0;
  const c = 2 * Math.PI * 42;
  const offset = c - (n / 100) * c;
  const classe = n >= 80 ? 'ok' : n >= 50 ? 'moyen' : 'faible';
  const lignes = Array.isArray(detail) ? `<details class="score-detail"><summary>Voir le calcul</summary><ul>${
    detail.map((l) => `<li>${l.ok ? '✓' : '✗'} ${echap(l.label)} <strong>${l.points}/${l.max}</strong></li>`).join('')
  }</ul></details>` : '';
  return `
    <div class="jauge-bloc">
      <svg class="jauge ${classe}" viewBox="0 0 120 120" aria-label="${echap(libelle)} ${n} sur 100">
        <circle class="jauge-fond" cx="60" cy="60" r="42"></circle>
        <circle class="jauge-arc" cx="60" cy="60" r="42"
          stroke-dasharray="${c.toFixed(2)}" stroke-dashoffset="${offset.toFixed(2)}"></circle>
        <text x="60" y="58" text-anchor="middle">${n}</text>
        <text x="60" y="74" text-anchor="middle" class="jauge-sous">/ 100</text>
      </svg>
      <div>
        <p>${echap(libelle)}</p>
        ${lignes}
      </div>
    </div>`;
}

function libelleSeuils(regle) {
  if (!regle) return 'non définie';
  const u = regle.unite ? ` ${regle.unite}` : '';
  const vide = (v) => v === null || v === undefined || String(v).trim() === '';
  const bas = vide(regle.seuil_bas) ? null : String(regle.seuil_bas);
  const haut = vide(regle.seuil_haut) ? null : String(regle.seuil_haut);
  if (bas && haut) return `${bas} – ${haut}${u}`;
  if (bas) return `≥ ${bas}${u}`;
  if (haut) return `≤ ${haut}${u}`;
  return `seuils non définis${u}`;
}

const PATTERNS_39 = {
  '0': 'nnnwwnwnn', '1': 'wnnwnnnnw', '2': 'nnwwnnnnw', '3': 'wnwwnnnnn',
  '4': 'nnnwnnwnw', '5': 'wnnwnnwnn',   '6': 'nnwwnnwnn', '7': 'nnnwwnnwn', '8': 'wnnwwnnnn', '9': 'nnwwwnnnn', 'A': 'wnnnnwnnw', 'B': 'nnwnnwnnw',
  'C': 'wnwnnwnnn', 'D': 'nnnnwwnnw', 'E': 'wnnnwwnnn', 'F': 'nnwnwwnnn',
  'G': 'nnnnnwwnw', 'H': 'wnnnnwwnn', 'I': 'nnwnnwwnn', 'J': 'nnnnwwwnn',
  'K': 'wnnnnnnww', 'L': 'nnwnnnnww', 'M': 'wnwnnnnwn', 'N': 'nnnnwnnww',
  'O': 'wnnnwnnwn', 'P': 'nnwnwnnwn', 'Q': 'nnnnnnwww', 'R': 'wnnnnnwwn',
  'S': 'nnwnnnwwn', 'T': 'nnnnwnwwn', 'U': 'wwnnnnnnw', 'V': 'nwwnnnnnw',
  'W': 'wwwnnnnnn', 'X': 'nwnnwnnnw', 'Y': 'wwnnwnnnn', 'Z': 'nwwnwnnnn',
  '-': 'nwnnnnwnw', '.': 'wwnnnnwnn', ' ': 'nwwnnnwnn', '*': 'nwnnwnnwn'
};

function svgCode39(texte) {
  const payload = `*${String(texte).toUpperCase().replace(/[^A-Z0-9\-. ]/g, '')}*`;
  let x = 0;
  const barres = [];
  for (const car of payload) {
    const motif = PATTERNS_39[car];
    if (!motif) continue;
    for (let i = 0; i < motif.length; i++) {
      const large = motif[i] === 'w';
      const w = large ? 3 : 1;
      if (i % 2 === 0) barres.push(`<rect x="${x}" y="0" width="${w}" height="40"/>`);
      x += w;
    }
    x += 1;
  }
  return `<svg class="code39" viewBox="0 0 ${x} 40" role="img" aria-label="Code-barres ${echap(texte)}">${barres.join('')}</svg>`;
}

function htmlChaineTracabilite(lot) {
  const origine = lot.conditions || lot.machine_nom || 'non renseignée';
  const machine = lot.machine_nom || 'non renseignée';
  const anon = Number(lot.anonymise) && !Number(lot.alerte_identite) ? 'Confirmée' : (Number(lot.anonymise) ? 'À vérifier' : 'En attente');
  const val = lot.validations?.[0];
  const valTxt = val ? echap(val.nom_biologiste) : 'En attente';
  return `
    <div class="chaine" aria-label="Parcours des données">
      <div class="chaine-box"><strong>Origine</strong><span>${echap(origine)}</span></div>
      <div class="chaine-box"><strong>Machine</strong><span>${echap(machine)}</span></div>
      <div class="chaine-box ${Number(lot.anonymise) ? '' : 'attente'}"><strong>Pseudonymisation</strong><span>${echap(anon)}</span></div>
      <div class="chaine-box ${val ? '' : 'attente'}"><strong>Validation</strong><span>${valTxt}</span></div>
    </div>`;
}

function htmlCarteControle(serie) {
  const pts = serie.points || [];
  if (!pts.length) return '<p class="empty">Pas assez de points de contrôle pour tracer une carte.</p>';
  const w = 760, h = 320, pad = { l: 56, r: 20, t: 24, b: 64 };
  const ys = pts.map((p) => p.moyenne_controle);
  const lims = [serie.limite_2s_bas, serie.limite_2s_haut, serie.moyenne, ...ys].filter((n) => n != null && !Number.isNaN(n));
  let ymin = Math.min(...lims), ymax = Math.max(...lims);
  const span = ymax - ymin || 1;
  ymin -= span * 0.12;
  ymax += span * 0.12;
  const innerW = w - pad.l - pad.r;
  const innerH = h - pad.t - pad.b;
  const x = (i) => pad.l + (pts.length === 1 ? innerW / 2 : (i / (pts.length - 1)) * innerW);
  const y = (v) => pad.t + (1 - (v - ymin) / (ymax - ymin)) * innerH;
  const ligne = (v, dash, color) => {
    if (v == null) return '';
    return `<line x1="${pad.l}" y1="${y(v)}" x2="${w - pad.r}" y2="${y(v)}" stroke="${color}" stroke-dasharray="${dash}" />`;
  };
  const path = pts.map((p, i) => `${i ? 'L' : 'M'}${x(i)},${y(p.moyenne_controle)}`).join(' ');
  const cercles = pts.map((p, i) => {
    const c = p.hors_norme ? 'var(--flag)' : 'var(--accent)';
    return `<circle class="point-controle" data-lot-id="${p.id}" cx="${x(i)}" cy="${y(p.moyenne_controle)}" r="${p.hors_norme ? 8 : 6}" fill="${c}" stroke="#fff" stroke-width="1.5" style="cursor:pointer"></circle>`;
  }).join('');
  const labels = pts.map((p, i) => {
    const d = formatDate(p.date);
    return `<text x="${x(i)}" y="${h - 18}" text-anchor="end" font-size="10" fill="currentColor" transform="rotate(-35 ${x(i)} ${h - 18})">${echap(d)}</text>`;
  }).join('');
  const yTicks = [ymin, (ymin + ymax) / 2, ymax].map((v) =>
    `<text x="${pad.l - 8}" y="${y(v) + 4}" text-anchor="end" font-size="10" fill="currentColor">${v.toFixed(2)}</text>`
  ).join('');
  const hors = pts.filter((p) => p.hors_norme);
  const listeHors = hors.length
    ? `<p class="hint">Points hors ±2σ (en rouge) — lots de référence, jamais un patient :</p>
       <ul class="urgence">${hors.map((p) => `<li><a href="lot.html?id=${Number(p.id)}">${echap(p.nom)} — ${formatDate(p.date)}</a></li>`).join('')}</ul>`
    : '<p class="hint">Aucun point hors ±2σ sur cette série. Les points violets sont dans la zone habituelle.</p>';
  return `
    <svg class="carte-svg" viewBox="0 0 ${w} ${h}" role="img" aria-label="Carte de contrôle Levey-Jennings">
      ${ligne(serie.moyenne, '0', 'var(--ink-soft)')}
      ${ligne(serie.limite_2s_haut, '4 4', 'var(--flag)')}
      ${ligne(serie.limite_2s_bas, '4 4', 'var(--flag)')}
      <path d="${path}" fill="none" stroke="var(--accent)" stroke-width="1.6"/>
      ${cercles}
      ${labels}
      ${yTicks}
    </svg>
    ${listeHors}`;
}

function installerRole() {
  const nav = document.querySelector('.sidebar nav');
  if (!nav || document.querySelector('.role-switch')) return;
  const barre = document.createElement('div');
  barre.className = 'role-switch';
  barre.innerHTML = `
    <p>Rôle (démo)</p>
    <button type="button" data-role-option="technicien">Technicien</button>
    <button type="button" data-role-option="biologiste">Biologiste</button>
  `;
  nav.after(barre);
  barre.querySelectorAll('[data-role-option]').forEach((btn) => {
    btn.addEventListener('click', () => {
      localStorage.setItem('roleLabo', btn.dataset.roleOption);
      appliquerRole();
    });
  });
  appliquerRole();
}

function installerTheme() {
  if (document.getElementById('btn-theme')) return;
  const aside = document.querySelector('.sidebar');
  if (!aside) return;
  const btn = document.createElement('button');
  btn.id = 'btn-theme';
  btn.type = 'button';
  btn.className = 'theme-btn';
  btn.addEventListener('click', () => {
    localStorage.setItem('themeLabo', themeActuel() === 'sombre' ? 'clair' : 'sombre');
    appliquerTheme();
  });
  aside.appendChild(btn);
  appliquerTheme();
}

function installerRecherche() {
  if (document.getElementById('recherche-globale')) return;
  const aside = document.querySelector('.sidebar');
  if (!aside) return;
  const bloc = document.createElement('div');
  bloc.className = 'recherche-globale';
  bloc.innerHTML = `
    <label for="recherche-globale">Recherche</label>
    <input type="search" id="recherche-globale" placeholder="Lots, machines, signalements">
    <div id="recherche-resultats" class="recherche-resultats" hidden></div>
  `;
  aside.appendChild(bloc);
  const input = document.getElementById('recherche-globale');
  const box = document.getElementById('recherche-resultats');
  let timer;
  input.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(async () => {
      const q = input.value.trim();
      if (q.length < 2) {
        box.hidden = true;
        box.innerHTML = '';
        return;
      }
      try {
        const r = await api(`/recherche?q=${encodeURIComponent(q)}`);
        const lignes = [];
        r.lots.forEach((l) => lignes.push(`<a href="lot.html?id=${l.id}">Lot · ${echap(l.nom)}</a>`));
        r.machines.forEach((m) => lignes.push(`<a href="machines.html">${echap(m.nom)}</a>`));
        r.signalements.forEach((s) => lignes.push(`<a href="lot.html?id=${s.lot_id}&edit=1">Signalement · ${echap(s.lot_nom)}</a>`));
        box.innerHTML = lignes.length ? lignes.join('') : '<p class="empty">Aucun résultat.</p>';
        box.hidden = false;
      } catch (err) {
        box.innerHTML = `<p class="empty">${echap(err.message)}</p>`;
        box.hidden = false;
      }
    }, 200);
  });
}

function installerNav() {
  const brand = document.querySelector('.sidebar .brand');
  if (brand) brand.innerHTML = '<span class="logo-mark"></span> TraceLab';
  const nav = document.querySelector('.sidebar nav');
  if (!nav) return;
  const page = (location.pathname.split('/').pop() || 'accueil.html').replace(/^$/, 'accueil.html');
  const liens = [
    ['accueil.html', 'Tableau de bord'],
    ['index.html', 'Lots'],
    ['machines.html', 'Machines'],
    ['signalements.html', 'Signalements'],
    ['controle.html', 'Cartes de contrôle'],
    ['lignee.html', 'Lignée'],
    ['synthese.html', 'Synthèse'],
    ['conformite.html', 'Conformité']
  ];
  nav.innerHTML = liens.map(([href, label]) => {
    const active = page === href || (page === '' && href === 'accueil.html') || (page === 'lot.html' && href === 'index.html') || (page === 'certificat.html' && href === 'index.html') || (page === 'nouveau-lot.html' && href === 'index.html');
    return `<a href="${href}" class="${active ? 'active' : ''}">${label}</a>`;
  }).join('');
}

function installerChrome() {
  installerNav();
  installerRole();
  installerRecherche();
  installerTheme();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', installerChrome);
} else {
  installerChrome();
}
