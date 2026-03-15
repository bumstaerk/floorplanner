import type { WallComponent } from "../store/types";
import type { ComputedWallGeometry } from "./wallGeometryUtils";
import type { ThemeColors } from "../hooks/useThemeColors";

interface Component3DProps {
  component: WallComponent;
  geometry: ComputedWallGeometry;
  colors: ThemeColors;
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
 * Renders a single wall component as a small 3D shape on the wall surface.
 *
 * Position is determined by:
 *   - `offset` along the wall direction from the start point
 *   - `elevation` above the floor (Y axis)
 *   - `face` ("left"/"right") selects which side of the wall
 *
 * Shapes per type:
 *   - light:  sphere with emissive glow
 *   - sensor: octahedron (diamond-like)
 *   - outlet: flat box (rectangular plate)
 *   - switch: flat box, taller than wide
 */
export function Component3D({ component, geometry, colors }: Component3DProps) {
  const { start, dirX, dirY, normX, normY, thickness } = geometry;

  const halfThick = thickness / 2;
  const faceMul = component.face === "left" ? 1 : -1;

  // Small outward nudge so flat shapes sit proud of the wall surface
  // instead of being half-embedded inside the wall mesh.
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
  // aligned with the wall normal — the plate face is flush with the wall.
  // atan2(normY, normX) gives the angle of the wall normal in the XZ plane.
  const normalAngle = Math.atan2(normY, normX);

  return (
    <group position={[wx, wy, wz]}>
      {component.type === "light" && (
        <mesh>
          <sphereGeometry args={[0.05, 16, 16]} />
          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={0.8}
            roughness={0.3}
            metalness={0.1}
          />
        </mesh>
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
