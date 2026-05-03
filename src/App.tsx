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
  const [settingsPanelOpen, setSettingsPanelOpen] = useState(false);
  const [catalogPanelOpen, setCatalogPanelOpen] = useState(false);
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

      {/* Mobile: Floating Action Buttons */}
      <div className="lg:hidden fixed bottom-4 left-4 right-4 flex gap-2 z-40 pointer-events-none">
        <button
          onClick={() => setSettingsPanelOpen(!settingsPanelOpen)}
          className="pointer-events-auto flex-1 py-3 rounded-lg bg-blue-600 text-white font-medium shadow-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
          </svg>
          Settings
        </button>
        <button
          onClick={() => setCatalogPanelOpen(!catalogPanelOpen)}
          className="pointer-events-auto flex-1 py-3 rounded-lg bg-emerald-600 text-white font-medium shadow-lg hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          Beads
        </button>
      </div>

      {/* Settings Panel - Desktop: always visible, Mobile: slide-in drawer */}
      <div className={`
        ${settingsPanelOpen ? 'fixed' : 'hidden'}
        lg:block lg:absolute
        inset-0 lg:inset-auto
        lg:top-4 lg:left-4 lg:w-64
        z-50 lg:z-auto
      `}>
        {/* Mobile backdrop */}
        <div
          className="lg:hidden absolute inset-0 bg-black/50 backdrop-blur-sm"
          onClick={() => setSettingsPanelOpen(false)}
        />

        {/* Panel content */}
        <div className={`
          absolute bottom-0 left-0 right-0 max-h-[85vh]
          lg:relative lg:w-full lg:h-auto lg:max-h-none
          bg-white/95 backdrop-blur-sm lg:bg-white/90
          rounded-t-2xl lg:rounded-lg shadow-2xl lg:shadow-lg
          flex flex-col
        `}>
          {/* Mobile: drag handle */}
          <div className="lg:hidden sticky top-0 bg-white/95 backdrop-blur-sm border-b border-gray-200 py-2 flex justify-center flex-shrink-0">
            <div className="w-12 h-1 bg-gray-300 rounded-full" />
          </div>

          <div className="p-4 space-y-4 text-sm overflow-y-auto flex-1 min-h-0">
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
          onClick={() => {
            fileInputRef.current?.click();
            // Close settings panel on mobile after clicking upload
            if (window.innerWidth < 1024) {
              setTimeout(() => setSettingsPanelOpen(false), 100);
            }
          }}
          className="w-full py-2 rounded bg-emerald-500 text-white font-medium hover:bg-emerald-600 transition-colors"
        >
          Upload Image
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
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

          {/* Mobile: Close button - sticky at bottom */}
          <div className="lg:hidden sticky bottom-0 p-4 pt-2 bg-white/95 backdrop-blur-sm border-t border-gray-200 flex-shrink-0">
            <button
              onClick={() => setSettingsPanelOpen(false)}
              className="w-full py-3 rounded-lg bg-gray-200 text-gray-700 font-medium hover:bg-gray-300 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>

      {/* Catalog Panel - Desktop: always visible, Mobile: slide-in drawer */}
      <BeadCatalogPanel
        isOpen={catalogPanelOpen}
        onClose={() => setCatalogPanelOpen(false)}
      />

      {/* Image Upload Modal */}
      {modalOpen && imageSrc && (
        <ImageUploadModal imageSrc={imageSrc} onClose={handleModalClose} />
      )}
    </div>
  );
}

export default App;
