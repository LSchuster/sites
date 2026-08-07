import type { PDFDocument, PDFFont, PDFImage, PDFPage } from '@cantoo/pdf-lib';
import { rgb } from '@cantoo/pdf-lib';
import {
  docMessages,
  formatCents,
  formatDate,
  formatQuantity,
  formatUnitPrice,
} from '../doc-i18n';
import { computeTotals } from '../model/compute';
import type { Invoice } from '../model/invoice';
import { dueDateIso } from '../model/invoice';
import { effectiveRate, isZeroRated } from '../model/taxcases';

/**
 * DIN 5008 Form B letter layout on A4. All positions are in mm from the top
 * left of the sheet; pdf-lib's origin is bottom left, so `yTop` converts.
 * One visual template — changes here must keep the address inside the
 * DIN window zone (starts 45 mm from top, 85 mm wide at x 20 mm).
 */

const MM = 72 / 25.4;
const PAGE_W = 210 * MM;
const PAGE_H = 297 * MM;

const LEFT = 25; // mm — DIN 5008 text margin
const RIGHT = 190; // mm — right text edge (20 mm margin)
const CONTENT_BOTTOM = 260; // mm — flow content must stop here (footer below)
const FOOTER_TOP = 267; // mm — hairline above the footer block

const ink = rgb(0.1, 0.11, 0.12);
const faint = rgb(0.45, 0.47, 0.5);
const hairline = rgb(0.75, 0.77, 0.79);

export interface LayoutFonts {
  regular: PDFFont;
  semibold: PDFFont;
}

interface Ctx {
  doc: PDFDocument;
  fonts: LayoutFonts;
  invoice: Invoice;
  logo?: PDFImage;
  pages: PDFPage[];
  page: PDFPage;
  /** Current flow position, mm from top. */
  cursor: number;
}

const x = (mm: number) => mm * MM;
const yTop = (mm: number) => PAGE_H - mm * MM;

function text(
  page: PDFPage,
  str: string,
  mmX: number,
  mmY: number,
  font: PDFFont,
  size: number,
  color = ink,
): void {
  page.drawText(str, { x: x(mmX), y: yTop(mmY) - size * 0.8, size, font, color });
}

function textRight(
  page: PDFPage,
  str: string,
  mmRight: number,
  mmY: number,
  font: PDFFont,
  size: number,
  color = ink,
): void {
  const w = font.widthOfTextAtSize(str, size);
  page.drawText(str, { x: x(mmRight) - w, y: yTop(mmY) - size * 0.8, size, font, color });
}

function line(page: PDFPage, fromMmX: number, toMmX: number, mmY: number, color = hairline): void {
  page.drawLine({
    start: { x: x(fromMmX), y: yTop(mmY) },
    end: { x: x(toMmX), y: yTop(mmY) },
    thickness: 0.5,
    color,
  });
}

