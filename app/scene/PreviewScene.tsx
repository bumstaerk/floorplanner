import {
    OrbitControls,
    PerspectiveCamera,
    ContactShadows,
} from "@react-three/drei";
import { useShallow } from "zustand/react/shallow";
import * as THREE from "three";
import { useFloorplanStore } from "../store/useFloorplanStore";
import { FloorplanPlane } from "./FloorplanPlane";
import { Wall3D } from "./Wall3D";
import { Room3D } from "./Room3D";

/**
 * A simple ground plane for the 3D preview so walls don't float in a void.
 */
function GroundPlane() {
    return (
        <mesh
            rotation={[-Math.PI / 2, 0, 0]}
            position={[0, -0.01, 0]}
            receiveShadow
        >
            <planeGeometry args={[200, 200]} />
            <meshStandardMaterial
                color="#1a1a2e"
                roughness={0.95}
                metalness={0}
            />
        </mesh>
    );
}

/**
 * Visible grid in the 3D preview for spatial reference.
 */
function PreviewGrid() {
    const grid = useFloorplanStore((s) => s.grid);

    if (!grid.visible) return null;

    return (
        <group position={[0, -0.005, 0]}>
            <gridHelper
                args={[grid.size, grid.divisions, "#334155", "#1e293b"]}
            />
        </group>
    );
}

/**
 * The 3D preview scene.
 *
 * Uses a perspective camera with OrbitControls so the user can freely rotate,
 * zoom, and pan to inspect the house from any angle.
 *
 * The walls drawn in build mode are extruded into 3D box meshes with proper
 * height and thickness. The floorplan image is still visible on the ground.
 *
 * Coordinate mapping:
 *   Floorplan 2D (x, y) → Three.js world (x, 0, z)
 *   Wall height extends along the Y axis from 0 to wall.height.
 */
export function PreviewScene() {
    const wallIds = useFloorplanStore(useShallow((s) => Object.keys(s.walls)));
    const roomIds = useFloorplanStore(useShallow((s) => Object.keys(s.rooms)));

    const corners = useFloorplanStore(useShallow((s) => s.corners));

    // Compute a rough center point from all corners so the camera orbits around the model
    const cornerList = Object.values(corners);
    let centerX = 0;
    let centerZ = 0;
    if (cornerList.length > 0) {
        let minX = Infinity;
        let maxX = -Infinity;
        let minZ = Infinity;
        let maxZ = -Infinity;
        for (const c of cornerList) {
            minX = Math.min(minX, c.position.x);
            maxX = Math.max(maxX, c.position.x);
            minZ = Math.min(minZ, c.position.y);
            maxZ = Math.max(maxZ, c.position.y);
        }
        centerX = (minX + maxX) / 2;
        centerZ = (minZ + maxZ) / 2;
    }

    // Estimate a good camera distance based on the model extent
    let extent = 10;
    if (cornerList.length >= 2) {
        let maxDist = 0;
        for (const c of cornerList) {
            const dx = c.position.x - centerX;
            const dz = c.position.y - centerZ;
            const dist = Math.sqrt(dx * dx + dz * dz);
            if (dist > maxDist) maxDist = dist;
        }
        extent = Math.max(5, maxDist * 2.5);
    }

    return (
        <>
            {/* Perspective camera positioned at an angle above and to the side */}
            <PerspectiveCamera
                makeDefault
                position={[
                    centerX + extent * 0.6,
                    extent * 0.5,
                    centerZ + extent * 0.6,
                ]}
                fov={50}
                near={0.1}
                far={1000}
            />

            {/* Full orbit controls for 3D inspection */}
            <OrbitControls
                target={[centerX, 1, centerZ]}
                enableDamping
                dampingFactor={0.12}
                minDistance={1}
                maxDistance={200}
                maxPolarAngle={Math.PI / 2 - 0.05} // Don't let camera go below ground
                minPolarAngle={0.1}
            />

            {/* Lighting setup */}
            <ambientLight intensity={0.4} />
            <directionalLight
                position={[centerX + 15, 20, centerZ + 10]}
                intensity={1.2}
                castShadow
                shadow-mapSize-width={2048}
                shadow-mapSize-height={2048}
                shadow-camera-left={-30}
                shadow-camera-right={30}
                shadow-camera-top={30}
                shadow-camera-bottom={-30}
                shadow-camera-near={0.5}
                shadow-camera-far={100}
            />
            <directionalLight
                position={[centerX - 10, 15, centerZ - 15]}
                intensity={0.4}
            />
            <hemisphereLight args={["#b1e1ff", "#b97a20", 0.3]} />

            {/* Contact shadows under the walls */}
            <ContactShadows
                position={[centerX, 0, centerZ]}
                opacity={0.4}
                scale={50}
                blur={2}
                far={10}
            />

            {/* Ground and grid */}
            <GroundPlane />
            <PreviewGrid />

            {/* Floorplan image on the ground */}
            <FloorplanPlane />

            {/* Detected rooms (floor labels) */}
            {roomIds.map((id) => (
                <Room3D key={id} roomId={id} />
            ))}

            {/* 3D extruded walls */}
            {wallIds.map((id) => (
                <Wall3D key={id} wallId={id} />
            ))}

            {/* Sky-like environment for realistic reflections */}
            <fog attach="fog" args={["#0f172a", 50, 200]} />
        </>
    );
}
