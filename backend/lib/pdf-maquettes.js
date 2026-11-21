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

// Les polices standard des PDF (Helvetica) ne connaissent pas certains caractères
// (≥, ≤, →, σ, espaces fines insérées par toLocaleString…). On les remplace
// avant d'écrire, pour éviter les symboles bizarres dans le document.
const REMPLACEMENTS = [
  [/[   ]/g, ' '], [/≥/g, '>='], [/≤/g, '<='], [/→/g, '->'], [/←/g, '<-'],
  [/σ/g, 's'], [/[✓✔]/g, 'OK'], [/[✗✘]/g, 'X'], [/[“”«»]/g, '"'], [/…/g, '...'], [/−/g, '-'], [/[≈]/g, '~']
];
function nettoyer(texte) {
  let t = String(texte ?? '');
  for (const [re, par] of REMPLACEMENTS) t = t.replace(re, par);
  return t;
}
function protegerTexte(doc) {
  const texteOriginal = doc.text.bind(doc);
  doc.text = (t, ...reste) => texteOriginal(nettoyer(t), ...reste);
  const hauteurOriginale = doc.heightOfString.bind(doc);
  doc.heightOfString = (t, ...reste) => hauteurOriginale(nettoyer(t), ...reste);
  return doc;
}

// En-tête commun à tous les PDF du site.
function enTete(doc, titre, sousTitre) {
  doc.roundedRect(40, 28, 22, 22, 5).fill(SAGE);
  doc.font('Helvetica-Bold').fontSize(12).fillColor('#FFFFFF').text('b', 40, 33, { width: 22, align: 'center' });
  doc.font('Helvetica-Bold').fontSize(11).fillColor(SAGE).text('biologIA', 68, 33);
  doc.font('Helvetica').fontSize(9).fillColor(MUTED).text('Registre de traçabilité des laboratoires', 300, 32, { width: 255, align: 'right' });
  doc.fontSize(8).text('Données fictives · projet pédagogique BUT SD', 300, 46, { width: 255, align: 'right' });
  doc.strokeColor(SAGE).lineWidth(1.2).moveTo(40, 68).lineTo(555, 68).stroke();
  doc.font('Helvetica-Bold').fontSize(16).fillColor(INK).text(titre, 40, 80);
  if (sousTitre) doc.font('Helvetica').fontSize(8).fillColor(MUTED).text(sousTitre, 40, 102);
}

// Pied de page sur toutes les pages : « Page 1 / 2 ».
function piedsDePage(doc, texte) {
  const plage = doc.bufferedPageRange();
  for (let i = 0; i < plage.count; i++) {
    doc.switchToPage(plage.start + i);
    const marge = doc.page.margins.bottom;
    doc.page.margins.bottom = 0; // sinon pdfkit crée une page vide
    doc.font('Helvetica').fontSize(7.5).fillColor(MUTED).text(
      `${texte} · Page ${i + 1} / ${plage.count}`,
      40, doc.page.height - 34, { width: doc.page.width - 80, align: 'center', lineBreak: false }
    );
    doc.page.margins.bottom = marge;
  }
}

// Saut de page si la place restante est trop petite.
function place(doc, y, besoin) {
  if (y + besoin > doc.page.height - 60) {
    doc.addPage();
    return 50;
  }
  return y;
}

// Tableau avec retour à la ligne dans les cellules et saut de page automatique
// (l'en-tête du tableau est répété sur la nouvelle page).
function tableauSimple(doc, colonnes, lignes, y0, opts = {}) {
  const x0 = 48;
  const largeur = doc.page.width - 96;
  const totalW = colonnes.reduce((s2, c) => s2 + c.w, 0);
  const largeurs = colonnes.map((c) => (c.w / totalW) * largeur);
  let y = y0;
  const haut = opts.entete || 18;
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
  for (const ligne of lignes) {
    doc.font('Helvetica').fontSize(8);
    const hauteurs = colonnes.map((c, i) => {
      const cell = ligne.cellules[i];
      const texte = cell && cell.point ? cell.texte : String(cell ?? '');
      const w = largeurs[i] - (cell && cell.point ? 18 : 6);
      return doc.heightOfString(texte, { width: w });
    });
    const h = Math.max(opts.hauteur || 22, Math.max(...hauteurs) + 12);
    if (y + h > doc.page.height - 60) {
      doc.addPage();
      y = 50;
      dessinerEntete();
      doc.font('Helvetica').fontSize(8);
    }
    let x = x0;
    const ty = y + 5;
    colonnes.forEach((c, i) => {
      const cell = ligne.cellules[i];
      if (cell && cell.point) {
        doc.circle(x + 5, ty + 4, 3).fill(cell.point);
        doc.fillColor(INK).text(cell.texte, x + 14, ty, { width: largeurs[i] - 18 });
      } else {
        doc.fillColor(INK).text(String(cell ?? ''), x, ty, { width: largeurs[i] - 6 });
      }
      x += largeurs[i];
    });
    doc.strokeColor(LINE).lineWidth(0.4);
    doc.moveTo(x0, y + h - 3).lineTo(x0 + largeur, y + h - 3).stroke();
    y += h;
  }
  return y;
}

// Zone de signature + QR code, placées après le contenu (nouvelle page si besoin).
function blocSignature(doc, y, qr, legendeQr) {
  y = place(doc, y + 14, 80);
  doc.strokeColor(SAGE).lineWidth(0.8).rect(40, y, 280, 60).stroke();
  doc.font('Helvetica').fontSize(8).fillColor(MUTED).text('Validation du biologiste · nom, date, signature', 48, y + 8);
  if (qr) {
    try {
      doc.image(qr, 483, y - 4, { width: 64 });
      if (legendeQr) doc.fontSize(6.5).fillColor(MUTED).text(legendeQr, 380, y + 62, { width: 175, align: 'right' });
    } catch { /* image invalide : on ignore */ }
  }
  return y + 76;
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
  urlPublique, couleurPoint, dessinerAnneau, tableauSimple, bufferQr,
  nettoyer, protegerTexte, enTete, piedsDePage, place, blocSignature
};
