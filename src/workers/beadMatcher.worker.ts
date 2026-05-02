interface CatalogBead {
  id: string;
  code: string;
  name: string;
  finish: string;
  family: string;
  photoUrl: string;
  productUrl?: string;
  hex: string;
}

interface GroupedItem {
  catalogBead: CatalogBead;
  totalCount: number;
  colors: string[];
}

interface WorkerInput {
  beads: { color: string }[][];
  catalog: CatalogBead[];
  cache: Record<string, CatalogBead>;
}

interface WorkerOutput {
  grouped: GroupedItem[];
  newCacheEntries: Record<string, CatalogBead>;
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

function colorDistance(r1: number, g1: number, b1: number, r2: number, g2: number, b2: number): number {
  const rMean = (r1 + r2) / 2;
  const dr = r1 - r2;
  const dg = g1 - g2;
  const db = b1 - b2;
  return (2 + rMean / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rMean) / 256) * db * db;
}

function findClosestCatalogBead(hex: string, catalog: CatalogBead[]): CatalogBead | null {
  if (catalog.length === 0) return null;
  const [r, g, b] = hexToRgb(hex);
  let best = catalog[0];
  let bestDist = Infinity;
  for (const bead of catalog) {
    const [br, bg, bb] = hexToRgb(bead.hex);
    const dist = colorDistance(r, g, b, br, bg, bb);
    if (dist < bestDist) {
      bestDist = dist;
      best = bead;
    }
  }
  return best;
}

self.onmessage = (e: MessageEvent<WorkerInput>) => {
  const { beads, catalog, cache } = e.data;
  const cacheMap = new Map(Object.entries(cache));
  const newCacheEntries: Record<string, CatalogBead> = {};

  // Count unique colors
  const counts = new Map<string, number>();
  for (const row of beads) {
    for (const bead of row) {
      const c = bead.color.toLowerCase();
      counts.set(c, (counts.get(c) || 0) + 1);
    }
  }

  // Match colors
  const groupMap = new Map<string, GroupedItem>();
  for (const [color, count] of counts) {
    let match = cacheMap.get(color);
    if (!match) {
      match = findClosestCatalogBead(color, catalog)!;
      if (match) {
        cacheMap.set(color, match);
        newCacheEntries[color] = match;
      }
    }
    if (!match) continue;

    const existing = groupMap.get(match.code);
    if (existing) {
      existing.totalCount += count;
      existing.colors.push(color);
    } else {
      groupMap.set(match.code, {
        catalogBead: match,
        totalCount: count,
        colors: [color],
      });
    }
  }

  const grouped = Array.from(groupMap.values());
  grouped.sort((a, b) => b.totalCount - a.totalCount);

  const result: WorkerOutput = {
    grouped,
    newCacheEntries,
  };

  self.postMessage(result);
};
