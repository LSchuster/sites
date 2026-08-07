import { useSyncExternalStore } from 'react';
import type { Invoice, LineItem, Party, SellerProfile } from '../model/invoice';
import { emptyInvoice, emptyLine } from '../model/invoice';
import type { Envelope, Numbering, SavedClient } from './persist';
import { defaultNumbering, emptyEnvelope, loadEnvelope, saveEnvelope } from './persist';

/**
 * Hand-rolled store (mirrors the sites/conflicts pattern): a module-level
 * state object, subscribe/emit, and one useSyncExternalStore hook. The app
 * is a single form, so components subscribe to the whole state — renders are
 * cheap here, unlike the atlas's canvas loop.
 */
export interface AppState {
  invoice: Invoice;
  profile: SellerProfile | null;
  clients: SavedClient[];
  numbering: Numbering;
}

function initialState(): AppState {
  const env = loadEnvelope() ?? emptyEnvelope();
  const invoice = env.draft ?? emptyInvoice(env.profile ?? undefined);
  return {
    invoice,
    profile: env.profile,
    clients: env.clients,
    numbering: env.numbering,
  };
}

let state: AppState = initialState();
const listeners = new Set<() => void>();

function toEnvelope(s: AppState): Envelope {
  return {
    schemaVersion: 1,
    profile: s.profile,
    clients: s.clients,
    numbering: s.numbering,
    draft: s.invoice,
  };
}

function emit(): void {
  saveEnvelope(toEnvelope(state));
  for (const fn of listeners) fn();
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getState(): AppState {
  return state;
}

export function useAppState(): AppState {
  return useSyncExternalStore(subscribe, getState);
}

// ---- actions ---------------------------------------------------------------

function set(patch: Partial<AppState>): void {
  state = { ...state, ...patch };
  emit();
}

export function updateInvoice(patch: Partial<Invoice>): void {
  set({ invoice: { ...state.invoice, ...patch } });
}

export function updateSeller(patch: Partial<SellerProfile>): void {
  updateInvoice({ seller: { ...state.invoice.seller, ...patch } });
}

export function updateBuyer(patch: Partial<Party>): void {
  updateInvoice({ buyer: { ...state.invoice.buyer, ...patch } });
}

export function addLine(): void {
  updateInvoice({ lines: [...state.invoice.lines, emptyLine()] });
}

export function removeLine(id: string): void {
  updateInvoice({ lines: state.invoice.lines.filter((l) => l.id !== id) });
}

export function updateLine(id: string, patch: Partial<LineItem>): void {
  updateInvoice({
    lines: state.invoice.lines.map((l) => (l.id === id ? { ...l, ...patch } : l)),
  });
}

export function saveProfile(): void {
  set({ profile: state.invoice.seller });
}

export function saveClient(): void {
  const party = state.invoice.buyer;
  if (!party.name.trim()) return;
  const existing = state.clients.find((c) => c.label === party.name.trim());
  const client: SavedClient = {
    id: existing?.id ?? `C${Date.now().toString(36)}`,
    label: party.name.trim(),
    party,
  };
  set({
    clients: [...state.clients.filter((c) => c.id !== client.id), client].sort((a, b) =>
      a.label.localeCompare(b.label, 'de'),
    ),
  });
}

export function loadClient(id: string): void {
  const client = state.clients.find((c) => c.id === id);
  if (client) updateInvoice({ buyer: { ...client.party } });
}

export function suggestNumber(numbering: Numbering, issueDate: string): string {
  const year = issueDate.slice(0, 4);
  return numbering.pattern
    .replace('{YYYY}', year)
    .replace('{SEQ}', String(numbering.nextSeq).padStart(3, '0'));
}

/** Start a fresh invoice: keep profile, prefill next number, bump nothing yet. */
export function newInvoice(): void {
  const invoice = emptyInvoice(state.profile ?? state.invoice.seller);
  invoice.number = suggestNumber(state.numbering, invoice.issueDate);
  invoice.docLanguage = state.invoice.docLanguage;
  invoice.taxCase = state.invoice.taxCase;
  set({ invoice });
}

/** Called after a successful download: advance the sequence counter. */
export function bumpSequence(): void {
  set({ numbering: { ...state.numbering, nextSeq: state.numbering.nextSeq + 1 } });
}

/** Replace the whole state from an imported backup envelope. */
export function importEnvelope(env: Envelope): void {
  state = {
    invoice: env.draft ?? emptyInvoice(env.profile ?? undefined),
    profile: env.profile,
    clients: env.clients,
    numbering: env.numbering ?? defaultNumbering(),
  };
  emit();
}

export function exportEnvelope(): Envelope {
  return toEnvelope(state);
}
