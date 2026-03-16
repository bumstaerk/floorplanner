import { useState, useCallback, useMemo } from "react";
import type { WallComponent } from "../store/types";
import { getLightState, colorTempToHex } from "../store/types";
import type { LightState } from "../store/types";
import type { ComputedWallGeometry } from "./wallGeometryUtils";
import type { ThemeColors } from "../hooks/useThemeColors";
import { useFloorplanStore } from "../store/useFloorplanStore";
import { LightControlPopup } from "./LightControlPopup";

interface Component3DProps {
  component: WallComponent;
  geometry: ComputedWallGeometry;
  colors: ThemeColors;
  /** Wall ID that owns this component — needed for store updates */
  wallId: string;
}

/** Returns the theme color token for a given component type. */
function componentColor(type: string, colors: ThemeColors): string {
  switch (type) {
    case "light":
      return colors.componentLight;
    case "sensor":
      return colors.componentSensor;
    case "outlet":
      return colors.componentOutlet;
    case "switch":
      return colors.componentSwitch;
    default:
      return colors.componentLight;
  }
}

/**
 * Compute the effective light colour based on the current LightState.
 * Returns the hex colour to use for emissive / pointLight.
 */
function getLightColor(ls: LightState): string {
  if (ls.colorMode === "rgb") return ls.rgb;
  return colorTempToHex(ls.colorTemp);
}

/**
 * Renders a single wall component as a small 3D shape on the wall surface.
 *
 * For light-type components:
 *   - Reads LightState from `meta.lightState`
 *   - Renders emissive glow and a pointLight when on
 *   - Shows a hover popup with on/off, brightness, and colour controls
 */
export function Component3D({
  component,
  geometry,
  colors,
  wallId,
}: Component3DProps) {
  const { start, dirX, dirY, normX, normY, thickness } = geometry;
  const updateComponent = useFloorplanStore((s) => s.updateComponent);

  const halfThick = thickness / 2;
  const faceMul = component.face === "left" ? 1 : -1;

  // Small outward nudge so flat shapes sit proud of the wall surface
  const surfaceNudge = 0.01;

  // World-space position on the wall face, nudged outward
  const wx =
    start.x +
    dirX * component.offset +
    normX * (halfThick + surfaceNudge) * faceMul;
  const wy = component.elevation;
  const wz =
    start.y +
    dirY * component.offset +
    normY * (halfThick + surfaceNudge) * faceMul;

  const color = componentColor(component.type, colors);

  // Rotation so flat shapes (outlet/switch) have their thin dimension
  // aligned with the wall normal
  const normalAngle = Math.atan2(normY, normX);

  // ── Light state ──
  const isLight = component.type === "light";
  const lightState = useMemo(
    () => (isLight ? getLightState(component.meta) : null),
    [isLight, component.meta],
  );

  const lightColor = useMemo(
    () => (lightState ? getLightColor(lightState) : color),
    [lightState, color],
  );

  // Click-to-open popup state
  const [popupOpen, setPopupOpen] = useState(false);
  const togglePopup = useCallback(() => setPopupOpen((v) => !v), []);
  const closePopup = useCallback(() => setPopupOpen(false), []);

  // Persist light state changes into the store via meta
  const handleLightChange = useCallback(
    (patch: Partial<LightState>) => {
      const current = getLightState(component.meta);
      const next = { ...current, ...patch };
      updateComponent(wallId, component.id, {
        meta: { ...component.meta, lightState: next },
      });
    },
    [wallId, component.id, component.meta, updateComponent],
  );

  // Light visual params
  const lightOn = lightState?.on ?? false;
  const brightnessFactor = lightOn ? (lightState?.brightness ?? 100) / 100 : 0;

  return (
    <group position={[wx, wy, wz]}>
      {component.type === "light" && (
        <>
          <mesh onClick={togglePopup}>
            <sphereGeometry args={[0.05, 16, 16]} />
            <meshStandardMaterial
              color={lightOn ? lightColor : "#666666"}
              emissive={lightOn ? lightColor : "#000000"}
              emissiveIntensity={lightOn ? 0.8 * brightnessFactor : 0}
              roughness={0.3}
              metalness={0.1}
            />
          </mesh>
          {/* Point light when on */}
          {lightOn && (
            <pointLight
              color={lightColor}
              intensity={1.5 * brightnessFactor}
              distance={3}
              decay={2}
            />
          )}
          {/* Click popup */}
          {popupOpen && lightState && (
            <LightControlPopup
              lightState={lightState}
              onChange={handleLightChange}
              onClose={closePopup}
            />
          )}
        </>
      )}
      {component.type === "sensor" && (
        <mesh>
          <octahedronGeometry args={[0.05, 0]} />
          <meshStandardMaterial
            color={color}
            roughness={0.4}
            metalness={0.2}
          />
        </mesh>
      )}
      {component.type === "outlet" && (
        <mesh rotation={[0, -normalAngle, 0]}>
          <boxGeometry args={[0.06, 0.06, 0.015]} />
          <meshStandardMaterial
            color={color}
            roughness={0.5}
            metalness={0.1}
          />
        </mesh>
      )}
      {component.type === "switch" && (
        <mesh rotation={[0, -normalAngle, 0]}>
          <boxGeometry args={[0.04, 0.08, 0.015]} />
          <meshStandardMaterial
            color={color}
            roughness={0.5}
            metalness={0.1}
          />
        </mesh>
      )}
    </group>
  );
}
