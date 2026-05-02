import { useMemo, useState } from 'react';
import { Instances, Instance } from '@react-three/drei';
import { useBraceletStore } from '../../store/useBraceletStore';
import { getBeadPositionFlat, getBeadPositionWrapped } from '../../engine/bracelet/positionCalculations';
import { materialPresets } from '../../engine/materials/presets';
import type { Bead, BeadMaterialType } from '../../types';

function BeadInstance({
  bead,
  position,
  onPaint,
}: {
  bead: Bead;
  position: [number, number, number];
  onPaint: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <Instance
      position={position}
      color={bead.color}
      scale={hovered ? 1.15 : 1}
      onClick={(e) => {
        e.stopPropagation();
        onPaint();
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
        document.body.style.cursor = 'pointer';
      }}
      onPointerOut={() => {
        setHovered(false);
        document.body.style.cursor = 'auto';
      }}
    />
  );
}

function MaterialGroup({
  materialType,
  beads,
  beadRadius,
  viewMode,
  totalCols,
  beadSize,
}: {
  materialType: BeadMaterialType;
  beads: { bead: Bead; row: number; col: number }[];
  beadRadius: number;
  viewMode: 'flat' | 'wrapped';
  totalCols: number;
  beadSize: number;
}) {
  const paintBead = useBraceletStore((s) => s.paintBead);
  const preset = materialPresets[materialType];

  if (beads.length === 0) return null;

  return (
    <Instances limit={beads.length + 10} range={beads.length}>
      <sphereGeometry args={[beadRadius, 24, 24]} />
      <meshPhysicalMaterial
        roughness={preset.roughness}
        metalness={preset.metalness}
        clearcoat={preset.clearcoat ?? 0}
        clearcoatRoughness={preset.clearcoatRoughness ?? 0}
      />
      {beads.map(({ bead, row, col }) => {
        const position =
          viewMode === 'flat'
            ? getBeadPositionFlat(row, col, beadSize)
            : getBeadPositionWrapped(row, col, totalCols, beadSize);

        return (
          <BeadInstance
            key={bead.id}
            bead={bead}
            position={position}
            onPaint={() => paintBead(row, col)}
          />
        );
      })}
    </Instances>
  );
}

export function BeadInstances() {
  const beads = useBraceletStore((s) => s.beads);
  const config = useBraceletStore((s) => s.config);
  const viewMode = useBraceletStore((s) => s.viewMode);

  const beadSize = config.beadSizeMm / 10; // convert mm to scene units (cm-ish)
  const beadRadius = beadSize / 2;

  const grouped = useMemo(() => {
    const groups: Record<BeadMaterialType, { bead: Bead; row: number; col: number }[]> = {
      glossy: [],
      matte: [],
      metallic: [],
      pearl: [],
    };

    for (let row = 0; row < beads.length; row++) {
      for (let col = 0; col < beads[row].length; col++) {
        const bead = beads[row][col];
        groups[bead.material].push({ bead, row, col });
      }
    }
    return groups;
  }, [beads]);

  // Center the grid
  const totalRows = beads.length;
  const totalCols = config.width;
  const offsetX = ((totalCols - 1) * beadSize) / 2;
  const offsetY = ((totalRows - 1) * beadSize) / 2;

  return (
    <group position={viewMode === 'flat' ? [-offsetX, -offsetY, 0] : [0, -offsetY, 0]}>
      {(Object.keys(grouped) as BeadMaterialType[]).map((mat) => (
        <MaterialGroup
          key={mat}
          materialType={mat}
          beads={grouped[mat]}
          beadRadius={beadRadius}
          viewMode={viewMode}
          totalCols={totalCols}
          beadSize={beadSize}
        />
      ))}
    </group>
  );
}
