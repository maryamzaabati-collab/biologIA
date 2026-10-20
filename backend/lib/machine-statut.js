const MOIS_CALIBRATION = 12;

function ajouterMois(dateIso, mois) {
  const d = new Date(`${dateIso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  d.setUTCMonth(d.getUTCMonth() + mois);
  return d.toISOString().slice(0, 10);
}

function enrichirMachine(m) {
  const cal = m.date_calibration || null;
  const prochaine = m.prochaine_calibration || (cal ? ajouterMois(cal, MOIS_CALIBRATION) : null);
  const today = new Date().toISOString().slice(0, 10);
  const statut = m.statut_service || 'en_service';
  const calibrationExpiree = Boolean(prochaine && prochaine < today);
  return {
    ...m,
    date_calibration: cal,
    prochaine_calibration: prochaine,
    statut_service: statut,
    calibration_expiree: calibrationExpiree
  };
}

function refusLotSurMachine(machine, dateLot) {
  if (!machine) return null;
  const e = enrichirMachine(machine);
  if (e.statut_service === 'maintenance') {
    return `La machine ${e.nom} est en maintenance : impossible d’y rattacher un lot.`;
  }
  if (e.statut_service === 'hors_service') {
    return `La machine ${e.nom} est hors service.`;
  }
  if (e.calibration_expiree) {
    return `Calibration expirée pour ${e.nom} (échéance ${e.prochaine_calibration}).`;
  }
  if (dateLot && e.date_maintenance && dateLot >= e.date_maintenance && e.statut_service === 'maintenance') {
    return `La machine ${e.nom} était en maintenance à la date du lot.`;
  }
  return null;
}

module.exports = { enrichirMachine, refusLotSurMachine, MOIS_CALIBRATION };
