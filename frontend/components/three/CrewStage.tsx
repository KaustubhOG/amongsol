"use client";

import { Canvas } from "@react-three/fiber";
import { Stars, ContactShadows, Float } from "@react-three/drei";
import Crewmate3D from "./Crewmate3D";
import { useMounted } from "@/lib/useMounted";
import sound from "@/lib/sound";

export interface StageCrew {
  color: string;
  spin?: boolean;
  dead?: boolean;
}

interface CrewStageProps {
  crew: StageCrew[];
  className?: string;
  cameraZ?: number;
  spread?: number;
  interactive?: boolean;
}

// A reusable 3D stage. Mounts only on the client (after the first paint) so the
// WebGL canvas never runs during server rendering.
export default function CrewStage({ crew, className, cameraZ = 6.5, spread = 2.4, interactive = false }: CrewStageProps) {
  const mounted = useMounted();

  if (!mounted) {
    return <div className={className} aria-hidden />;
  }

  const count = Math.max(crew.length, 1);
  const step = count > 1 ? spread : 0;
  const offset = ((count - 1) * step) / 2;

  return (
    <div className={className}>
      <Canvas camera={{ position: [0, 0.2, cameraZ], fov: 42 }} dpr={[1, 2]} gl={{ antialias: true, alpha: true }}>
        <ambientLight intensity={0.65} />
        <directionalLight position={[4, 6, 5]} intensity={1.5} />
        <pointLight position={[-5, 2, 3]} intensity={0.8} color="#4cc9ff" />
        <pointLight position={[5, -2, 2]} intensity={0.5} color="#ff4d6d" />

        <Stars radius={60} depth={40} count={1400} factor={3} saturation={0} fade speed={0.6} />

        {crew.map((member, index) => (
          <Float
            key={`${member.color}-${index}`}
            speed={2}
            rotationIntensity={member.spin ? 0 : 0.25}
            floatIntensity={0.5}
          >
            <Crewmate3D
              color={member.color}
              position={[index * step - offset, 0, 0]}
              phase={index * 1.3}
              spin={member.spin}
              dead={member.dead}
              scale={count > 3 ? 0.82 : 1}
              interactive={interactive}
              onPoke={() => sound.pop(index)}
            />
          </Float>
        ))}

        <ContactShadows position={[0, -1.7, 0]} opacity={0.35} scale={12} blur={2.6} far={4} color="#000814" />
      </Canvas>
    </div>
  );
}
