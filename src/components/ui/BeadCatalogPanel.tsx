import { useEffect, useRef, useState } from 'react';
import { useBraceletStore } from '../../store/useBraceletStore';
// @ts-ignore
import BeadMatcherWorker from '../../workers/beadMatcher.worker.ts?worker';

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

interface WorkerOutput {
  grouped: GroupedItem[];
  newCacheEntries: Record<string, CatalogBead>;
}

export function BeadCatalogPanel() {
  const beads = useBraceletStore((s) => s.beads);
  const [catalog, setCatalog] = useState<CatalogBead[]>([]);
  const [loading, setLoading] = useState(true);
  const [grouped, setGrouped] = useState<GroupedItem[]>([]);

  // Cache: color hex → closest catalog bead (persists across renders)
  const matchCacheRef = useRef<Record<string, CatalogBead>>({});
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    // Initialize worker
    workerRef.current = new BeadMatcherWorker();

    workerRef.current.onmessage = (e: MessageEvent<WorkerOutput>) => {
      const { grouped, newCacheEntries } = e.data;
      setGrouped(grouped);
      // Merge new cache entries
      matchCacheRef.current = { ...matchCacheRef.current, ...newCacheEntries };
    };

    return () => {
      workerRef.current?.terminate();
    };
  }, []);

  useEffect(() => {
    fetch('/preciosa-colors.json')
      .then((r) => r.json())
      .then((data: CatalogBead[]) => {
        setCatalog(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // Debounced computation of needed beads in worker
  useEffect(() => {
    if (catalog.length === 0 || !workerRef.current) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      workerRef.current!.postMessage({
        beads,
        catalog,
        cache: matchCacheRef.current,
      });
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [beads, catalog]);

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
            <div
              className="w-8 h-8 rounded-full shrink-0 border border-gray-200"
              style={{ backgroundColor: item.catalogBead.hex }}
            />
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
