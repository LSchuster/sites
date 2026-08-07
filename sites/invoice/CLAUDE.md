# invoice — agent brief

Static, client-only German invoice generator ("Rechnung schreiben") producing hybrid
e-invoices: PDF that is also PDF/A-3 with embedded Factur-X/ZUGFeRD CII XML (EN 16931).
Vite + React + TypeScript, plain CSS, no server, no runtime API keys, light theme.
`npm run dev` → http://localhost:5173.

## Hard rules

1. **Everything stays client-side.** No fetches to any origin at runtime (the CSP in
   `public/_headers` enforces it — only the Cloudflare analytics beacon is allowed).
   User data lives in `localStorage` only; "your data never leaves your device" is a
   published promise, not an implementation detail.
2. **All money math is integer cents** (unit prices: integer 1/10000 €). Never use
   floats for amounts. `src/model/compute.ts` → `computeTotals()` is the single source
   of truth feeding BOTH the PDF layout and the CII XML — never compute totals anywhere
   else, or the two documents can disagree (which validators treat as a broken invoice).
3. **Tax-case note texts are fixed, vetted strings** in `src/doc-i18n/` (§19 UStG,
   Reverse-Charge §13b, innergem. Lieferung, Ausfuhr). Never generate or reword legal
   text; the site ships a "keine Steuerberatung" disclaimer and these exact wordings.
4. **PDF/A-3 conformance is validator-proven, not assumed.** Any change to `src/pdf/`
   or `src/cii/` requires re-running the golden-sample validation (`npm run
   validate:einvoice`, Mustangproject CLI = veraPDF + EN 16931 schematron). PDF/A
   forbids non-embedded fonts — only the subsetted TTFs in `src/assets/fonts/`, never
   the pdf-lib Standard-14 fonts.
5. **The PDF module stays a lazy chunk** (`import('./pdf/generate')` on download).
   Landing page uses `system-ui`; no webfont on the first-paint path.
6. **Licence is MIT (per-site)**; fonts OFL 1.1. Do not add GPL dependencies.

## Layout

- `src/model/` — invoice types, totals, §14 UStG validation, tax cases
- `src/cii/` — model → EN 16931 CII XML (dependency-free)
- `src/pdf/` — DIN 5008 Form B layout, PDF/A-3 + Factur-X via @cantoo/pdf-lib (lazy)
- `src/state/` — hand-rolled useSyncExternalStore store, versioned localStorage envelope
- `src/i18n/` — UI strings (German), typed catalog; `src/doc-i18n/` — document labels DE/EN
- `tools/` — font subsetting, golden-sample generator, Mustang validation driver
- SEO content is static HTML in `index.html` below `#root`; legal pages are static files
  in `public/` outside the SPA.

## Before you call it done

```bash
npx tsc --noEmit            # strict; noUncheckedIndexedAccess is on
npm run build               # must succeed
npm run validate:einvoice   # if src/pdf/ or src/cii/ or src/model/ changed (Phase C+)
```

Monetization guardrails: affiliate links carry a visible "Anzeige/Affiliate-Link" label
and `rel="sponsored noopener"`; no money link ships before `public/impressum.html`
exists. No ads, no accounts, no paywall — ever.
