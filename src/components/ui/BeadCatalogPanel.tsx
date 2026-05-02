import { useEffect, useMemo, useState } from 'react';
import { useBraceletStore } from '../../store/useBraceletStore';

interface CatalogBead {
  id: string;
  code: string;
  name: string;
  finish: string;
  family: string;
  photoUrl: string;
  /** Preciosa product detail page when present */
  productUrl?: string;
  hex: string;
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

export function BeadCatalogPanel() {
  const beads = useBraceletStore((s) => s.beads);
  const [catalog, setCatalog] = useState<CatalogBead[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/preciosa-colors.json')
      .then((r) => r.json())
      .then((data: CatalogBead[]) => {
        setCatalog(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // Count unique colors used in the bracelet
  const colorCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const row of beads) {
      for (const bead of row) {
        const c = bead.color.toLowerCase();
        counts.set(c, (counts.get(c) || 0) + 1);
      }
    }
    return counts;
  }, [beads]);

  // Match each unique color to a catalog bead
  const neededBeads = useMemo(() => {
    if (catalog.length === 0) return [];
    const results: { color: string; count: number; catalogBead: CatalogBead }[] = [];
    for (const [color, count] of colorCounts) {
      const match = findClosestCatalogBead(color, catalog);
      if (match) {
        results.push({ color, count, catalogBead: match });
      }
    }
    // Sort by count descending
    results.sort((a, b) => b.count - a.count);
    return results;
  }, [colorCounts, catalog]);

  // Group by catalog bead code (multiple bracelet colors might map to same bead)
  const grouped = useMemo(() => {
    const map = new Map<string, { catalogBead: CatalogBead; totalCount: number; colors: string[] }>();
    for (const item of neededBeads) {
      const existing = map.get(item.catalogBead.code);
      if (existing) {
        existing.totalCount += item.count;
        existing.colors.push(item.color);
      } else {
        map.set(item.catalogBead.code, {
          catalogBead: item.catalogBead,
          totalCount: item.count,
          colors: [item.color],
        });
      }
    }
    const arr = Array.from(map.values());
    arr.sort((a, b) => b.totalCount - a.totalCount);
    return arr;
  }, [neededBeads]);

  if (loading) {
    return (
      <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm rounded-lg shadow-lg p-4 w-64">
        <p className="text-xs text-gray-500">Loading catalog...</p>
      </div>
    );
  }

  return (
    <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm rounded-lg shadow-lg p-4 w-72 max-h-[calc(100vh-2rem)] flex flex-col">
      <h2 className="text-sm font-semibold text-gray-800 mb-1">Beads Needed</h2>
      <p className="text-[10px] text-gray-500 mb-3">
        {grouped.length} colors from Preciosa catalog
      </p>

      <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
        {grouped.map((item) => (
          <a
            key={item.catalogBead.code}
            href={
              item.catalogBead.productUrl ||
              `https://catalog.preciosa-ornela.com/catalog-beads#colour=${item.catalogBead.code}`
            }
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 p-2 rounded-lg bg-gray-50 border border-gray-100 hover:bg-blue-50 hover:border-blue-200 transition-colors"
          >
            {/* Color swatch */}
            <div
              className="w-8 h-8 rounded-full shrink-0 border border-gray-200"
              style={{ backgroundColor: item.catalogBead.hex }}
            />

            {/* Info */}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-gray-800 truncate">
                {item.catalogBead.name}
              </p>
              <p className="text-[10px] text-blue-600">
                {item.catalogBead.code} · {item.catalogBead.finish}
              </p>
              <p className="text-[10px] text-gray-400">
                {item.totalCount} bead{item.totalCount !== 1 ? 's' : ''}
              </p>
            </div>

            {/* Bracelet colors that map to this bead */}
            <div className="flex flex-col gap-0.5 shrink-0">
              {item.colors.slice(0, 3).map((c, i) => (
                <div
                  key={i}
                  className="w-3 h-3 rounded-sm border border-gray-200"
                  style={{ backgroundColor: c }}
                  title={c}
                />
              ))}
              {item.colors.length > 3 && (
                <span className="text-[8px] text-gray-400">+{item.colors.length - 3}</span>
              )}
            </div>
          </a>
        ))}

        {grouped.length === 0 && (
          <p className="text-xs text-gray-400 text-center py-4">No beads in design yet</p>
        )}
      </div>
    </div>
  );
}
