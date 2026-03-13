import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { useFloorplanStore } from "../store/useFloorplanStore";

/**
 * Renders the uploaded floorplan image as a textured plane on the ground (Y=0).
 * The plane is sized according to the floorplan's real-world dimensions in meters,
 * multiplied by the user-adjustable scale factor.
 * The image is centered at the scene origin so users can scale it up/down
 * and match measurements against the walls being drawn.
 */
export function FloorplanPlane() {
    const floorplan = useFloorplanStore((s) => s.floorplan);

    if (!floorplan) return null;

    return <FloorplanPlaneInner floorplan={floorplan} />;
}

function FloorplanPlaneInner({
    floorplan,
}: {
    floorplan: NonNullable<
        ReturnType<typeof useFloorplanStore.getState>["floorplan"]
    >;
}) {
    const texture = useMemo(() => {
        const tex = new THREE.TextureLoader().load(floorplan.url);
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.minFilter = THREE.LinearFilter;
        tex.magFilter = THREE.LinearFilter;
        return tex;
    }, [floorplan.url]);

    // Clean up texture on unmount
    useEffect(() => {
        return () => {
            texture.dispose();
        };
    }, [texture]);

    const scale = floorplan.scale ?? 1;
    const scaledWidth = floorplan.widthMeters * scale;
    const scaledHeight = floorplan.heightMeters * scale;

    return (
        <mesh
            rotation={[-Math.PI / 2, 0, 0]}
            position={[0, -0.01, 0]}
            receiveShadow
        >
            <planeGeometry args={[scaledWidth, scaledHeight]} />
            <meshBasicMaterial
                map={texture}
                transparent
                opacity={floorplan.opacity}
                side={THREE.DoubleSide}
                depthWrite={false}
            />
        </mesh>
    );
}
