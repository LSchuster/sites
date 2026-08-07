import fontkit from '@pdf-lib/fontkit';
import { embedFacturX, PDFDocument } from '@cantoo/pdf-lib';
import { serializeCii } from '../cii/serialize';
import { docMessages } from '../doc-i18n';
import type { Invoice } from '../model/invoice';
import { outputFormat } from '../model/invoice';
import { loadFontBytes } from './fonts';
import { drawInvoice } from './layout';

/**
 * Generate the hybrid e-invoice: a visually laid-out PDF that is also a
 * PDF/A-3 with embedded Factur-X/ZUGFeRD CII XML (profile EN 16931).
 *
 * This module is the app's one heavy chunk — always load it lazily via
 * `import('./pdf/generate')`. It runs in the browser AND in Node (golden
 * samples, tools/gen-samples.mts), so keep it free of DOM access.
 */
export async function generateInvoicePdf(invoice: Invoice): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);

  const bytes = await loadFontBytes();
  // PDF/A forbids non-embedded fonts: only these OFL faces, never the
  // pdf-lib Standard-14 fonts. Embedded WITHOUT `subset: true` — the files
  // are already subset at build time (tools/fonts.mjs), and fontkit's
  // per-document subsetter crashes on harfbuzz-subsetted TTFs.
  const regular = await pdfDoc.embedFont(bytes.regular);
  const semibold = await pdfDoc.embedFont(bytes.semibold);

  let logo;
  const dataUrl = invoice.seller.logoDataUrl;
  if (dataUrl?.startsWith('data:image/png')) logo = await pdfDoc.embedPng(dataUrl);
  else if (dataUrl?.startsWith('data:image/jpeg') || dataUrl?.startsWith('data:image/jpg'))
    logo = await pdfDoc.embedJpg(dataUrl);

  drawInvoice(pdfDoc, invoice, { regular, semibold }, logo);

  const doc = docMessages(invoice.docLanguage);
  pdfDoc.setTitle(`${doc.invoiceTitle} ${invoice.number}`);
  pdfDoc.setAuthor(invoice.seller.name || 'invoice');
  pdfDoc.setCreator('invoice — client-side invoice generator');
  pdfDoc.setProducer('@cantoo/pdf-lib');

  // Converts to PDF/A-3B (sRGB output intent + XMP) and attaches the CII XML
  // with the fx: extension schema and AFRelationship the validators expect.
  // The XMP conformance level must match the guideline URN in the XML —
  // XRechnung-mode prints get the ZUGFeRD XRECHNUNG reference profile.
  const xml = new TextEncoder().encode(serializeCii(invoice));
  await embedFacturX(pdfDoc, xml, {
    conformanceLevel: outputFormat(invoice) === 'xrechnung' ? 'XRECHNUNG' : 'EN 16931',
  });

  return pdfDoc.save();
}

export function invoiceFileName(invoice: Invoice): string {
  const safe = invoice.number.replace(/[^\w.-]+/g, '_') || 'rechnung';
  const prefix = invoice.docLanguage === 'de' ? 'Rechnung' : 'Invoice';
  return `${prefix}_${safe}.pdf`;
}
