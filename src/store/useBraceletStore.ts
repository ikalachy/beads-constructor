import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Bead, BeadMaterialType, BraceletConfig, ViewMode, ToolType } from '../types';
import { createGrid, resizeGrid } from '../engine/bracelet/gridCalculations';

const MAX_HISTORY = 50;

// Preciosa Ornela seed bead colors
const DEFAULT_PALETTE = [
  '#ffffff', // chalkwhite
  '#ffff00', // yellow
  '#ffa400', // orange
  '#ff64b4', // pink
  '#ff0000', // red
  '#f7f7df', // beige
  '#e6e6e6', // crystal
  '#d4af37', // gold
  '#c0c0c0', // silver
  '#b87333', // copper
  '#b08d57', // bronze
  '#808080', // grey
  '#8000ff', // violet
  '#5f615f', // hematite
  '#422100', // brown
  '#2accc2', // blue-green
  '#008200', // green
  '#0000ff', // blue
  '#000000', // black
];

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

/** Perceptual color distance using redmean weighted Euclidean */
function colorDistance(r1: number, g1: number, b1: number, r2: number, g2: number, b2: number): number {
  const rMean = (r1 + r2) / 2;
  const dr = r1 - r2;
  const dg = g1 - g2;
  const db = b1 - b2;
  return (2 + rMean / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rMean) / 256) * db * db;
}

function nearestPaletteColor(color: string, palette: string[]): string {
  const [r, g, b] = hexToRgb(color);
  let best = palette[0];
  let bestDist = Infinity;
  for (const p of palette) {
    const [pr, pg, pb] = hexToRgb(p);
    const dist = colorDistance(r, g, b, pr, pg, pb);
    if (dist < bestDist) {
      bestDist = dist;
      best = p;
    }
  }
  return best;
}

interface BraceletState {
  config: BraceletConfig;
  beads: Bead[][];
  activeColor: string;
  activeMaterial: BeadMaterialType;
  viewMode: ViewMode;
  selectedTool: ToolType;
  palette: string[];
  snapMode: boolean;
  preSnapBeads: Bead[][] | null;

  // Undo/redo
  history: Bead[][][];
  future: Bead[][][];

  setConfig: (partial: Partial<BraceletConfig>) => void;
  paintBead: (row: number, col: number) => void;
  applyImageColors: (colors: string[][]) => void;
  setActiveColor: (color: string) => void;
  setActiveMaterial: (material: BeadMaterialType) => void;
  toggleViewMode: () => void;
  setSelectedTool: (tool: ToolType) => void;
  resetDesign: () => void;
  loadDesign: (config: BraceletConfig, beads: Bead[][]) => void;
  undo: () => void;
  redo: () => void;
  setPalette: (palette: string[]) => void;
  addPaletteColor: (color: string) => void;
  removePaletteColor: (index: number) => void;
  updatePaletteColor: (index: number, color: string) => void;
  resetPalette: () => void;
  toggleSnapMode: () => void;
}

const defaultConfig: BraceletConfig = {
  width: 7,
  lengthCm: 16,
  beadSizeMm: 6,
};

export const useBraceletStore = create<BraceletState>()(
  persist(
    (set) => ({
      config: defaultConfig,
      beads: createGrid(defaultConfig),
      activeColor: '#e74c3c',
      activeMaterial: 'glossy',
      viewMode: 'flat',
      selectedTool: 'paint',
      palette: DEFAULT_PALETTE,
      snapMode: false,
      preSnapBeads: null,
      history: [],
      future: [],

      setConfig: (partial) =>
        set((state) => {
          const newConfig = { ...state.config, ...partial };
          const newBeads = resizeGrid(state.beads, newConfig);
          return {
            config: newConfig,
            beads: newBeads,
            history: [...state.history, state.beads].slice(-MAX_HISTORY),
            future: [],
          };
        }),

      paintBead: (row, col) =>
        set((state) => {
          const newBeads = state.beads.map((r) => r.map((b) => ({ ...b })));
          if (newBeads[row]?.[col]) {
            newBeads[row][col] = {
              ...newBeads[row][col],
              color: state.activeColor,
              material: state.activeMaterial,
            };
          }
          return {
            beads: newBeads,
            history: [...state.history, state.beads].slice(-MAX_HISTORY),
            future: [],
          };
        }),

      applyImageColors: (colors) =>
        set((state) => {
          const newBeads = state.beads.map((r) => r.map((b) => ({ ...b })));
          for (let row = 0; row < colors.length; row++) {
            for (let col = 0; col < colors[row].length; col++) {
              if (newBeads[row]?.[col]) {
                newBeads[row][col] = { ...newBeads[row][col], color: colors[row][col] };
              }
            }
          }
          return {
            beads: newBeads,
            history: [...state.history, state.beads].slice(-MAX_HISTORY),
            future: [],
          };
        }),

      setActiveColor: (color) => set({ activeColor: color }),
      setActiveMaterial: (material) => set({ activeMaterial: material }),
      toggleViewMode: () =>
        set((state) => ({
          viewMode: state.viewMode === 'flat' ? 'wrapped' : 'flat',
        })),
      setSelectedTool: (tool) => set({ selectedTool: tool }),

      resetDesign: () =>
        set((state) => ({
          beads: createGrid(state.config),
          history: [...state.history, state.beads].slice(-MAX_HISTORY),
          future: [],
        })),

      loadDesign: (config, beads) =>
        set((state) => ({
          config,
          beads,
          history: [...state.history, state.beads].slice(-MAX_HISTORY),
          future: [],
        })),

      undo: () =>
        set((state) => {
          if (state.history.length === 0) return state;
          const previous = state.history[state.history.length - 1];
          return {
            beads: previous,
            history: state.history.slice(0, -1),
            future: [state.beads, ...state.future],
          };
        }),

      redo: () =>
        set((state) => {
          if (state.future.length === 0) return state;
          const next = state.future[0];
          return {
            beads: next,
            history: [...state.history, state.beads],
            future: state.future.slice(1),
          };
        }),

      toggleSnapMode: () =>
        set((state) => {
          if (state.snapMode) {
            // Turn OFF → restore original colors
            return {
              snapMode: false,
              beads: state.preSnapBeads || state.beads,
              preSnapBeads: null,
            };
          } else {
            // Turn ON → save originals, snap all beads to palette
            const snappedBeads = state.beads.map((r) =>
              r.map((b) => ({
                ...b,
                color: nearestPaletteColor(b.color, state.palette),
              }))
            );
            return {
              snapMode: true,
              preSnapBeads: state.beads,
              beads: snappedBeads,
            };
          }
        }),
      setPalette: (palette) => set({ palette }),
      addPaletteColor: (color) =>
        set((state) => {
          if (state.palette.length >= 24) return state;
          return { palette: [...state.palette, color] };
        }),
      removePaletteColor: (index) =>
        set((state) => {
          if (state.palette.length <= 1) return state;
          return { palette: state.palette.filter((_, i) => i !== index) };
        }),
      updatePaletteColor: (index, color) =>
        set((state) => {
          const newPalette = [...state.palette];
          newPalette[index] = color;
          return { palette: newPalette };
        }),
      resetPalette: () => set({ palette: DEFAULT_PALETTE }),
    }),
    {
      name: 'bracelet-design',
      partialize: (state) => ({
        config: state.config,
        beads: state.beads,
        activeColor: state.activeColor,
        activeMaterial: state.activeMaterial,
        viewMode: state.viewMode,
        selectedTool: state.selectedTool,
        palette: state.palette,
        snapMode: state.snapMode,
      }),
    }
  )
);
