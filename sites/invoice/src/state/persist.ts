import type { Invoice, SellerProfile } from '../model/invoice';

/**
 * Versioned localStorage envelope. Everything the user entrusts to us lives
 * under this single key; the same shape is used for JSON backup export.
 * Bump `schemaVersion` and extend `migrate` when the shape changes.
 */
export interface SavedClient {
  id: string;
  label: string;
  party: Invoice['buyer'];
}

export interface Numbering {
  /** Tokens: {YYYY} → issue year, {SEQ} → zero-padded sequence. */
  pattern: string;
  nextSeq: number;
}

export interface Envelope {
  schemaVersion: 1;
  profile: SellerProfile | null;
  clients: SavedClient[];
  numbering: Numbering;
  draft: Invoice | null;
}

const KEY = 'invoice.v1';

export function defaultNumbering(): Numbering {
  return { pattern: '{YYYY}-{SEQ}', nextSeq: 1 };
}

export function emptyEnvelope(): Envelope {
  return {
    schemaVersion: 1,
    profile: null,
    clients: [],
    numbering: defaultNumbering(),
    draft: null,
  };
}

function migrate(raw: unknown): Envelope | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const env = raw as Partial<Envelope>;
  switch (env.schemaVersion) {
    case 1:
      return {
        schemaVersion: 1,
        profile: env.profile ?? null,
        clients: Array.isArray(env.clients) ? env.clients : [],
        numbering: env.numbering ?? defaultNumbering(),
        draft: env.draft ?? null,
      };
    default:
      return null;
  }
}

export function loadEnvelope(): Envelope | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return migrate(JSON.parse(raw));
  } catch {
    // Private mode, disabled storage, or corrupt JSON — degrade gracefully.
    return null;
  }
}

let saveTimer: ReturnType<typeof setTimeout> | undefined;

export function saveEnvelope(env: Envelope): void {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(env));
    } catch {
      // Storage full or unavailable — the app keeps working in-memory.
    }
  }, 250);
}

/** Parse an imported backup file (same envelope shape). */
export function parseBackup(text: string): Envelope | null {
  try {
    return migrate(JSON.parse(text));
  } catch {
    return null;
  }
}
