const SAGE = '#3F6F55';
const INK = '#1C1A16';
const MUTED = '#6B675E';
const LINE = '#DDD6C8';
const PAPER = '#F7F4EC';

function urlPublique(req) {
  if (process.env.PUBLIC_URL) return String(process.env.PUBLIC_URL).replace(/\/$/, '');
  if (process.env.RENDER_EXTERNAL_URL) return String(process.env.RENDER_EXTERNAL_URL).replace(/\/$/, '');
  const host = req && (req.get('x-forwarded-host') || req.get('host'));
  if (host && !/localhost|127\.0\.0\.1/.test(host)) {
    const proto = req.get('x-forwarded-proto') || (req.secure ? 'https' : 'http');
    return `${proto}://${host}`;
  }
  if (process.env.REPLIT_DEV_DOMAIN) return `https://${process.env.REPLIT_DEV_DOMAIN}`;
  return 'https://github.com/maryamzaabati-collab/biologIA';
}

function couleurPoint(code) {
  if (code === 'valide' || code === 'ok') return SAGE;
  if (code === 'signale') return '#C85A4A';
  if (code === 'a_valider') return '#D4A04A';
  if (code === 'a_revalider') return '#4A6FA5';
  return '#9A958A';
}

function dessinerAnneau(doc, x, y, pct, texte, label, couleur) {
  const r = 22;
  const p = Math.max(0, Math.min(100, Number(pct) || 0)) / 100;
  doc.save();
  doc.circle(x, y, r).lineWidth(5).strokeColor('#E6E0D4').stroke();
  if (p > 0) {
    const start = -Math.PI / 2;
    const end = start + p * 2 * Math.PI;
    const large = p > 0.5 ? 1 : 0;
    const x1 = x + r * Math.cos(start);
    const y1 = y + r * Math.sin(start);
    const x2 = x + r * Math.cos(end);
    const y2 = y + r * Math.sin(end);
    doc.path(`M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`)
      .lineWidth(5)
      .lineCap('round')
      .strokeColor(couleur || SAGE)
      .stroke();
  }
  doc.fillColor(INK).font('Helvetica-Bold').fontSize(9)
    .text(String(texte), x - 22, y - 6, { width: 44, align: 'center' });
  doc.font('Helvetica').fontSize(7).fillColor(MUTED)
    .text(label, x - 36, y + r + 8, { width: 72, align: 'center' });
  doc.restore();
  return y + r + 28;
}

function tableauSimple(doc, colonnes, lignes, y0, opts = {}) {
  const x0 = 48;
  const largeur = doc.page.width - 96;
  const totalW = colonnes.reduce((s, c) => s + c.w, 0);
  const largeurs = colonnes.map((c) => (c.w / totalW) * largeur);
  let y = y0;
  const haut = opts.entete || 18;
  const h = opts.hauteur || 22;
  const dessinerEntete = () => {
    let x = x0;
    doc.strokeColor(SAGE).lineWidth(0.8);
    doc.moveTo(x0, y + haut - 4).lineTo(x0 + largeur, y + haut - 4).stroke();
    doc.font('Helvetica-Bold').fontSize(8).fillColor(MUTED);
    colonnes.forEach((c, i) => {
      doc.text(c.label, x, y, { width: largeurs[i] - 6, lineBreak: false });
      x += largeurs[i];
    });
    y += haut;
  };
  dessinerEntete();
  doc.font('Helvetica').fontSize(8).fillColor(INK);
  for (const ligne of lignes) {
    if (y > doc.page.height - 90) break;
    let x = x0;
    const ty = y + 4;
    colonnes.forEach((c, i) => {
      const cell = ligne.cellules[i];
      if (cell && cell.point) {
        doc.circle(x + 5, ty + 4, 3).fill(cell.point);
        doc.fillColor(INK).text(cell.texte, x + 14, ty, { width: largeurs[i] - 18, lineBreak: false });
      } else {
        doc.fillColor(INK).text(String(cell ?? ''), x, ty, { width: largeurs[i] - 6, lineBreak: false });
      }
      x += largeurs[i];
    });
    doc.strokeColor(LINE).lineWidth(0.4);
    doc.moveTo(x0, y + h - 3).lineTo(x0 + largeur, y + h - 3).stroke();
    y += h;
  }
  return y;
}

async function bufferQr(url) {
  try {
    const QRCode = require('qrcode');
    return await QRCode.toBuffer(url, { type: 'png', margin: 1, width: 110, errorCorrectionLevel: 'M' });
  } catch {
    return null;
  }
}

module.exports = {
  SAGE, INK, MUTED, LINE, PAPER,
  urlPublique, couleurPoint, dessinerAnneau, tableauSimple, bufferQr
};
