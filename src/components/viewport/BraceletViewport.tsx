import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment } from '@react-three/drei';
import { BeadInstances } from './BeadInstances';

export function BraceletViewport() {
  return (
    <Canvas
      camera={{ position: [0, 0, 8], fov: 50 }}
      style={{ width: '100%', height: '100%' }}
    >
      <ambientLight intensity={0.4} />
      <directionalLight position={[5, 5, 5]} intensity={0.8} />
      <Environment preset="studio" />
      <OrbitControls makeDefault enableDamping dampingFactor={0.1} />
      <BeadInstances />
    </Canvas>
  );
}
