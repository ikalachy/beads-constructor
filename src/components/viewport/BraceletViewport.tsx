import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment } from '@react-three/drei';
import { BeadInstances } from './BeadInstances';
import { useMemo } from 'react';

export function BraceletViewport() {
  const isMobile = useMemo(() => {
    return typeof window !== 'undefined' && window.innerWidth < 1024;
  }, []);

  return (
    <Canvas
      camera={{ position: [0, 0, 8], fov: 50 }}
      style={{ width: '100%', height: '100%' }}
      dpr={isMobile ? [1, 1.5] : [1, 2]}
      performance={{ min: 0.5 }}
      gl={{
        antialias: !isMobile,
        powerPreference: isMobile ? 'low-power' : 'high-performance'
      }}
    >
      <ambientLight intensity={0.4} />
      <directionalLight position={[5, 5, 5]} intensity={0.8} />
      {!isMobile && <Environment preset="studio" />}
      <OrbitControls
        makeDefault
        enableDamping={!isMobile}
        dampingFactor={0.1}
        maxDistance={20}
        minDistance={3}
      />
      <BeadInstances />
    </Canvas>
  );
}
