import type { BeadMaterialType } from '../../types';

export interface MaterialProps {
  roughness: number;
  metalness: number;
  clearcoat?: number;
  clearcoatRoughness?: number;
}

export const materialPresets: Record<BeadMaterialType, MaterialProps> = {
  glossy: {
    roughness: 0.2,
    metalness: 0.0,
    clearcoat: 0.8,
    clearcoatRoughness: 0.1,
  },
  matte: {
    roughness: 0.9,
    metalness: 0.0,
  },
  metallic: {
    roughness: 0.3,
    metalness: 0.8,
  },
  pearl: {
    roughness: 0.3,
    metalness: 0.1,
    clearcoat: 1.0,
    clearcoatRoughness: 0.05,
  },
};
