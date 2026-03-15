import type { WallComponent } from "../store/types";
import type { ComputedWallGeometry } from "./wallGeometryUtils";
import type { ThemeColors } from "../hooks/useThemeColors";

interface Component2DProps {
  component: WallComponent;
  geometry: ComputedWallGeometry;
  colors: ThemeColors;
}

/** Radius of the component marker circle in meters. */
const MARKER_RADIUS = 0.06;
const MARKER_SEGMENTS = 16;
const Y = 0.015;

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
 * Renders a single wall component as a small colored circle on the wall
 * center line in 2D build mode. Position is determined by the component's
 * `offset` projected along the wall direction.
 */
export function Component2D({ component, geometry, colors }: Component2DProps) {
  const { start, dirX, dirY } = geometry;

  // Position along wall center line at the component's offset
  const cx = start.x + dirX * component.offset;
  const cz = start.y + dirY * component.offset;

  const color = componentColor(component.type, colors);

  return (
    <mesh
      position={[cx, Y, cz]}
      rotation={[-Math.PI / 2, 0, 0]}
      renderOrder={2}
    >
      <circleGeometry args={[MARKER_RADIUS, MARKER_SEGMENTS]} />
      <meshBasicMaterial
        color={color}
        depthWrite={false}
        depthTest={false}
      />
    </mesh>
  );
}
