/* Complements charges apres app.js : session reelle + cartes de controle cliquables. */

(function () {
  api = async function (chemin, options = {}) {
    let reponse;
    try {
      reponse = await fetch(`/api${chemin}`, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        ...options
      });
    } catch {
      throw new Error("Impossible de joindre le serveur. Vérifiez qu'il est bien lancé.");
    }
    const type = reponse.headers.get('content-type') || '';
    if (!type.includes('application/json')) {
      if (!reponse.ok) throw new Error(messageDepuisReponse(reponse));
      return reponse;
    }
    const data = await reponse.json().catch(() => ({}));
    const pageConnexion = location.pathname.endsWith('connexion.html') || location.pathname === '/';
    if (reponse.status === 401 && !pageConnexion) {
      window.location.href = 'connexion.html';
      throw new Error(messageDepuisReponse(reponse, data));
    }
    if (!reponse.ok) throw new Error(messageDepuisReponse(reponse, data));
    return data;
  };

  roleActuel = function () {
    return window.__utilisateur?.role || document.body.dataset.role || '';
  };

  const dessinerCarte = htmlCarteControle;
  function htmlUneCarte(serie) {
    const titre = serie.machine_nom
      ? `<h2>${echap(serie.machine_nom)}${serie.parametre ? ' — ' + echap(serie.parametre) : ''}${serie.nom ? ' · ' + echap(serie.nom) : ''}</h2>`
      : '';
    if (serie.suffisant === false) {
      return titre + '<p class="empty">Pas assez de données pour calculer les limites</p>'
        + `<p class="hint">${serie.nb_points || 0} valeur(s) CSV — minimum 20 pour un seul analyte.</p>`;
    }
    const note = serie.nb_reference
      ? `<p class="hint">Moyenne et écart-type calculés sur ${serie.nb_reference} valeurs du CSV importé (un seul analyte).</p>`
      : '';
    return titre + note + dessinerCarte(serie);
  }

  htmlCarteControle = function (serie) {
    if (Array.isArray(serie.series)) {
      if (!serie.series.length) return '<p class="empty">Pas assez de données pour calculer les limites</p>';
      return serie.series.map((s) => htmlUneCarte(s)).join('');
    }
    return htmlUneCarte(serie);
  };

  document.addEventListener('click', (e) => {
    const el = e.target.closest && e.target.closest('[data-lot-id]');
    if (!el) return;
    e.preventDefault();
    const id = Number(el.dataset.lotId);
    if (id) window.location.assign('lot.html?id=' + id);
  });

  const ICONES = {
    accueil: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 11.5 12 4l9 7.5"/><path d="M5 10.5V20h14v-9.5"/></svg>',
    lots: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7l8-3 8 3v10l-8 3-8-3z"/><path d="M12 4v16"/></svg>',
    machines: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="7" width="18" height="12" rx="2"/><path d="M7 7V5h10v2"/></svg>',
    signalements: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3l9 16H3z"/><path d="M12 10v4m0 3v.5"/></svg>',
    controle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 16l5-5 4 4 7-8"/><path d="M4 20h16"/></svg>',
    lignee: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="6" cy="6" r="2.5"/><circle cx="18" cy="12" r="2.5"/><circle cx="6" cy="18" r="2.5"/><path d="M8.5 7.5 15.5 11M8.5 16.5 15.5 13"/></svg>',
    synthese: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19V5h12l4 4v10z"/><path d="M16 5v4h4"/></svg>',
    conformite: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3 20 7v6c0 5-3.5 7.5-8 9-4.5-1.5-8-4-8-9V7z"/><path d="m9 12 2 2 4-4"/></svg>',
    comptes: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="3"/><path d="M5 20c1.5-4 12.5-4 14 0"/></svg>',
    journal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 4h11v16H8z"/><path d="M5 4h3v16H5z"/></svg>',
    patients: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="8" r="3"/><path d="M3 20c1-4 11-4 12 0"/><circle cx="17" cy="9" r="2.5"/><path d="M21 20c-.6-3-5-3.5-7-2"/></svg>'
  };

  function lienNav(href, label, icon, page) {
    const active = page === href
      || (page === 'lot.html' && href === 'index.html')
      || (page === 'certificat.html' && href === 'index.html')
      || (page === 'nouveau-lot.html' && href === 'index.html');
    return `<a href="${href}" class="${active ? 'active' : ''}">${ICONES[icon] || ''}<span>${label}</span></a>`;
  }

  function remplirNav(role) {
    const brand = document.querySelector('.sidebar .brand');
    if (brand) brand.innerHTML = '<span class="logo-mark"></span> biologIA';
    const nav = document.querySelector('.sidebar nav');
    if (!nav) return;
    const page = (location.pathname.split('/').pop() || 'accueil.html').replace(/^$/, 'accueil.html');
    const admin = role === 'biologiste'
      ? `<p class="nav-section">Admin</p>
         ${lienNav('comptes.html', 'Comptes', 'comptes', page)}
         ${lienNav('journal.html', 'Journal', 'journal', page)}`
      : '';
    nav.innerHTML = `
      <p class="nav-section">Suivi</p>
      ${lienNav('accueil.html', 'Tableau de bord', 'accueil', page)}
      ${lienNav('index.html', 'Lots', 'lots', page)}
      ${lienNav('machines.html', 'Machines', 'machines', page)}
      ${lienNav('signalements.html', 'Signalements', 'signalements', page)}
      ${lienNav('controle.html', 'Cartes de contrôle', 'controle', page)}
      <p class="nav-section">Traçabilité</p>
      ${lienNav('lignee.html', 'Lignée', 'lignee', page)}
      ${role === 'client' ? '' : `${lienNav('patients.html', 'Patients', 'patients', page)}
      ${lienNav('identifiants.html', 'Identifiants', 'patients', page)}`}
      ${lienNav('synthese.html', 'Synthèse', 'synthese', page)}
      ${lienNav('conformite.html', 'Conformité', 'conformite', page)}
      ${admin}
    `;
  }

  function initiales(nom) {
    return String(nom || '?')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0].toUpperCase())
      .join('') || '?';
  }

  function installerTopbar() {
    const main = document.querySelector('.layout > main');
    if (!main || document.getElementById('topbar')) return;
    const bar = document.createElement('div');
    bar.id = 'topbar';
    bar.className = 'topbar';
    bar.innerHTML = `
      <div class="recherche-globale">
        <input type="search" id="recherche-globale" placeholder="Rechercher lots, machines, signalements" autocomplete="off">
        <div id="recherche-resultats" class="recherche-resultats" hidden></div>
      </div>
      <button type="button" id="btn-theme" class="theme-btn" aria-label="Changer de thème"></button>
    `;
    main.prepend(bar);
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
          r.machines.forEach((m) => lignes.push(`<a href="machines.html">Machine · ${echap(m.nom)}</a>`));
          r.signalements.forEach((s) => lignes.push(`<a href="lot.html?id=${s.lot_id}&edit=1">Signalement · ${echap(s.lot_nom)}</a>`));
          const groupes = [];
          if (r.lots.length) groupes.push(`<p class="hint">Lots</p>`);
          box.innerHTML = lignes.length
            ? `<p class="hint">${r.lots.length} lot(s) · ${r.machines.length} machine(s) · ${r.signalements.length} signalement(s)</p>${lignes.join('')}`
            : '<p class="empty">Aucun résultat.</p>';
          box.hidden = false;
        } catch (err) {
          box.innerHTML = `<p class="empty">${echap(err.message)}</p>`;
          box.hidden = false;
        }
      }, 200);
    });
    document.getElementById('btn-theme').addEventListener('click', () => {
      localStorage.setItem('themeLabo', themeActuel() === 'sombre' ? 'clair' : 'sombre');
      appliquerTheme();
    });
    appliquerTheme();
  }

  async function installerSession() {
    if (location.pathname.endsWith('connexion.html') || location.pathname === '/') return;
    installerTopbar();
    document.querySelectorAll('.role-switch').forEach((el) => {
      if (el.id !== 'bloc-session') el.remove();
    });
    if (!document.getElementById('css-roles')) {
      const s = document.createElement('style');
      s.id = 'css-roles';
      s.textContent = 'body[data-role="client"] .only-technicien, body[data-role="client"] .only-biologiste, body[data-role="technicien"] .only-biologiste { display: none !important; }';
      document.head.appendChild(s);
    }
    try {
      const moi = await api('/auth/moi');
      window.__utilisateur = moi;
      document.body.dataset.role = moi.role;
      remplirNav(moi.role);
      const aside = document.querySelector('.sidebar');
      if (aside && !document.getElementById('bloc-session')) {
        const bloc = document.createElement('div');
        bloc.id = 'bloc-session';
        bloc.className = 'user-card';
        bloc.innerHTML = `
          <span class="avatar">${echap(initiales(moi.nom))}</span>
          <div>
            <strong>${echap(moi.nom)}</strong>
            <p class="hint" style="margin:0">${echap(moi.role)}</p>
          </div>
          <button type="button" id="btn-deconnexion" class="lien-discret">Déconnexion</button>`;
        aside.appendChild(bloc);
        document.getElementById('btn-deconnexion').addEventListener('click', async () => {
          try { await api('/auth/deconnexion', { method: 'POST' }); } catch { /* ignore */ }
          window.location.href = 'connexion.html';
        });
      }
      appliquerRole();
    } catch {
      remplirNav('');
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', installerSession);
  } else {
    installerSession();
  }
})();
