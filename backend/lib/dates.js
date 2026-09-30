function versDateUtc(valeur) {
  if (!valeur) return null;
  if (valeur instanceof Date) return Number.isNaN(valeur.getTime()) ? null : valeur;
  const s = String(valeur).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [annee, mois, jour] = s.split('-').map(Number);
    return new Date(Date.UTC(annee, mois - 1, jour));
  }
  let iso = s.includes(' ') ? s.replace(' ', 'T') : s;
  if (/^\d{4}-\d{2}-\d{2}T/.test(iso) && !/[zZ]|[+-]\d{2}:?\d{2}$/.test(iso)) iso += 'Z';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formaterParis(valeur) {
  const d = versDateUtc(valeur);
  if (!d) return valeur || '-';
  return d.toLocaleString('fr-FR', {
    timeZone: 'Europe/Paris',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function isoUtc(valeur) {
  const d = versDateUtc(valeur);
  return d ? d.toISOString() : valeur;
}

module.exports = { versDateUtc, formaterParis, isoUtc };
