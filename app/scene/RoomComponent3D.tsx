import type { RoomComponent } from "../store/types";
import type { ThemeColors } from "../hooks/useThemeColors";

interface RoomComponent3DProps {
  component: RoomComponent;
  /** Ceiling height in meters (Y position for ceiling-mounted components) */
  ceilingHeight: number;
  colors: ThemeColors;
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

/**
 * Renders a single room ceiling component as a 3D shape in preview mode.
 *
 * Position is at (x, ceilingHeight, y) in world space, facing downward.
 *
 * Shapes per type:
 *   - light:  sphere with emissive glow (hanging from ceiling)
 *   - sensor: octahedron (facing down from ceiling)
 */
export function RoomComponent3D({
  component,
  ceilingHeight,
  colors,
}: RoomComponent3DProps) {
  const color = roomComponentColor(component.type, colors);

  // Position: component (x, y) maps to world (x, ceilingHeight, y)
  // Offset slightly below ceiling so the shape is visible
  const yPos = ceilingHeight - 0.05;

  return (
    <group position={[component.x, yPos, component.y]}>
      {component.type === "light" && (
        <mesh>
          <sphereGeometry args={[0.06, 16, 16]} />
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
    </group>
  );
}
