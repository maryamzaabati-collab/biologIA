/* Complements charges apres app.js : session reelle + cartes de controle cliquables. */

(function () {
  api = async function (chemin, options = {}) {
    let reponse;
    try {
      const csrf = (window.__utilisateur && window.__utilisateur.csrf)
        || (document.cookie.match(/labo_csrf=([^;]+)/) || [])[1]
        || '';
      const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
      if (csrf) headers['X-CSRF-Token'] = csrf;
      reponse = await fetch(`/api${chemin}`, {
        credentials: 'include',
        ...options,
        headers
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
        + `<p class="hint">${pluriel(serie.nb_points || 0, 'valeur')} CSV — minimum 20 pour un seul analyte.</p>`;
    }
    const note = serie.nb_reference
      ? `<p class="hint">Le comportement normal de la machine est calculé sur ses ${serie.nb_reference} premières mesures, puis les suivantes sont comparées à lui.</p>`
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
    reseau: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="5" r="2.2"/><circle cx="5" cy="18" r="2.2"/><circle cx="19" cy="18" r="2.2"/><path d="M11 7 6 16M13 7l5 9M7.2 18h9.6"/></svg>',
    probleme: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6V14m0 3v.5"/></svg>',
    patients: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="8" r="3"/><path d="M3 20c1-4 11-4 12 0"/><circle cx="17" cy="9" r="2.5"/><path d="M21 20c-.6-3-5-3.5-7-2"/></svg>'
  };

  function lienNav(href, label, icon, page) {
    const active = page === href
      || (href === 'index.html' && (page === 'lot.html' || page === 'nouveau-lot.html'))
      || (href === 'machines.html' && (page === 'machine.html' || page === 'controle.html'))
      || (href === 'patients.html' && page === 'identifiants.html')
      || (href === 'documents.html' && (page === 'synthese.html' || page === 'certificat.html' || page === 'lignee.html'))
      || (href === 'tableau.html' && page === 'tableau.html');
    return `<a href="${href}" class="${active ? 'active' : ''}">${ICONES[icon] || ''}<span>${label}</span></a>`;
  }

  function remplirNav(role) {
    const brand = document.querySelector('.sidebar .brand');
    if (brand) {
      // Hélice d'ADN, le même logo que sur la page de connexion.
      brand.innerHTML = `<span class="logo-mark" aria-hidden="true">
        <svg viewBox="0 0 28 28" fill="none"><path d="M8.5 4C8.5 10 19.5 10 19.5 14S8.5 18 8.5 24M19.5 4C19.5 10 8.5 10 8.5 14s11 4 11 10" stroke="#FFFFFF" stroke-width="1.8" stroke-linecap="round" fill="none"/><path d="M11 7.5h6M11 20.5h6" stroke="#FFFFFF" stroke-width="1.3" stroke-linecap="round"/><circle cx="23.2" cy="4.8" r="2" fill="#E8A33D"/></svg>
      </span> <span>biolog<b class="brand-ia">IA</b></span>`;
    }
    const nav = document.querySelector('.sidebar nav');
    if (!nav) return;
    const page = (location.pathname.split('/').pop() || 'accueil.html').replace(/^$/, 'accueil.html');
    const admin = role === 'biologiste'
      ? `<p class="nav-section">Admin</p>
         ${lienNav('comptes.html', 'Comptes', 'comptes', page)}
         ${lienNav('journal.html', 'Journal', 'journal', page)}`
      : '';
    nav.innerHTML = `
      <p class="nav-section">Comprendre</p>
      ${lienNav('apropos.html', 'Le problème', 'probleme', page)}
      ${lienNav('accueil.html', 'Accueil', 'accueil', page)}
      <p class="nav-section">Tout le réseau</p>
      ${lienNav('reseau.html', '20 laboratoires', 'reseau', page)}
      <p class="nav-section">Labo de Nice en détail</p>
      ${lienNav('index.html', 'Lots de données', 'lots', page)}
      ${lienNav('machines.html', 'Machines', 'machines', page)}
      ${lienNav('signalements.html', 'Alertes', 'signalements', page)}
      ${role === 'client' ? '' : lienNav('patients.html', 'Patients', 'patients', page)}
      ${lienNav('tableau.html', 'Tableau de bord', 'synthese', page)}
      <p class="nav-section">Preuves</p>
      ${lienNav('documents.html', 'Documents', 'synthese', page)}
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
        <input type="search" id="recherche-globale" name="recherche-labo" placeholder="Lots, machines, PSN" autocomplete="off" autocorrect="off" spellcheck="false" data-lpignore="true">
        <div id="recherche-resultats" class="recherche-resultats" hidden></div>
      </div>
      <button type="button" id="btn-theme" class="theme-switch" role="switch" aria-checked="true">
        <span class="theme-ico theme-ico-lune" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 14.5A8.5 8.5 0 1 1 9.5 3 7 7 0 0 0 21 14.5z"/></svg>
        </span>
        <span class="theme-switch-knob" aria-hidden="true"></span>
        <span class="theme-ico theme-ico-soleil" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M5 12H3M21 12h-2M6 6l1.4 1.4M16.6 16.6 18 18M6 18l1.4-1.4M16.6 7.4 18 6"/></svg>
        </span>
      </button>
      <button type="button" id="btn-avatar" class="avatar-top" aria-label="Compte" hidden></button>
      <div id="menu-compte" class="menu-compte" hidden></div>
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
          (r.lots || []).forEach((l) => lignes.push(`<a href="lot.html?id=${l.id}">Lot · ${echap(l.nom)}</a>`));
          (r.machines || []).forEach((m) => lignes.push(`<a href="machine.html?id=${m.id}">Machine · ${echap(m.nom)}</a>`));
          (r.signalements || []).forEach((s) => lignes.push(`<a href="lot.html?id=${s.lot_id}&edit=1">Signalement · ${echap(s.lot_nom)}</a>`));
          (r.patients || []).forEach((p) => lignes.push(`<a href="patients.html?onglet=identifiants&q=${encodeURIComponent(p.psn)}">Patient · ${echap(p.psn)}</a>`));
          box.innerHTML = lignes.length
            ? `<p class="hint">${pluriel((r.lots || []).length, 'lot')} · ${pluriel((r.machines || []).length, 'machine')} · ${pluriel((r.signalements || []).length, 'signalement')} · ${(r.patients || []).length} PSN</p>${lignes.join('')}`
            : '<p class="empty">Aucun résultat.</p>';
          box.hidden = false;
        } catch (err) {
          box.innerHTML = `<p class="empty">${echap(err.message)}</p>`;
          box.hidden = false;
        }
      }, 200);
    });
    const themeBtn = document.getElementById('btn-theme');
    if (themeBtn) {
      const basculer = () => {
        localStorage.setItem('themeLabo', themeActuel() === 'sombre' ? 'clair' : 'sombre');
        appliquerTheme();
      };
      themeBtn.addEventListener('click', basculer);
    }
    appliquerTheme();
    document.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        const champ = document.getElementById('recherche-globale');
        if (champ && champ.offsetParent) champ.focus();
      }
    });
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
      if (moi.secondes_restantes != null && moi.secondes_restantes < 15 * 60) {
        let bande = document.getElementById('alerte-session');
        if (!bande) {
          bande = document.createElement('p');
          bande.id = 'alerte-session';
          bande.className = 'message erreur';
          bande.setAttribute('role', 'alert');
          document.querySelector('.layout > main')?.prepend(bande);
        }
        bande.textContent = 'Session bientôt expirée — enregistrez votre travail et reconnectez-vous.';
      }
      const av = document.getElementById('btn-avatar');
      const menu = document.getElementById('menu-compte');
      if (av && menu) {
        av.hidden = false;
        av.textContent = initiales(moi.nom);
        menu.innerHTML = `<p class="hint" style="margin:0 8px 8px">${echap(moi.nom)} · ${echap(moi.role)}</p>
          <button type="button" class="secondary" id="btn-deconnexion">Déconnexion</button>`;
        av.onclick = (e) => { e.stopPropagation(); menu.hidden = !menu.hidden; };
        document.addEventListener('click', (e) => {
          if (!menu.hidden && !menu.contains(e.target) && e.target !== av) menu.hidden = true;
        });
        document.getElementById('btn-deconnexion')?.addEventListener('click', async () => {
          try { await api('/auth/deconnexion', { method: 'POST' }); } catch { /* ignore */ }
          window.location.href = 'connexion.html';
        });
      }
      appliquerRole();
    } catch {
      remplirNav('');
    }
    window.dispatchEvent(new Event('session-prete'));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', installerSession);
  } else {
    installerSession();
  }
})();
