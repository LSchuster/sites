/**
 * Fuzzy polity-name matching, shared by the runtime (belligerent tinting,
 * involvement lists) and the build pipeline (cross-snapshot entity identity).
 *
 * This is unavoidably fuzzy. The border data calls it "United Kingdom of Great
 * Britain and Ireland" in 1914 and the conflict record says "United Kingdom";
 * elsewhere it is "German Empire" against "Germany", or "Russian Empire" against
 * "Russia". Exact matching finds almost nothing.
 *
 * So: names are reduced to significant tokens (dropping the structural words that
 * appear in half of all state names — empire, kingdom, republic, union…) and two
 * names match if any pair of their tokens agree on a five-character prefix. That
 * pairs germany/german and russia/russian without pairing germany/georgia.
 *
 * Deliberately dependency-free: the pipeline imports this module directly and
 * must not drag runtime data loading along with it.
 */

const STOPWORDS = new Set([
  'the', 'of', 'and', 'empire', 'kingdom', 'republic', 'union', 'states', 'state',
  'confederation', 'federation', 'dynasty', 'caliphate', 'sultanate', 'khanate',
  'duchy', 'principality', 'commonwealth', 'people', 'peoples', 'democratic',
  'socialist', 'soviet', 'great', 'new', 'north', 'south', 'east', 'west',
  'northern', 'southern', 'eastern', 'western', 'upper', 'lower', 'greater',
]);

export const PREFIX = 5;

function tokens(name: string): string[] {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 4 && !STOPWORDS.has(t));
}

const tokenCache = new Map<string, string[]>();

export function tokensOf(name: string): string[] {
  let t = tokenCache.get(name);
  if (!t) {
    t = tokens(name);
    tokenCache.set(name, t);
  }
  return t;
}

export function namesMatch(a: string, b: string): boolean {
  const ta = tokensOf(a);
  const tb = tokensOf(b);
  if (!ta.length || !tb.length) return false;
  for (const x of ta) {
    for (const y of tb) {
      if (x === y) return true;
      const n = Math.min(PREFIX, x.length, y.length);
      if (n >= PREFIX && x.slice(0, n) === y.slice(0, n)) return true;
    }
  }
  return false;
}
