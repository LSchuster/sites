// Input → normalized data tree. Accepts JSON, CSV/TSV, or free text and
// produces one uniform DataNode tree that the profiler and planet blueprint
// work from. Parsing is capped so a 50 MB paste cannot freeze the tab; the
// caps are recorded on the result so the UI can say "showing first N".

export type NodeType = 'object' | 'array' | 'number' | 'string' | 'boolean' | 'null';

export interface DataNode {
  /** Display name of this node (object key, array index, CSV column …). */
  key: string;
  /** Dot/bracket path from the root, e.g. `users[3].email`. */
  path: string;
  type: NodeType;
  /** Present on containers. */
  children?: DataNode[];
  /** Short printable preview, present on leaves. */
  preview?: string;
  /** Numeric value for number leaves (drives light intensity). */
  num?: number;
  /** Leaf count of the subtree (1 for leaves). */
  size: number;
  depth: number;
}

export interface ParsedData {
  root: DataNode;
  format: 'json' | 'csv' | 'text';
  bytes: number;
  truncated: boolean;
}

const MAX_BYTES = 4 * 1024 * 1024; // parse at most 4 MB of input
const MAX_NODES = 60_000; // hard cap on tree nodes
const MAX_CHILDREN = 2_000; // per-container cap
const MAX_DEPTH = 24;

class Budget {
  nodes = 0;
  truncated = false;
  spend(): boolean {
    if (this.nodes >= MAX_NODES) {
      this.truncated = true;
      return false;
    }
    this.nodes++;
    return true;
  }
}

function preview(v: unknown): string {
  const s = typeof v === 'string' ? v : String(v);
  return s.length > 80 ? s.slice(0, 77) + '…' : s;
}

function fromJson(value: unknown, key: string, path: string, depth: number, b: Budget): DataNode {
  if (depth < MAX_DEPTH && Array.isArray(value)) {
    const children: DataNode[] = [];
    const n = Math.min(value.length, MAX_CHILDREN);
    if (n < value.length) b.truncated = true;
    for (let i = 0; i < n; i++) {
      if (!b.spend()) break;
      children.push(fromJson(value[i], `[${i}]`, `${path}[${i}]`, depth + 1, b));
    }
    return { key, path, type: 'array', children, size: Math.max(1, children.reduce((s, c) => s + c.size, 0)), depth };
  }
  if (depth < MAX_DEPTH && value !== null && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);
    const children: DataNode[] = [];
    const n = Math.min(entries.length, MAX_CHILDREN);
    if (n < entries.length) b.truncated = true;
    for (let i = 0; i < n; i++) {
      if (!b.spend()) break;
      const [k, v] = entries[i]!;
      const childPath = path ? `${path}.${k}` : k;
      children.push(fromJson(v, k, childPath, depth + 1, b));
    }
    return { key, path, type: 'object', children, size: Math.max(1, children.reduce((s, c) => s + c.size, 0)), depth };
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return { key, path, type: 'number', preview: preview(value), num: value, size: 1, depth };
  }
  if (typeof value === 'boolean') {
    return { key, path, type: 'boolean', preview: String(value), size: 1, depth };
  }
  if (value === null || value === undefined) {
    return { key, path, type: 'null', preview: 'null', size: 1, depth };
  }
  return { key, path, type: 'string', preview: preview(value), size: 1, depth };
}

// ---------------------------------------------------------------------------
// CSV

function detectDelimiter(lines: string[]): string | null {
  for (const d of [',', ';', '\t', '|']) {
    const counts = lines.slice(0, 8).map((l) => countOutsideQuotes(l, d));
    const first = counts[0] ?? 0;
    if (first >= 1 && counts.every((c) => c === first)) return d;
  }
  return null;
}

function countOutsideQuotes(line: string, d: string): number {
  let n = 0, inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') inQ = !inQ;
    else if (c === d && !inQ) n++;
  }
  return n;
}

function splitCsvLine(line: string, d: string): string[] {
  const out: string[] = [];
  let cur = '', inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i]!;
    if (inQ) {
      if (c === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; }
        else inQ = false;
      } else cur += c;
    } else if (c === '"') inQ = true;
    else if (c === d) { out.push(cur); cur = ''; }
    else cur += c;
  }
  out.push(cur);
  return out;
}

const NUM_RE = /^-?\d{1,3}(?:[.,]\d{3})*(?:[.,]\d+)?$|^-?\d+(?:[.,]\d+)?(?:[eE][+-]?\d+)?$/;

function csvCell(raw: string): { type: NodeType; num?: number; preview: string } {
  const s = raw.trim();
  if (s === '') return { type: 'null', preview: '∅' };
  if (/^(true|false)$/i.test(s)) return { type: 'boolean', preview: s.toLowerCase() };
  if (NUM_RE.test(s)) {
    const n = parseFloat(s.replace(/,(?=\d{3}(\D|$))/g, '').replace(',', '.'));
    if (Number.isFinite(n)) return { type: 'number', num: n, preview: preview(s) };
  }
  return { type: 'string', preview: preview(s) };
}