/** Greedy word wrap by measured width; overlong words are hard-broken. */
function wrap(str: string, font: PDFFont, size: number, maxMm: number): string[] {
  const maxW = x(maxMm);
  const lines: string[] = [];
  for (const paragraph of str.split('\n')) {
    let current = '';
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const candidate = current ? `${current} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= maxW) {
        current = candidate;
        continue;
      }
      if (current) lines.push(current);
      current = word;
      while (font.widthOfTextAtSize(current, size) > maxW && current.length > 1) {
        let cut = current.length - 1;
        while (cut > 1 && font.widthOfTextAtSize(current.slice(0, cut), size) > maxW) cut--;
        lines.push(current.slice(0, cut));
        current = current.slice(cut);
      }
    }
    lines.push(current);
  }
  return lines.length ? lines : [''];
}

function newPage(ctx: Ctx): void {
  ctx.page = ctx.doc.addPage([PAGE_W, PAGE_H]);
  ctx.pages.push(ctx.page);
  ctx.cursor = 30;
}

function ensureRoom(ctx: Ctx, neededMm: number): void {
  if (ctx.cursor + neededMm > CONTENT_BOTTOM) newPage(ctx);
}

// ---- blocks ----------------------------------------------------------------

function drawFoldMarks(page: PDFPage): void {
  // Fold marks at 105/210 mm, punch mark at 148.5 mm (DIN 5008 Form B).
  for (const [mmY, len] of [
    [105, 4],
    [210, 4],
    [148.5, 6],
  ] as const) {
    page.drawLine({
      start: { x: x(4), y: yTop(mmY) },
      end: { x: x(4 + len), y: yTop(mmY) },
      thickness: 0.4,
      color: faint,
    });
  }
}

/** Logo bounding boxes in mm, keyed by the profile's logoSize (default M). */
const LOGO_BOXES = {
  S: { w: 60, h: 22 },
  M: { w: 85, h: 30 },
  L: { w: 110, h: 38 },
} as const;

function drawLogo(ctx: Ctx): void {
  if (!ctx.logo) return;
  const box = LOGO_BOXES[ctx.invoice.seller.logoSize ?? 'M'];
  const maxW = x(box.w);
  const maxH = x(box.h);
  const scale = Math.min(maxW / ctx.logo.width, maxH / ctx.logo.height, 1);
  const w = ctx.logo.width * scale;
  const h = ctx.logo.height * scale;
  const left = (ctx.invoice.seller.logoPosition ?? 'right') === 'left';
  ctx.page.drawImage(ctx.logo, {
    x: left ? x(LEFT) : x(RIGHT) - w,
    y: yTop(12) - h,
    width: w,
    height: h,
  });
}

function drawAddressWindow(ctx: Ctx): void {
  const { invoice, fonts, page } = ctx;
  const s = invoice.seller;
  // Rücksendeangabe — one small line at the top of the window zone.
  const returnLine = [s.name, s.street, `${s.postcode} ${s.city}`].filter(Boolean).join(' · ');
  text(page, returnLine, 25, 46, fonts.regular, 6.5, faint);
  line(page, 25, 105, 49);

  const b = invoice.buyer;
  const lines = [b.name, b.street, `${b.postcode} ${b.city}`.trim()];
  if (b.countryCode !== s.countryCode) lines.push(countryName(b.countryCode, invoice));
  let mmY = 53;
  for (const l of lines.filter(Boolean)) {
    text(page, l, 25, mmY, fonts.regular, 10);
    mmY += 4.6;
  }
}

function countryName(code: string, invoice: Invoice): string {
  try {
    const names = new Intl.DisplayNames(invoice.docLanguage === 'de' ? 'de' : 'en', {
      type: 'region',
    });
    return names.of(code) ?? code;
  } catch {
    return code;
  }
}

function drawInfoBlock(ctx: Ctx): void {
  const { invoice, fonts, page } = ctx;
  const doc = docMessages(invoice.docLanguage);
  const rows: Array<[string, string]> = [[doc.invoiceNo, invoice.number]];
  rows.push([doc.issueDate, formatDate(invoice.issueDate, invoice.docLanguage)]);
  if (invoice.servicePeriod) {
    rows.push([
      doc.servicePeriod,
      `${formatDate(invoice.servicePeriod.from, invoice.docLanguage)} – ${formatDate(invoice.servicePeriod.to, invoice.docLanguage)}`,
    ]);
  } else if (invoice.deliveryDate) {
    rows.push([doc.deliveryDate, formatDate(invoice.deliveryDate, invoice.docLanguage)]);
  }
  if (invoice.buyerReference?.trim()) rows.push([doc.buyerReference, invoice.buyerReference.trim()]);
  if (invoice.seller.taxNumber?.trim()) rows.push([doc.sellerTaxNumber, invoice.seller.taxNumber.trim()]);
  if (invoice.seller.vatId?.trim()) rows.push([doc.sellerVatId, invoice.seller.vatId.trim()]);

  let mmY = 52;
  for (const [label, value] of rows) {
    text(page, label, 122, mmY, fonts.regular, 8.5, faint);
    textRight(page, value, RIGHT, mmY, fonts.regular, 8.5);
    mmY += 4.4;
  }
}

interface Col {
  desc: number; // description width, mm
  qtyR: number;
  unitL: number;
  priceR: number;
  vatR?: number;
  amountR: number;
}

function columns(showVat: boolean): Col {
  return showVat
    ? { desc: 68, qtyR: 116, unitL: 118, priceR: 154, vatR: 167, amountR: RIGHT }
    : { desc: 76, qtyR: 124, unitL: 126, priceR: 160, amountR: RIGHT };
}

function drawTableHeader(ctx: Ctx, col: Col): void {
  const { fonts, page, invoice } = ctx;
  const doc = docMessages(invoice.docLanguage);
  const s = 8;
  const mmY = ctx.cursor;
  text(page, doc.colPos, LEFT, mmY, fonts.semibold, s, faint);
  text(page, doc.colDescription, 33, mmY, fonts.semibold, s, faint);
  textRight(page, doc.colQty, col.qtyR, mmY, fonts.semibold, s, faint);
  text(page, doc.colUnit, col.unitL, mmY, fonts.semibold, s, faint);
  textRight(page, doc.colUnitPrice, col.priceR, mmY, fonts.semibold, s, faint);
  if (col.vatR !== undefined) textRight(page, doc.colVat, col.vatR, mmY, fonts.semibold, s, faint);
  textRight(page, doc.colNet, col.amountR, mmY, fonts.semibold, s, faint);
  line(page, LEFT, RIGHT, mmY + 4.2);
  ctx.cursor = mmY + 6.5;
}

function drawLines(ctx: Ctx): void {
  const { invoice, fonts } = ctx;
  const totals = computeTotals(invoice);
  const doc = docMessages(invoice.docLanguage);
  const showVat = !isZeroRated(invoice.taxCase);
  const col = columns(showVat);
  const size = 9.5;
  const lineH = 4.4;

  drawTableHeader(ctx, col);

  invoice.lines.forEach((item, i) => {
    // Text-only positions span the full width — no amount columns.
    const descWidth = item.textOnly ? RIGHT - 33 : col.desc;
    const descLines = wrap(item.description, fonts.regular, size, descWidth);
    const rowH = Math.max(descLines.length, 1) * lineH + 2.2;
    ensureRoom(ctx, rowH + 8);
    if (ctx.cursor === 30 + 0) {
      // fresh page → repeat the table header
      drawTableHeader(ctx, col);
    }
    const mmY = ctx.cursor;
    const page = ctx.page;
    text(page, String(i + 1), LEFT, mmY, fonts.regular, size);
    descLines.forEach((dl, li) => text(page, dl, 33, mmY + li * lineH, fonts.regular, size));
    if (!item.textOnly) {
      textRight(page, formatQuantity(item.quantityMilli, invoice.docLanguage), col.qtyR, mmY, fonts.regular, size);
      text(page, doc.unit[item.unit], col.unitL, mmY, fonts.regular, size);
      textRight(page, formatUnitPrice(item.unitPriceE4, invoice.docLanguage), col.priceR, mmY, fonts.regular, size);
      if (col.vatR !== undefined)
        textRight(
          page,
          `${effectiveRate(invoice.taxCase, item.vatRate)} %`,
          col.vatR,
          mmY,
          fonts.regular,
          size,
        );
      textRight(
        page,
        formatCents(totals.lineNetCents.get(item.id) ?? 0, invoice.docLanguage),
        col.amountR,
        mmY,
        fonts.regular,
        size,
      );
    }
    ctx.cursor = mmY + rowH;
  });

  line(ctx.page, LEFT, RIGHT, ctx.cursor);
  ctx.cursor += 4;
}

function drawTotals(ctx: Ctx): void {
  const { invoice, fonts } = ctx;
  const totals = computeTotals(invoice);
  const doc = docMessages(invoice.docLanguage);
  const labelR = 154;
  const size = 9.5;

  const rows: Array<[string, string, boolean]> = [];
  rows.push([doc.sumNet, formatCents(totals.netCents, invoice.docLanguage), false]);
  if (!isZeroRated(invoice.taxCase)) {
    for (const g of totals.byRate)
      rows.push([doc.sumVat(g.rate), formatCents(g.vatCents, invoice.docLanguage), false]);
  }
  rows.push([doc.sumGross, formatCents(totals.grossCents, invoice.docLanguage), true]);

  ensureRoom(ctx, rows.length * 5.2 + 8);
  for (const [label, value, strong] of rows) {
    const font = strong ? fonts.semibold : fonts.regular;
    if (strong) {
      line(ctx.page, 118, RIGHT, ctx.cursor - 1, ink);
      ctx.cursor += 1.4;
    }
    textRight(ctx.page, label, labelR, ctx.cursor, font, size, strong ? ink : faint);
    textRight(ctx.page, value, RIGHT, ctx.cursor, font, size);
    ctx.cursor += 5.2;
  }
  ctx.cursor += 3;
}

function drawNotes(ctx: Ctx): void {
  const { invoice, fonts } = ctx;
  const doc = docMessages(invoice.docLanguage);
  const size = 9.5;
  const parts: string[] = [];

  if (isZeroRated(invoice.taxCase))
    parts.push(doc.taxNote[invoice.taxCase as Exclude<Invoice['taxCase'], 'standard'>]);

  if (invoice.paymentTermsDays !== null) {
    const due = dueDateIso(invoice);
    parts.push(
      invoice.paymentTermsDays === 0
        ? doc.paymentTermsImmediate
        : doc.paymentTerms(invoice.paymentTermsDays, formatDate(due, invoice.docLanguage)),
    );
  }

  if (invoice.notes?.trim()) parts.push(invoice.notes.trim());

  for (const part of parts) {
    const lines = wrap(part, fonts.regular, size, RIGHT - LEFT);
    ensureRoom(ctx, lines.length * 4.4 + 4);
    for (const l of lines) {
      text(ctx.page, l, LEFT, ctx.cursor, fonts.regular, size);
      ctx.cursor += 4.4;
    }
    ctx.cursor += 2.4;
  }
}

function drawFooter(ctx: Ctx): void {
  const { invoice, fonts } = ctx;
  const doc = docMessages(invoice.docLanguage);
  const s = invoice.seller;
  const size = 7;
  const colW = (RIGHT - LEFT) / 3;

  const colA = [s.name, s.street, `${s.postcode} ${s.city}`].filter(Boolean);
  const colB = [
    s.phone?.trim() ? `${doc.phone} ${s.phone.trim()}` : '',
    s.email?.trim() ? `${doc.email} ${s.email.trim()}` : '',
    s.taxNumber?.trim() ? `${doc.sellerTaxNumber}: ${s.taxNumber.trim()}` : '',
    s.vatId?.trim() ? `${doc.sellerVatId} ${s.vatId.trim()}` : '',
  ].filter(Boolean);
  const colC = [
    s.bankName?.trim() ?? '',
    `${doc.iban} ${s.iban.trim()}`,
    s.bic?.trim() ? `${doc.bic} ${s.bic.trim()}` : '',
  ].filter(Boolean);

  for (const page of ctx.pages) {
    line(page, LEFT, RIGHT, FOOTER_TOP);
    [colA, colB, colC].forEach((colLines, ci) => {
      colLines.slice(0, 4).forEach((l, li) => {
        text(page, l, LEFT + ci * colW, FOOTER_TOP + 3 + li * 3.4, fonts.regular, size, faint);
      });
    });
  }

  if (ctx.pages.length > 1) {
    ctx.pages.forEach((page, i) => {
      textRight(page, doc.page(i + 1, ctx.pages.length), RIGHT, FOOTER_TOP - 5, fonts.regular, 7, faint);
    });
  }
}

// ---- entry -----------------------------------------------------------------

export function drawInvoice(
  pdfDoc: PDFDocument,
  invoice: Invoice,
  fonts: LayoutFonts,
  logo?: PDFImage,
): void {
  const first = pdfDoc.addPage([PAGE_W, PAGE_H]);
  const ctx: Ctx = {
    doc: pdfDoc,
    fonts,
    invoice,
    ...(logo ? { logo } : {}),
    pages: [first],
    page: first,
    cursor: 98,
  };

  drawFoldMarks(first);
  drawLogo(ctx);
  drawAddressWindow(ctx);
  drawInfoBlock(ctx);

  const doc = docMessages(invoice.docLanguage);
  text(first, `${doc.invoiceTitle} ${invoice.number}`, LEFT, 92, fonts.semibold, 13);

  ctx.cursor = 102;
  drawLines(ctx);
  drawTotals(ctx);
  drawNotes(ctx);
  drawFooter(ctx);
}
