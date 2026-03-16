import { useState, useCallback, useMemo } from "react";
import type { RoomComponent } from "../store/types";
import { getLightState, colorTempToHex } from "../store/types";
import type { LightState } from "../store/types";
import type { ThemeColors } from "../hooks/useThemeColors";
import { useFloorplanStore } from "../store/useFloorplanStore";
import { LightControlPopup } from "./LightControlPopup";

interface RoomComponent3DProps {
  component: RoomComponent;
  /** Ceiling height in meters (Y position for ceiling-mounted components) */
  ceilingHeight: number;
  colors: ThemeColors;
  /** Room ID that owns this component — needed for store updates */
  roomId: string;
}

/** Returns the theme color token for a given room component type. */
function roomComponentColor(type: string, colors: ThemeColors): string {
  switch (type) {
    case "light":
      return colors.componentLight;
    case "sensor":
      return colors.componentSensor;
    default:
      return colors.componentLight;
  }
}

/** Compute the effective light colour based on current LightState. */
function getLightColor(ls: LightState): string {
  if (ls.colorMode === "rgb") return ls.rgb;
  return colorTempToHex(ls.colorTemp);
}

/**
 * Renders a single room ceiling component as a 3D shape.
 *
 * For lights: reads LightState from meta, renders emissive glow + pointLight
 * when on, and shows a hover popup with controls.
 */
export function RoomComponent3D({
  component,
  ceilingHeight,
  colors,
  roomId,
}: RoomComponent3DProps) {
  const updateRoomComponent = useFloorplanStore((s) => s.updateRoomComponent);

  const color = roomComponentColor(component.type, colors);
  const yPos = ceilingHeight - 0.05;

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

  // Persist light state changes
  const handleLightChange = useCallback(
    (patch: Partial<LightState>) => {
      const current = getLightState(component.meta);
      const next = { ...current, ...patch };
      updateRoomComponent(roomId, component.id, {
        meta: { ...component.meta, lightState: next },
      });
    },
    [roomId, component.id, component.meta, updateRoomComponent],
  );

  const lightOn = lightState?.on ?? false;
  const brightnessFactor = lightOn ? (lightState?.brightness ?? 100) / 100 : 0;

  return (
    <group position={[component.x, yPos, component.y]}>
      {component.type === "light" && (
        <>
          <mesh
            onClick={togglePopup}
          >
            <sphereGeometry args={[0.06, 16, 16]} />
            <meshStandardMaterial
              color={lightOn ? lightColor : "#666666"}
              emissive={lightOn ? lightColor : "#000000"}
              emissiveIntensity={lightOn ? 0.8 * brightnessFactor : 0}
              roughness={0.3}
              metalness={0.1}
            />
          </mesh>
          {/* Point light when on — shines downward from ceiling */}
          {lightOn && (
            <pointLight
              color={lightColor}
              intensity={2.0 * brightnessFactor}
              distance={5}
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
    </group>
  );
}
