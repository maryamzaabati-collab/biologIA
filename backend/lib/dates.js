function aUnFuseau(s) {
  return /[zZ]|[+-]\d{2}:?\d{2}$/.test(s);
}

function formaterCivil(annee, mois, jour, heure, minute) {
  return `${jour}/${mois}/${annee} ${heure}:${minute}`;
}

function formaterParis(valeur) {
  if (!valeur) return '-';
  if (valeur instanceof Date) {
    return valeur.toLocaleString('fr-FR', {
      timeZone: 'Europe/Paris',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
  const s = String(valeur).trim();
  if (aUnFuseau(s) || (s.includes('T') && s.endsWith('Z'))) {
    const d = new Date(s);
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
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/);
  if (!m) return s;
  if (!m[4]) return `${m[3]}/${m[2]}/${m[1]}`;
  return formaterCivil(m[1], m[2], m[3], m[4], m[5]);
}

function horlogeParis() {
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  const p = {};
  for (const part of fmt.formatToParts(new Date())) {
    if (part.type !== 'literal') p[part.type] = part.value;
  }
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}:${p.second}`;
}

function isoUtc(valeur) {
  return valeur;
}

module.exports = { formaterParis, horlogeParis, isoUtc };
