import type { RoomComponent } from "../store/types";
import type { ThemeColors } from "../hooks/useThemeColors";

interface RoomComponent2DProps {
  component: RoomComponent;
  colors: ThemeColors;
}

/** Radius of the room component marker circle in meters. */
const MARKER_RADIUS = 0.08;
const MARKER_SEGMENTS = 16;
/** Slightly above the room fill polygon so markers are visible. */
const Y = 0.012;

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

/**
 * Renders a single room ceiling component as a colored circle in 2D build mode.
 * Position is the component's world (x, y) coordinates mapped to (x, Y, y) in
 * Three.js world space.
 */
export function RoomComponent2D({ component, colors }: RoomComponent2DProps) {
  const color = roomComponentColor(component.type, colors);

  return (
    <mesh
      position={[component.x, Y, component.y]}
      rotation={[-Math.PI / 2, 0, 0]}
    >
      <circleGeometry args={[MARKER_RADIUS, MARKER_SEGMENTS]} />
      <meshBasicMaterial color={color} depthWrite={false} />
    </mesh>
  );
}