function fromCsv(text: string, b: Budget): DataNode | null {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return null;
  const delim = detectDelimiter(lines);
  if (!delim) return null;

  const header = splitCsvLine(lines[0]!, delim).map((h, i) => h.trim() || `col${i + 1}`);
  if (header.length < 2) return null;

  const rows: DataNode[] = [];
  const nRows = Math.min(lines.length - 1, MAX_CHILDREN);
  if (nRows < lines.length - 1) b.truncated = true;
  for (let r = 0; r < nRows; r++) {
    if (!b.spend()) break;
    const cells = splitCsvLine(lines[r + 1]!, delim);
    const rowPath = `row[${r + 1}]`;
    const fields: DataNode[] = [];
    for (let c = 0; c < header.length; c++) {
      if (!b.spend()) break;
      const col = header[c]!;
      const cell = csvCell(cells[c] ?? '');
      fields.push({ key: col, path: `${rowPath}.${col}`, type: cell.type, preview: cell.preview, num: cell.num, size: 1, depth: 2 });
    }
    rows.push({ key: rowPath, path: rowPath, type: 'object', children: fields, size: Math.max(1, fields.length), depth: 1 });
  }
  return { key: 'rows', path: '', type: 'array', children: rows, size: Math.max(1, rows.reduce((s, r2) => s + r2.size, 0)), depth: 0 };
}

// ---------------------------------------------------------------------------
// Free text: paragraphs → groups, lines → items, words/numbers → leaves.

function fromText(text: string, b: Budget): DataNode {
  const paragraphs = text.split(/\r?\n\s*\r?\n/).map((p) => p.trim()).filter(Boolean).slice(0, 200);
  const groups: DataNode[] = [];
  for (let p = 0; p < paragraphs.length; p++) {
    if (!b.spend()) break;
    const para = paragraphs[p]!;
    const lines = para.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).slice(0, 120);
    const pPath = `¶${p + 1}`;
    const items: DataNode[] = [];
    for (let l = 0; l < lines.length; l++) {
      if (!b.spend()) break;
      const line = lines[l]!;
      const lPath = `${pPath}.line${l + 1}`;
      const numbers = line.match(/-?\d+(?:[.,]\d+)?/g) ?? [];
      const words = line.split(/\s+/).filter(Boolean);
      const leaves: DataNode[] = [];
      leaves.push({ key: `line${l + 1}`, path: lPath, type: 'string', preview: preview(line), size: 1, depth: 3 });
      for (let n = 0; n < Math.min(numbers.length, 20); n++) {
        if (!b.spend()) break;
        const num = parseFloat(numbers[n]!.replace(',', '.'));
        if (Number.isFinite(num)) {
          leaves.push({ key: numbers[n]!, path: `${lPath}#${n}`, type: 'number', num, preview: numbers[n]!, size: 1, depth: 3 });
        }
      }
      // Long lines carry more weight: every ~6 words adds a phantom leaf so
      // prose density shows up as planetary density.
      const extra = Math.min(30, Math.floor(words.length / 6));
      for (let e = 0; e < extra; e++) {
        if (!b.spend()) break;
        const w = words[Math.min(words.length - 1, e * 6)]!;
        leaves.push({ key: w, path: `${lPath}~${e}`, type: 'string', preview: preview(w), size: 1, depth: 3 });
      }
      items.push({ key: `line${l + 1}`, path: lPath, type: 'object', children: leaves, size: leaves.length || 1, depth: 2 });
    }
    groups.push({ key: pPath, path: pPath, type: 'array', children: items, size: Math.max(1, items.reduce((s, i2) => s + i2.size, 0)), depth: 1 });
  }
  if (groups.length === 0) {
    groups.push({ key: '¶1', path: '¶1', type: 'array', children: [{ key: 'line1', path: '¶1.line1', type: 'string', preview: preview(text.trim() || '…'), size: 1, depth: 2 }], size: 1, depth: 1 });
  }
  return { key: 'text', path: '', type: 'array', children: groups, size: Math.max(1, groups.reduce((s, g) => s + g.size, 0)), depth: 0 };
}

// ---------------------------------------------------------------------------

export function parseInput(raw: string, filename?: string): ParsedData {
  const bytes = new TextEncoder().encode(raw).length;
  let text = raw;
  let truncatedInput = false;
  if (text.length > MAX_BYTES) {
    text = text.slice(0, MAX_BYTES);
    truncatedInput = true;
  }
  const trimmed = text.trim();
  if (!trimmed) throw new Error('There is nothing to terraform — paste some data first.');

  const b = new Budget();
  const ext = filename?.toLowerCase().split('.').pop();

  // 1) JSON (also NDJSON: one JSON value per line)
  if (ext !== 'csv' && ext !== 'tsv') {
    try {
      const root = fromJson(JSON.parse(trimmed), 'root', '', 0, b);
      return { root, format: 'json', bytes, truncated: truncatedInput || b.truncated };
    } catch {
      const lines = trimmed.split(/\r?\n/).filter((l) => l.trim());
      if (lines.length > 1 && lines.every((l) => /^[[{]/.test(l.trim()))) {
        try {
          const arr = lines.map((l) => JSON.parse(l) as unknown);
          const root = fromJson(arr, 'root', '', 0, b);
          return { root, format: 'json', bytes, truncated: truncatedInput || b.truncated };
        } catch {
          /* fall through */
        }
      }
    }
  }

  // 2) CSV / TSV
  const csv = fromCsv(trimmed, b);
  if (csv) return { root: csv, format: 'csv', bytes, truncated: truncatedInput || b.truncated };

  // 3) Plain text
  return { root: fromText(trimmed, b), format: 'text', bytes, truncated: truncatedInput || b.truncated };
}
