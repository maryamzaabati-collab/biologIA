function formaterJour(valeur) {
  if (!valeur) return 'non renseignée';
  const s = String(valeur).trim();
  const jour = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (jour) return `${jour[3]}/${jour[2]}/${jour[1]}`;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Paris' });
}

function formaterParis(valeur) {
  if (!valeur) return '-';
  const s = String(valeur).trim();
  let d;
  if (valeur instanceof Date) {
    d = valeur;
  } else if (/[zZ]|[+-]\d{2}:?\d{2}$/.test(s)) {
    d = new Date(s);
  } else if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}/.test(s)) {
    d = new Date(s.replace(' ', 'T') + 'Z');
  } else {
    d = new Date(s);
  }
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleString('fr-FR', {
    timeZone: 'Europe/Paris',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function horlogeParis() {
  return new Date().toISOString();
}

function isoUtc(valeur) {
  if (!valeur) return valeur;
  if (valeur instanceof Date) return valeur.toISOString();
  const s = String(valeur).trim();
  if (/[zZ]|[+-]\d{2}:?\d{2}$/.test(s)) {
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? s : d.toISOString();
  }
  if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}/.test(s)) {
    const d = new Date(s.replace(' ', 'T') + 'Z');
    return Number.isNaN(d.getTime()) ? s : d.toISOString();
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? s : d.toISOString();
}

module.exports = { formaterParis, formaterJour, horlogeParis, isoUtc };
