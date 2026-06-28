"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import { crewColor } from "@/lib/colors";

interface Crewmate3DProps {
  color: string;
  position?: [number, number, number];
  scale?: number;
  phase?: number;
  spin?: boolean;
  dead?: boolean;
}

// A procedural Among Sol crewmate assembled from Three.js primitives: a bean
// body, a glass visor, a backpack and two legs. No external model files needed.
export default function Crewmate3D({
  color,
  position = [0, 0, 0],
  scale = 1,
  phase = 0,
  spin = false,
  dead = false,
}: Crewmate3DProps) {
  const group = useRef<THREE.Group>(null);
  const crew = crewColor(color);

  const bodyMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(crew.base),
        roughness: 0.42,
        metalness: 0.08,
      }),
    [crew.base]
  );

  const shadeMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(crew.shadow),
        roughness: 0.5,
        metalness: 0.05,
      }),
    [crew.shadow]
  );

  const visorMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color("#bfe9ff"),
        roughness: 0.08,
        metalness: 0.2,
        emissive: new THREE.Color("#3aa9ff"),
        emissiveIntensity: 0.35,
      }),
    []
  );

  useFrame((state) => {
    if (!group.current) return;
    const t = state.clock.elapsedTime + phase;
    group.current.position.y = position[1] + Math.sin(t * 1.4) * 0.08;
    if (spin) {
      group.current.rotation.y += 0.015;
    } else {
      group.current.rotation.y = Math.sin(t * 0.7) * 0.22;
    }
    if (dead) {
      group.current.rotation.z = Math.PI * 0.12;
    }
  });

  return (
    <group ref={group} position={position} scale={scale}>
      {/* Body */}
      <mesh material={bodyMaterial} castShadow position={[0, 0, 0]}>
        <capsuleGeometry args={[0.62, 0.95, 12, 24]} />
      </mesh>

      {/* Belly highlight to give the bean some shading */}
      <mesh material={bodyMaterial} position={[0, -0.1, 0.46]} scale={[0.82, 0.95, 0.5]}>
        <sphereGeometry args={[0.5, 24, 24]} />
      </mesh>

      {/* Backpack */}
      <RoundedBox args={[0.62, 1.0, 0.42]} radius={0.16} smoothness={5} position={[0, -0.05, -0.62]}>
        <primitive object={shadeMaterial} attach="material" />
      </RoundedBox>

      {/* Visor */}
      <mesh material={visorMaterial} position={[0, 0.42, 0.5]} scale={[0.66, 0.46, 0.34]}>
        <sphereGeometry args={[0.5, 28, 28]} />
      </mesh>

      {/* Visor shine */}
      <mesh position={[0.14, 0.52, 0.74]} scale={[0.12, 0.09, 0.06]}>
        <sphereGeometry args={[0.5, 16, 16]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>

      {/* Legs */}
      <mesh material={bodyMaterial} position={[-0.3, -1.02, 0.02]}>
        <capsuleGeometry args={[0.22, 0.3, 8, 16]} />
      </mesh>
      <mesh material={bodyMaterial} position={[0.3, -1.02, 0.02]}>
        <capsuleGeometry args={[0.22, 0.3, 8, 16]} />
      </mesh>
    </group>
  );
}
