export type BeadMaterialType = 'glossy' | 'matte' | 'metallic' | 'pearl';

export interface Bead {
  id: string;
  row: number;
  column: number;
  color: string;
  material: BeadMaterialType;
}

export interface BraceletConfig {
  width: number;       // 5-10 beads
  lengthCm: number;   // 14-20 cm
  beadSizeMm: number; // 4, 6, or 8 mm
}

export interface BraceletDesign {
  version: number;
  name: string;
  config: BraceletConfig;
  beads: Bead[][];
}

export type ViewMode = 'flat' | 'wrapped';
export type ToolType = 'paint' | 'fill' | 'select';
