/* Complements charges apres app.js : session reelle + cartes de controle cliquables. */

(function () {
  api = async function (chemin, options = {}) {
    let reponse;
    try {
      reponse = await fetch(`/api${chemin}`, {
        credentials: 'same-origin',
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
    const pageConnexion = location.pathname.endsWith('connexion.html') || location.pathname === '/';
    if (reponse.status === 401 && !pageConnexion) {
      window.location.href = 'connexion.html';
      throw new Error(data.erreur || 'Connexion requise.');
    }
    if (!reponse.ok) throw new Error(data.erreur || 'Une erreur est survenue.');
    return data;
  };

  roleActuel = function () {
    return window.__utilisateur?.role || document.body.dataset.role || '';
  };

  const dessinerCarte = htmlCarteControle;
  function htmlUneCarte(serie) {
    const titre = serie.machine_nom ? `<h2>${echap(serie.machine_nom)}</h2>` : '';
    return titre + dessinerCarte(serie);
  }

  htmlCarteControle = function (serie) {
    if (Array.isArray(serie.series)) {
      if (!serie.series.length) return '<p class="empty">Pas assez de points de contrôle pour tracer une carte.</p>';
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

  const LIENS_NAV = [
    ['accueil.html', 'Tableau de bord'],
    ['index.html', 'Lots'],
    ['machines.html', 'Machines'],
    ['signalements.html', 'Signalements'],
    ['controle.html', 'Cartes de contrôle'],
    ['lignee.html', 'Lignée'],
    ['synthese.html', 'Synthèse'],
    ['conformite.html', 'Conformité']
  ];

  function remplirNav() {
    const brand = document.querySelector('.sidebar .brand');
    if (brand) brand.innerHTML = '<span class="logo-mark"></span> TraceLab';
    const nav = document.querySelector('.sidebar nav');
    if (!nav) return;
    const page = (location.pathname.split('/').pop() || 'accueil.html').replace(/^$/, 'accueil.html');
    nav.innerHTML = LIENS_NAV.map(([href, label]) => {
      const active = page === href || (page === 'lot.html' && href === 'index.html') || (page === 'certificat.html' && href === 'index.html') || (page === 'nouveau-lot.html' && href === 'index.html');
      return `<a href="${href}" class="${active ? 'active' : ''}">${label}</a>`;
    }).join('');
  }

  async function installerSession() {
    if (location.pathname.endsWith('connexion.html') || location.pathname === '/') return;
    remplirNav();
    document.querySelectorAll('.role-switch').forEach((el) => {
      if (el.id !== 'bloc-session') el.remove();
    });
    if (!document.getElementById('css-roles')) {
      const s = document.createElement('style');
      s.id = 'css-roles';
      s.textContent = 'body[data-role="client"] .only-technicien, body[data-role="client"] .only-biologiste { display: none; }';
      document.head.appendChild(s);
    }
    try {
      const moi = await api('/auth/moi');
      window.__utilisateur = moi;
      document.body.dataset.role = moi.role;
      if (moi.role === 'biologiste') {
        const nav = document.querySelector('.sidebar nav');
        const page = location.pathname.split('/').pop();
        if (nav && !nav.querySelector('[href="comptes.html"]')) {
          nav.insertAdjacentHTML('beforeend', `<a href="comptes.html" class="${page === 'comptes.html' ? 'active' : ''}">Comptes</a>`);
        }
        if (nav && !nav.querySelector('[href="journal.html"]')) {
          nav.insertAdjacentHTML('beforeend', `<a href="journal.html" class="${page === 'journal.html' ? 'active' : ''}">Journal</a>`);
        }
      }
      const aside = document.querySelector('.sidebar');
      if (aside && !document.getElementById('bloc-session')) {
        const bloc = document.createElement('div');
        bloc.id = 'bloc-session';
        bloc.className = 'role-switch';
        bloc.innerHTML = `<p>${echap(moi.nom)}</p><p class="hint" style="margin:0">${echap(moi.role)}</p>
          <button type="button" id="btn-deconnexion">Déconnexion</button>`;
        const nav = aside.querySelector('nav');
        if (nav) nav.after(bloc);
        else aside.prepend(bloc);
        document.getElementById('btn-deconnexion').addEventListener('click', async () => {
          try { await api('/auth/deconnexion', { method: 'POST' }); } catch { /* ignore */ }
          window.location.href = 'connexion.html';
        });
      }
      appliquerRole();
    } catch {
      /* redirection deja geree par api() */
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', installerSession);
  } else {
    installerSession();
  }
})();
