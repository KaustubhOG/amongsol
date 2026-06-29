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
  interactive?: boolean;
  dance?: boolean;
  onPoke?: () => void;
}

type Move = "jump" | "spin" | "wiggle" | "nod";

// A procedural Among Sol crewmate built from Three.js primitives. With `dance`
// it idles with sway plus randomly timed moves (jump, spin, wiggle, nod) and
// squash and stretch. With `interactive` it scales on hover and hops when poked.
export default function Crewmate3D({
  color,
  position = [0, 0, 0],
  scale = 1,
  phase = 0,
  spin = false,
  dead = false,
  interactive = false,
  dance = false,
  onPoke,
}: Crewmate3DProps) {
  const group = useRef<THREE.Group>(null);
  const hovered = useRef(false);
  const hoverK = useRef(1);
  const pokeAt = useRef(-10);
  const pokeRequested = useRef(false);
  const nextActionAt = useRef(-1);
  const actionStart = useRef(-10);
  const actionType = useRef<Move>("jump");
  const crew = crewColor(color);

  const bodyMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({ color: new THREE.Color(crew.base), roughness: 0.42, metalness: 0.08 }),
    [crew.base]
  );
  const shadeMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({ color: new THREE.Color(crew.shadow), roughness: 0.5, metalness: 0.05 }),
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
    const g = group.current;
    if (!g) return;
    const time = state.clock.elapsedTime;
    const t = time + phase;

    // Stagger the first dance action per instance using the deterministic phase.
    if (dance && nextActionAt.current < 0) nextActionAt.current = time + ((phase * 0.53) % 1.8);
    if (dance && time > nextActionAt.current) {
      const r = Math.random();
      actionType.current = r < 0.34 ? "jump" : r < 0.6 ? "spin" : r < 0.82 ? "wiggle" : "nod";
      actionStart.current = time;
      nextActionAt.current = time + 1.2 + Math.random() * 2.4;
    }

    if (pokeRequested.current) {
      pokeAt.current = time;
      pokeRequested.current = false;
    }

    let y = position[1] + Math.sin(t * 1.5) * 0.08;
    let rotY = Math.sin(t * 0.7) * 0.2;
    let rotZ = dead ? Math.PI * 0.12 : 0;
    let rotX = 0;
    let sx = 1;
    let sy = 1;

    // Poke hop with a quick spin.
    const sincePoke = time - pokeAt.current;
    if (sincePoke < 0.6) {
      const p = sincePoke / 0.6;
      y += Math.sin(p * Math.PI) * 0.55 * (1 - p);
      rotY += p * Math.PI * 2;
      sy += Math.sin(p * Math.PI) * 0.16;
      sx -= Math.sin(p * Math.PI) * 0.1;
    }

    if (dance && !spin) {
      rotZ += Math.sin(t * 2.2) * 0.1; // constant gentle sway
      const a = time - actionStart.current;
      if (actionType.current === "jump" && a < 0.6) {
        const p = a / 0.6;
        y += Math.sin(p * Math.PI) * 0.62;
        sy += Math.sin(p * Math.PI) * 0.2;
        sx -= Math.sin(p * Math.PI) * 0.12;
      } else if (actionType.current === "spin" && a < 0.85) {
        rotY += (a / 0.85) * Math.PI * 2;
      } else if (actionType.current === "wiggle" && a < 0.7) {
        rotZ += Math.sin(a * 30) * 0.24 * (1 - a / 0.7);
      } else if (actionType.current === "nod" && a < 0.6) {
        rotX += Math.sin(a * 16) * 0.2 * (1 - a / 0.6);
      }
    }

    const targetHover = hovered.current ? 1.16 : 1;
    hoverK.current += (targetHover - hoverK.current) * 0.18;
    const s = scale * hoverK.current;

    g.position.y = y;
    g.rotation.x = rotX;
    g.rotation.z = rotZ;
    if (spin) g.rotation.y += 0.015;
    else g.rotation.y = rotY;
    g.scale.set(s * sx, s * sy, s * sx);
  });

  const handlers = interactive
    ? {
        onPointerOver: (e: { stopPropagation: () => void }) => {
          e.stopPropagation();
          if (!hovered.current) {
            hovered.current = true;
            if (typeof document !== "undefined") document.body.style.cursor = "pointer";
          }
        },
        onPointerOut: () => {
          hovered.current = false;
          if (typeof document !== "undefined") document.body.style.cursor = "auto";
        },
        onClick: (e: { stopPropagation: () => void }) => {
          e.stopPropagation();
          pokeRequested.current = true;
          onPoke?.();
        },
      }
    : {};

  return (
    <group ref={group} position={position} {...handlers}>
      <mesh material={bodyMaterial} castShadow>
        <capsuleGeometry args={[0.62, 0.95, 12, 24]} />
      </mesh>
      <mesh material={bodyMaterial} position={[0, -0.1, 0.46]} scale={[0.82, 0.95, 0.5]}>
        <sphereGeometry args={[0.5, 24, 24]} />
      </mesh>
      <RoundedBox args={[0.62, 1.0, 0.42]} radius={0.16} smoothness={5} position={[0, -0.05, -0.62]}>
        <primitive object={shadeMaterial} attach="material" />
      </RoundedBox>
      <mesh material={visorMaterial} position={[0, 0.42, 0.5]} scale={[0.66, 0.46, 0.34]}>
        <sphereGeometry args={[0.5, 28, 28]} />
      </mesh>
      <mesh position={[0.14, 0.52, 0.74]} scale={[0.12, 0.09, 0.06]}>
        <sphereGeometry args={[0.5, 16, 16]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>
      <mesh material={bodyMaterial} position={[-0.3, -1.02, 0.02]}>
        <capsuleGeometry args={[0.22, 0.3, 8, 16]} />
      </mesh>
      <mesh material={bodyMaterial} position={[0.3, -1.02, 0.02]}>
        <capsuleGeometry args={[0.22, 0.3, 8, 16]} />
      </mesh>
    </group>
  );
}
