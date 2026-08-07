// Tree → measurable traits. Everything the planet looks like is derived from
// this profile (plus the seed), so equal data always yields an equal world.

import { hashString } from '../gen/rng';
import type { DataNode, ParsedData } from './parse';

export interface DataProfile {
  parsed: ParsedData;
  seed: number;
  totalNodes: number;
  leafCount: number;
  containerCount: number;
  maxDepth: number;
  typeCounts: { number: number; string: number; boolean: number; null: number };
  /** numbers / leaves, 0..1 */
  numericRatio: number;
  /** arrays / containers, 0..1 */
  arrayRatio: number;
  /** normalized Shannon entropy of the raw characters, 0..1 */
  entropy: number;
  /** container children of the root — the "major structures" */
  topGroups: DataNode[];
}

export function profileData(parsed: ParsedData, rawText: string): DataProfile {
  let totalNodes = 0;
  let leafCount = 0;
  let containerCount = 0;
  let maxDepth = 0;
  let arrays = 0;
  const typeCounts = { number: 0, string: 0, boolean: 0, null: 0 };

  const stack: DataNode[] = [parsed.root];
  while (stack.length > 0) {
    const n = stack.pop()!;
    totalNodes++;
    if (n.depth > maxDepth) maxDepth = n.depth;
    if (n.children) {
      containerCount++;
      if (n.type === 'array') arrays++;
      for (const c of n.children) stack.push(c);
    } else {
      leafCount++;
      if (n.type === 'number' || n.type === 'string' || n.type === 'boolean' || n.type === 'null') {
        typeCounts[n.type]++;
      }
    }
  }

  // Character entropy over a bounded sample of the raw input.
  const sample = rawText.slice(0, 20_000);
  const freq = new Map<string, number>();
  for (const ch of sample) freq.set(ch, (freq.get(ch) ?? 0) + 1);
  let h = 0;
  for (const count of freq.values()) {
    const p = count / sample.length;
    h -= p * Math.log2(p);
  }
  const entropy = Math.min(1, h / 6.5); // ~6.5 bits ≈ very mixed text

  const topGroups = (parsed.root.children ?? []).filter((c) => c.children !== undefined);

  return {
    parsed,
    seed: hashString(rawText.slice(0, 200_000)) ^ (rawText.length >>> 0),
    totalNodes,
    leafCount: Math.max(1, leafCount),
    containerCount: Math.max(1, containerCount),
    maxDepth,
    typeCounts,
    numericRatio: typeCounts.number / Math.max(1, leafCount),
    arrayRatio: arrays / Math.max(1, containerCount),
    entropy,
    topGroups,
  };
}
