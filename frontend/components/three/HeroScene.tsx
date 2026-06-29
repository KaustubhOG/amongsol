"use client";

import { ReactNode, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Stars, ContactShadows, Float } from "@react-three/drei";
import * as THREE from "three";
import Crewmate3D from "./Crewmate3D";
import { useMounted } from "@/lib/useMounted";
import sound from "@/lib/sound";

// Tilts its children toward the pointer for a parallax feel.
function ParallaxRig({ children }: { children: ReactNode }) {
  const rig = useRef<THREE.Group>(null);
  useFrame((state) => {
    if (!rig.current) return;
    const targetY = state.pointer.x * 0.35;
    const targetX = -state.pointer.y * 0.16;
    rig.current.rotation.y += (targetY - rig.current.rotation.y) * 0.05;
    rig.current.rotation.x += (targetX - rig.current.rotation.x) * 0.05;
  });
  return <group ref={rig}>{children}</group>;
}

function Planet({
  position,
  color,
  radius,
  ring,
}: {
  position: [number, number, number];
  color: string;
  radius: number;
  ring?: boolean;
}) {
  const ref = useRef<THREE.Group>(null);
  useFrame((state) => {
    if (ref.current) ref.current.rotation.y = state.clock.elapsedTime * 0.12;
  });
  return (
    <group ref={ref} position={position}>
      <mesh>
        <sphereGeometry args={[radius, 32, 32]} />
        <meshStandardMaterial color={color} roughness={0.8} metalness={0.1} />
      </mesh>
      {ring && (
        <mesh rotation={[Math.PI / 2.6, 0, 0.3]}>
          <torusGeometry args={[radius * 1.7, radius * 0.08, 12, 60]} />
          <meshStandardMaterial color="#b9c6ff" roughness={0.6} transparent opacity={0.6} />
        </mesh>
      )}
    </group>
  );
}

function SolCoin() {
  const group = useRef<THREE.Group>(null);
  useFrame((state) => {
    if (group.current) group.current.rotation.y = state.clock.elapsedTime * 1.4;
  });
  return (
    <Float speed={2.4} floatIntensity={0.8} rotationIntensity={0}>
      <group ref={group} position={[0, 1.9, -0.4]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.66, 0.66, 0.12, 44]} />
          <meshStandardMaterial color="#ffce4d" metalness={0.9} roughness={0.22} emissive="#7a5200" emissiveIntensity={0.3} />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
          <torusGeometry args={[0.66, 0.05, 12, 44]} />
          <meshStandardMaterial color="#fff0b0" metalness={0.9} roughness={0.2} />
        </mesh>
      </group>
    </Float>
  );
}

const crew: Array<{ color: string; position: [number, number, number]; scale: number }> = [
  { color: "red", position: [0, -0.2, 0.7], scale: 1.4 },
  { color: "blue", position: [-2.7, 0.2, -0.3], scale: 0.98 },
  { color: "green", position: [2.7, 0.1, -0.3], scale: 0.98 },
  { color: "purple", position: [-4.4, -0.3, -1.6], scale: 0.8 },
  { color: "yellow", position: [4.4, -0.2, -1.6], scale: 0.8 },
];

export default function HeroScene({ className }: { className?: string }) {
  const mounted = useMounted();
  if (!mounted) return <div className={className} aria-hidden />;

  return (
    <div className={className}>
      <Canvas camera={{ position: [0, 0.4, 8.2], fov: 40 }} dpr={[1, 2]} gl={{ antialias: true, alpha: true }}>
        <ambientLight intensity={0.62} />
        <directionalLight position={[4, 7, 6]} intensity={1.5} />
        <pointLight position={[-7, 3, 4]} intensity={0.8} color="#4cc9ff" />
        <pointLight position={[7, -2, 3]} intensity={0.55} color="#ff4d6d" />

        <Stars radius={70} depth={45} count={1800} factor={3.2} saturation={0} fade speed={0.7} />

        <ParallaxRig>
          <Planet position={[-7.5, 3.4, -9]} color="#3a4d8f" radius={1.5} ring />
          <Planet position={[8.2, -2.6, -11]} color="#7a4a9c" radius={2.1} />

          <SolCoin />
          {crew.map((member, index) => (
            <Float key={member.color} speed={1.6} rotationIntensity={0.15} floatIntensity={0.4}>
              <Crewmate3D
                color={member.color}
                position={member.position}
                scale={member.scale}
                phase={index * 1.7}
                interactive
                dance
                onPoke={() => sound.pop(index)}
              />
            </Float>
          ))}
        </ParallaxRig>

        <ContactShadows position={[0, -1.9, 0]} opacity={0.35} scale={16} blur={2.8} far={5} color="#000814" />
      </Canvas>
    </div>
  );
}
