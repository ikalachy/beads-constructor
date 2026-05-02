import { useEffect, useRef, useState } from 'react';
import { useBraceletStore } from './store/useBraceletStore';
import { BraceletViewport } from './components/viewport/BraceletViewport';
import { ImageUploadModal } from './components/ui/ImageUploadModal';
import { BeadCatalogPanel } from './components/ui/BeadCatalogPanel';
import { calculateRows } from './engine/bracelet/gridCalculations';


function App() {
  const config = useBraceletStore((s) => s.config);
  const activeColor = useBraceletStore((s) => s.activeColor);
  const viewMode = useBraceletStore((s) => s.viewMode);
  const setConfig = useBraceletStore((s) => s.setConfig);
  const setActiveColor = useBraceletStore((s) => s.setActiveColor);
  const toggleViewMode = useBraceletStore((s) => s.toggleViewMode);
  const resetDesign = useBraceletStore((s) => s.resetDesign);
  const undo = useBraceletStore((s) => s.undo);
  const redo = useBraceletStore((s) => s.redo);
  const canUndo = useBraceletStore((s) => s.history.length > 0);
  const canRedo = useBraceletStore((s) => s.future.length > 0);
  const palette = useBraceletStore((s) => s.palette);
  const addPaletteColor = useBraceletStore((s) => s.addPaletteColor);
  const removePaletteColor = useBraceletStore((s) => s.removePaletteColor);
  const updatePaletteColor = useBraceletStore((s) => s.updatePaletteColor);
  const snapMode = useBraceletStore((s) => s.snapMode);
  const toggleSnapMode = useBraceletStore((s) => s.toggleSnapMode);
  const resetPalette = useBraceletStore((s) => s.resetPalette);

  const [modalOpen, setModalOpen] = useState(false);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const rows = calculateRows(config.lengthCm, config.beadSizeMm);
  const totalBeads = rows * config.width;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setImageSrc(url);
    setModalOpen(true);
    e.target.value = '';
  };

  const handleModalClose = () => {
    setModalOpen(false);
    if (imageSrc) {
      URL.revokeObjectURL(imageSrc);
      setImageSrc(null);
    }
  };

  // Ctrl+Z / Ctrl+Y keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
      if ((e.metaKey || e.ctrlKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [undo, redo]);

  return (
    <div className="relative w-full h-full">
      <BraceletViewport />

      {/* Overlay Panel */}
      <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-sm rounded-lg shadow-lg p-4 w-64 space-y-4 text-sm">
        <h1 className="text-base font-semibold text-gray-800">Bracelet Designer</h1>

        {/* Width */}
        <div>
          <label className="block text-gray-600 mb-1">
            Width: {config.width} beads
          </label>
          <input
            type="range"
            min={5}
            max={20}
            value={config.width}
            onChange={(e) => setConfig({ width: Number(e.target.value) })}
            className="w-full"
          />
        </div>

        {/* Length */}
        <div>
          <label className="block text-gray-600 mb-1">
            Length: {config.lengthCm} cm
          </label>
          <input
            type="range"
            min={14}
            max={20}
            step={0.5}
            value={config.lengthCm}
            onChange={(e) => setConfig({ lengthCm: Number(e.target.value) })}
            className="w-full"
          />
        </div>

        {/* Bead Size */}
        <div>
          <label className="block text-gray-600 mb-1">Bead Size</label>
          <div className="flex flex-wrap gap-1.5">
            {[1, 2, 4, 6, 8].map((size) => (
              <button
                key={size}
                onClick={() => setConfig({ beadSizeMm: size })}
                className={`px-2 py-1 rounded text-xs font-medium ${
                  config.beadSizeMm === size
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                {size}mm
              </button>
            ))}
          </div>
        </div>

        {/* Color Palette */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-gray-600">Palette ({palette.length})</label>
            <button
              onClick={resetPalette}
              className="text-[10px] text-blue-600 hover:text-blue-800 font-medium"
            >
              Reset default
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {palette.map((color, i) => (
              <div key={i} className="relative group">
                <button
                  onClick={() => setActiveColor(color)}
                  onDoubleClick={() => {
                    const input = document.getElementById(`palette-edit-${i}`) as HTMLInputElement;
                    input?.click();
                  }}
                  className={`w-7 h-7 rounded-full border-2 ${
                    activeColor === color ? 'border-blue-500 scale-110' : 'border-gray-300'
                  }`}
                  style={{ backgroundColor: color }}
                  title="Click to select, double-click to edit"
                />
                <input
                  id={`palette-edit-${i}`}
                  type="color"
                  value={color}
                  onChange={(e) => updatePaletteColor(i, e.target.value)}
                  className="absolute top-0 left-0 w-0 h-0 opacity-0 pointer-events-none"
                />
                {palette.length > 1 && (
                  <button
                    onClick={(e) => { e.stopPropagation(); removePaletteColor(i); }}
                    className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-500 text-white rounded-full text-[8px] leading-none hidden group-hover:flex items-center justify-center"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
            {palette.length < 24 && (
              <button
                onClick={() => addPaletteColor(activeColor)}
                className="w-7 h-7 rounded-full border-2 border-dashed border-gray-300 text-gray-400 flex items-center justify-center text-sm hover:border-gray-400 hover:text-gray-500"
              >
                +
              </button>
            )}
          </div>
          <input
            type="color"
            value={activeColor}
            onChange={(e) => setActiveColor(e.target.value)}
            className="mt-2 w-full h-8 rounded cursor-pointer"
          />
          <label className="mt-2 flex items-center gap-2 cursor-pointer">
            <div
              className={`relative w-8 h-4 rounded-full transition-colors ${snapMode ? 'bg-amber-500' : 'bg-gray-300'}`}
              onClick={toggleSnapMode}
            >
              <div
                className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform ${snapMode ? 'translate-x-4' : 'translate-x-0.5'}`}
              />
            </div>
            <span className="text-xs text-gray-600">
              {snapMode ? 'Snapped to palette' : 'Snap to palette'}
            </span>
          </label>
        </div>

        {/* Undo / Redo */}
        <div className="flex gap-2">
          <button
            onClick={undo}
            disabled={!canUndo}
            className="flex-1 py-2 rounded bg-gray-200 text-gray-700 font-medium hover:bg-gray-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-xs"
          >
            Undo
          </button>
          <button
            onClick={redo}
            disabled={!canRedo}
            className="flex-1 py-2 rounded bg-gray-200 text-gray-700 font-medium hover:bg-gray-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-xs"
          >
            Redo
          </button>
        </div>

        {/* View Mode */}
        <button
          onClick={toggleViewMode}
          className="w-full py-2 rounded bg-indigo-500 text-white font-medium hover:bg-indigo-600 transition-colors"
        >
          {viewMode === 'flat' ? 'Show Wrapped' : 'Show Flat'}
        </button>

        {/* Upload Image */}
        <button
          onClick={() => fileInputRef.current?.click()}
          className="w-full py-2 rounded bg-emerald-500 text-white font-medium hover:bg-emerald-600 transition-colors"
        >
          Upload Image
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
        />

        {/* Reset */}
        <button
          onClick={resetDesign}
          className="w-full py-2 rounded bg-red-100 text-red-700 font-medium hover:bg-red-200 transition-colors"
        >
          Reset Design
        </button>

        {/* Info */}
        <div className="text-xs text-gray-500 border-t pt-2">
          <p>Rows: {rows} | Beads: {totalBeads}</p>
          <p>Grid: {config.width} x {rows}</p>
        </div>
      </div>

      {/* Right panel: Catalog beads needed */}
      <BeadCatalogPanel />

      {/* Image Upload Modal */}
      {modalOpen && imageSrc && (
        <ImageUploadModal imageSrc={imageSrc} onClose={handleModalClose} />
      )}
    </div>
  );
}

export default App;
