import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { ContactShadows } from "@react-three/drei";
import { useTimeOfDayStore } from "../store/useTimeOfDayStore";
import { computeAtmosphericLighting } from "./dayNightCycle";

interface DayNightLightingProps {
  /** Scene center X */
  centerX: number;
  /** Scene center Z */
  centerZ: number;
  /** Total building height */
  totalHeight: number;
  /** Scene extent (for positioning lights at appropriate distance) */
  extent: number;
}

/**
 * Replaces the static lighting setup in a scene with time-of-day-aware
 * atmospheric lighting. Reads from useTimeOfDayStore.
 *
 * When the day/night cycle is disabled, this component renders nothing
 * (the parent scene should render its own static lights).
 */
export function DayNightLighting({
  centerX,
  centerZ,
  totalHeight,
  extent,
}: DayNightLightingProps) {
  const timeOfDay = useTimeOfDayStore((s) => s.timeOfDay);
  const enabled = useTimeOfDayStore((s) => s.enabled);

  const sunRef = useRef<THREE.DirectionalLight>(null);
  const fillRef = useRef<THREE.DirectionalLight>(null);
  const ambientRef = useRef<THREE.AmbientLight>(null);
  const hemiRef = useRef<THREE.HemisphereLight>(null);
  const fogRef = useRef<THREE.Fog>(null);

  const atmo = useMemo(
    () => computeAtmosphericLighting(timeOfDay),
    [timeOfDay],
  );

  // Smooth colour transitions each frame
  useFrame(() => {
    if (!enabled) return;

    if (sunRef.current) {
      sunRef.current.color.lerp(new THREE.Color(atmo.sunColor), 0.1);
      sunRef.current.intensity = THREE.MathUtils.lerp(
        sunRef.current.intensity,
        atmo.sunIntensity,
        0.1,
      );
      // Position sun relative to scene center using sun direction
      const dist = Math.max(extent, 30);
      sunRef.current.position.set(
        centerX + atmo.sunDirection.x * dist,
        totalHeight + atmo.sunDirection.y * dist + 5,
        centerZ + atmo.sunDirection.z * dist,
      );
    }

    if (fillRef.current) {
      fillRef.current.color.lerp(new THREE.Color(atmo.fillColor), 0.1);
      fillRef.current.intensity = THREE.MathUtils.lerp(
        fillRef.current.intensity,
        atmo.fillIntensity,
        0.1,
      );
    }

    if (ambientRef.current) {
      ambientRef.current.color.lerp(new THREE.Color(atmo.ambientColor), 0.1);
      ambientRef.current.intensity = THREE.MathUtils.lerp(
        ambientRef.current.intensity,
        atmo.ambientIntensity,
        0.1,
      );
    }

    if (hemiRef.current) {
      hemiRef.current.color.lerp(new THREE.Color(atmo.hemiSkyColor), 0.1);
      hemiRef.current.groundColor.lerp(
        new THREE.Color(atmo.hemiGroundColor),
        0.1,
      );
      hemiRef.current.intensity = THREE.MathUtils.lerp(
        hemiRef.current.intensity,
        atmo.hemiIntensity,
        0.1,
      );
    }

    if (fogRef.current) {
      fogRef.current.color.lerp(new THREE.Color(atmo.fogColor), 0.1);
    }
  });

  if (!enabled) return null;

  const shadowDist = Math.max(extent, 30);

  return (
    <>
      {/* Sun / key light */}
      <directionalLight
        ref={sunRef}
        position={[
          centerX + atmo.sunDirection.x * shadowDist,
          totalHeight + atmo.sunDirection.y * shadowDist + 5,
          centerZ + atmo.sunDirection.z * shadowDist,
        ]}
        intensity={atmo.sunIntensity}
        color={atmo.sunColor}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-left={-30}
        shadow-camera-right={30}
        shadow-camera-top={30}
        shadow-camera-bottom={-30}
        shadow-camera-near={0.5}
        shadow-camera-far={100}
        shadow-bias={-0.0001}
      />

      {/* Fill light — opposite side */}
      <directionalLight
        ref={fillRef}
        position={[centerX - 15, totalHeight + 10, centerZ - 20]}
        intensity={atmo.fillIntensity}
        color={atmo.fillColor}
      />

      {/* Ambient */}
      <ambientLight
        ref={ambientRef}
        intensity={atmo.ambientIntensity}
        color={atmo.ambientColor}
      />

      {/* Hemisphere sky/ground bounce */}
      <hemisphereLight
        ref={hemiRef}
        args={[atmo.hemiSkyColor, atmo.hemiGroundColor, atmo.hemiIntensity]}
      />

      {/* Contact shadows */}
      <ContactShadows
        position={[centerX, 0.001, centerZ]}
        opacity={0.5}
        scale={50}
        blur={2}
        far={10}
      />

      {/* Fog */}
      <fog ref={fogRef} attach="fog" args={[atmo.fogColor, 50, 200]} />
    </>
  );
}
