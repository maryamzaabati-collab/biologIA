/* graphiques.js — petits graphiques SVG faits maison (aucune librairie externe :
   la politique de sécurité du site interdit les scripts venant d'ailleurs). */
(function () {
  const NS = 'http://www.w3.org/2000/svg';

  function couleur(nom) {
    return getComputedStyle(document.documentElement).getPropertyValue(nom).trim() || '#0B5268';
  }
  function nombre(n, dec = 0) {
    const v = Number(n || 0);
    const p = 10 ** dec;
    return (Math.round(v * p) / p === 0 ? 0 : v).toLocaleString('fr-FR', { minimumFractionDigits: dec, maximumFractionDigits: dec });
  }
  function compact(n) {
    const v = Number(n || 0);
    if (Math.abs(v) >= 1e6) return `${nombre(v / 1e6, Math.abs(v) >= 1e7 ? 0 : 1).replace(/,0$/, '')} M`;
    if (Math.abs(v) >= 1e4) return `${nombre(v / 1e3, 0)} k`;
    return nombre(v);
  }
  function moisCourt(m) {
    const [a, mm] = String(m).split('-');
    const noms = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
    return `${noms[Number(mm) - 1] || mm}${a && a !== '2026' ? ' ' + a : ''}`;
  }
  function jourCourt(d) {
    const [, m, j] = String(d).split('-');
    return `${j}/${m}`;
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  // Courbe simple (une ou plusieurs séries) avec axe des mois.
  function ligne(el, { etiquettes, series, hauteur = 220, format = compact }) {
    const L = el.clientWidth || 640;
    const H = hauteur;
    const m = { g: 52, d: 16, h: 14, b: 30 };
    const toutes = series.flatMap((s) => s.valeurs);
    const max = Math.max(...toutes) * 1.08;
    const min = Math.min(0, Math.min(...toutes));
    const x = (i) => m.g + (i * (L - m.g - m.d)) / Math.max(1, etiquettes.length - 1);
    const y = (v) => m.h + (1 - (v - min) / (max - min || 1)) * (H - m.h - m.b);
    const grilles = [0, 0.25, 0.5, 0.75, 1].map((t) => {
      const v = min + t * (max - min);
      return `<line x1="${m.g}" x2="${L - m.d}" y1="${y(v)}" y2="${y(v)}" class="g-grille"/><text x="${m.g - 8}" y="${y(v) + 4}" class="g-axe" text-anchor="end">${format(v)}</text>`;
    }).join('');
    const pasEt = Math.max(1, Math.ceil(etiquettes.length / Math.max(4, Math.floor((L - m.g) / 70))));
    const ax = etiquettes.map((e, i) => (i % pasEt === 0 ? `<text x="${x(i)}" y="${H - 8}" class="g-axe" text-anchor="middle">${esc(e)}</text>` : '')).join('');
    const traces = series.map((s) => {
      const pts = s.valeurs.map((v, i) => `${x(i)},${y(v)}`).join(' ');
      const aire = `${m.g},${y(min)} ${pts} ${x(s.valeurs.length - 1)},${y(min)}`;
      return `${s.aire ? `<polygon points="${aire}" fill="${s.couleur}" opacity="0.10"/>` : ''}
        <polyline points="${pts}" fill="none" stroke="${s.couleur}" stroke-width="2.2" stroke-linejoin="round"/>
        ${s.valeurs.map((v, i) => `<circle cx="${x(i)}" cy="${y(v)}" r="3.2" fill="${s.couleur}"><title>${esc(etiquettes[i])} : ${nombre(v)}</title></circle>`).join('')}`;
    }).join('');
    el.innerHTML = `<svg viewBox="0 0 ${L} ${H}" class="g-svg" role="img">${grilles}${ax}${traces}</svg>`;
  }

  // Barres horizontales. lignes = [{ libelle, valeur, valeur2?, couleur?, lien? }]
  function barres(el, { lignes, format = compact, legende, max }) {
    const M = max || Math.max(...lignes.map((l) => Math.max(l.valeur, l.valeur2 || 0))) || 1;
    el.innerHTML = `${legende ? `<div class="g-legende">${legende}</div>` : ''}<div class="g-barres">${lignes.map((l) => `
      <div class="g-barre-ligne"${l.titre ? ` title="${esc(l.titre)}"` : ''}>
        <span class="g-barre-lib">${l.lien ? `<a href="${l.lien}">${esc(l.libelle)}</a>` : esc(l.libelle)}</span>
        <span class="g-barre-piste">
          <i style="width:${(100 * l.valeur / M).toFixed(1)}%;background:${l.couleur || 'var(--accent)'}"></i>
          ${l.valeur2 != null ? `<i class="g-barre-2" style="width:${(100 * l.valeur2 / M).toFixed(1)}%"></i>` : ''}
        </span>
        <span class="g-barre-val">${l.texte != null ? l.texte : format(l.valeur)}</span>
      </div>`).join('')}</div>`;
  }

  // Carte de Levey-Jennings : points de contrôle autour de la cible, bandes ±1/2/3 écarts-types.
  function leveyJennings(el, { points, derive, hauteur = 280 }) {
    const L = el.clientWidth || 720;
    const H = hauteur;
    const m = { g: 40, d: 14, h: 12, b: 28 };
    const dates = [...new Set(points.map((p) => p.date))];
    const idx = Object.fromEntries(dates.map((d, i) => [d, i]));
    const x = (d) => m.g + (idx[d] * (L - m.g - m.d)) / Math.max(1, dates.length - 1);
    const lim = 4.2;
    const y = (z) => m.h + (1 - (Math.max(-lim, Math.min(lim, z)) + lim) / (2 * lim)) * (H - m.h - m.b);
    const ok = couleur('--ok');
    const flag = couleur('--flag');
    const wait = couleur('--wait');
    const reval = couleur('--reval');
    let zone = '';
    if (derive && idx[derive.debut] != null) {
      const fin = derive.correction && idx[derive.correction] != null ? derive.correction : dates[dates.length - 1];
      const x1 = x(derive.debut);
      const x2 = Math.max(x1 + 4, x(fin));
      zone = `<rect x="${x1}" y="${m.h}" width="${x2 - x1}" height="${H - m.h - m.b}" fill="${flag}" opacity="0.10"/>
        <text x="${x1 + 4}" y="${m.h + 12}" class="g-axe" fill="${flag}">panne</text>`;
      if (derive.detection && idx[derive.detection] != null) {
        zone += `<line x1="${x(derive.detection)}" x2="${x(derive.detection)}" y1="${m.h}" y2="${H - m.b}" stroke="${flag}" stroke-dasharray="4 3"/>`;
      }
      if (derive.revue_mensuelle) {
        const proche = dates.find((d) => d >= derive.revue_mensuelle) || dates[dates.length - 1];
        zone += `<line x1="${x(proche)}" x2="${x(proche)}" y1="${m.h}" y2="${H - m.b}" stroke="${reval}" stroke-dasharray="2 4"/>
          <text x="${x(proche) - 4}" y="${H - m.b - 6}" class="g-axe" text-anchor="end" fill="${reval}">fin du mois</text>`;
      }
    }
    const bandes = [3, 2, 1, 0, -1, -2, -3].map((k) => `<line x1="${m.g}" x2="${L - m.d}" y1="${y(k)}" y2="${y(k)}"
      stroke="${k === 0 ? ok : Math.abs(k) === 3 ? flag : Math.abs(k) === 2 ? wait : couleur('--ink-soft')}"
      stroke-width="${k === 0 ? 1.4 : 1}" ${Math.abs(k) >= 2 ? 'stroke-dasharray="5 4"' : ''} opacity="${k === 0 ? 0.8 : 0.7}"/>
      <text x="${m.g - 6}" y="${y(k) + 4}" class="g-axe" text-anchor="end">${k === 0 ? 'cible' : (k > 0 ? '+' : '') + k + 's'}</text>`).join('');
    const pas = Math.max(1, Math.floor(dates.length / 8));
    const ax = dates.filter((d, i) => i % pas === 0).map((d) => `<text x="${x(d)}" y="${H - 8}" class="g-axe" text-anchor="middle">${jourCourt(d)}</text>`).join('');
    const parNiveau = ['N1', 'N2'].map((n) => points.filter((p) => p.niveau === n));
    const traits = parNiveau.map((serie, k) => `<polyline points="${serie.map((p) => `${x(p.date)},${y(p.z)}`).join(' ')}" fill="none"
      stroke="${k === 0 ? ok : reval}" stroke-width="1" opacity="0.55"/>`).join('');
    const pts = points.map((p) => {
      const c = p.rejet ? flag : p.regle === '1-2s' ? wait : (p.niveau === 'N1' ? ok : reval);
      const r = p.rejet ? 4.2 : 2.6;
      return `<circle cx="${x(p.date)}" cy="${y(p.z)}" r="${r}" fill="${c}"><title>${jourCourt(p.date)} · ${p.niveau} : ${p.valeur} (z = ${nombre(p.z, 2)})${p.regle ? ' · règle ' + p.regle : ''}</title></circle>`;
    }).join('');
    el.innerHTML = `<svg viewBox="0 0 ${L} ${H}" class="g-svg" role="img">${zone}${bandes}${ax}${traits}${pts}</svg>
      <div class="g-legende"><span><i style="background:${ok}"></i>Contrôle bas</span><span><i style="background:${reval}"></i>Contrôle haut</span>
      <span><i style="background:${wait}"></i>À surveiller</span><span><i style="background:${flag}"></i>Alerte</span></div>`;
  }

  // Histogramme : classes = [{ de, a, n }], avec les valeurs usuelles (bas / haut) en couleur.
  function histogramme(el, { classes, bas, haut, unite, hauteur = 220 }) {
    const L = el.clientWidth || 640;
    const H = hauteur;
    const m = { g: 44, d: 10, h: 14, b: 34 };
    const max = Math.max(...classes.map((c) => c.n)) || 1;
    const lb = (L - m.g - m.d) / classes.length;
    const y = (v) => m.h + (1 - v / max) * (H - m.h - m.b);
    const ok = couleur('--ok');
    const flag = couleur('--flag');
    const wait = couleur('--wait');
    const barres = classes.map((c, i) => {
      const milieu = (c.de + c.a) / 2;
      const col = haut != null && milieu > haut ? flag : bas != null && milieu < bas ? wait : ok;
      return `<rect x="${m.g + i * lb + 1}" y="${y(c.n)}" width="${Math.max(1, lb - 2)}" height="${H - m.b - y(c.n)}" fill="${col}" rx="2"><title>${nombre(c.de, 2)} à ${nombre(c.a, 2)} ${esc(unite || '')} : ${nombre(c.n)} résultats</title></rect>`;
    }).join('');
    const pasAx = Math.max(1, Math.floor(classes.length / 6));
    const ax = classes.filter((c, i) => i % pasAx === 0).map((c) => {
      const i = classes.indexOf(c);
      return `<text x="${m.g + i * lb}" y="${H - 14}" class="g-axe" text-anchor="middle">${nombre(c.de, c.de < 10 ? 1 : 0)}</text>`;
    }).join('');
    const xv = (v) => {
      const d = classes[0].de;
      const f = classes[classes.length - 1].a;
      return m.g + ((v - d) / (f - d || 1)) * (L - m.g - m.d);
    };
    const lignes = [[bas, 'bas'], [haut, 'haut']].filter(([v]) => v != null && v > classes[0].de && v < classes[classes.length - 1].a)
      .map(([v, nom]) => `<line x1="${xv(v)}" x2="${xv(v)}" y1="${m.h}" y2="${H - m.b}" stroke="${couleur('--ink')}" stroke-dasharray="4 3"/>
        <text x="${xv(v) + 4}" y="${m.h + 10}" class="g-axe">limite ${nom} : ${nombre(v, v < 10 ? 1 : 0)}</text>`).join('');
    el.innerHTML = `<svg viewBox="0 0 ${L} ${H}" class="g-svg" role="img">
      <line x1="${m.g}" x2="${L - m.d}" y1="${H - m.b}" y2="${H - m.b}" class="g-grille"/>${barres}${lignes}${ax}
      <text x="${L - m.d}" y="${H - 1}" class="g-axe" text-anchor="end">${esc(unite || '')}</text></svg>`;
  }

  // Couleur d'une case selon une valeur et des seuils.
  function couleurSigma(s) {
    if (s == null) return 'transparent';
    if (s >= 6) return 'var(--ok)';
    if (s >= 5) return 'color-mix(in srgb, var(--ok) 70%, var(--panel))';
    if (s >= 4) return 'color-mix(in srgb, var(--wait) 55%, var(--panel))';
    if (s >= 3) return 'color-mix(in srgb, var(--wait) 90%, var(--panel))';
    return 'var(--flag)';
  }
  function couleurZ(z) {
    const a = Math.abs(z);
    if (a > 3) return 'var(--flag)';
    if (a > 2) return 'color-mix(in srgb, var(--flag) 65%, var(--panel))';
    if (a > 1) return 'color-mix(in srgb, var(--wait) 55%, var(--panel))';
    return 'color-mix(in srgb, var(--ok) 35%, var(--panel))';
  }

  window.G = { ligne, barres, histogramme, leveyJennings, couleur, couleurSigma, couleurZ, nombre, compact, moisCourt, jourCourt, esc };
})();
