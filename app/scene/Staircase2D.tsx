import { useMemo } from "react";
import * as THREE from "three";
import { useFloorplanStore } from "../store/useFloorplanStore";
import { Text } from "@react-three/drei";

/**
 * Renders a staircase opening in 2D as a dashed rectangle with a "Stairs" label
 * and a direction indicator (zigzag lines).
 */
export function Staircase2D({ staircaseId }: { staircaseId: string }) {
    const staircase = useFloorplanStore((s) => s.staircaseOpenings[staircaseId]);
    const selectedStaircaseId = useFloorplanStore((s) => s.selectedStaircaseId);
    const selectStaircaseOpening = useFloorplanStore((s) => s.selectStaircaseOpening);

    const isSelected = selectedStaircaseId === staircaseId;

    const outlineGeometry = useMemo(() => {
        if (!staircase) return null;
        const hw = staircase.width / 2;
        const hd = staircase.depth / 2;
        const points = [
            new THREE.Vector3(-hw, 0, -hd),
            new THREE.Vector3(hw, 0, -hd),
            new THREE.Vector3(hw, 0, hd),
            new THREE.Vector3(-hw, 0, hd),
            new THREE.Vector3(-hw, 0, -hd),
        ];
        return new THREE.BufferGeometry().setFromPoints(points);
    }, [staircase?.width, staircase?.depth]);

    // Stair direction lines (zigzag pattern)
    const stairLines = useMemo(() => {
        if (!staircase) return null;
        const hw = staircase.width / 2;
        const hd = staircase.depth / 2;
        const steps = 6;
        const stepDepth = staircase.depth / steps;
        const points: THREE.Vector3[] = [];
        for (let i = 0; i <= steps; i++) {
            const z = -hd + i * stepDepth;
            points.push(new THREE.Vector3(-hw * 0.8, 0, z));
            points.push(new THREE.Vector3(hw * 0.8, 0, z));
            // Break between lines
            if (i < steps) {
                points.push(new THREE.Vector3(hw * 0.8, 0, z));
                points.push(new THREE.Vector3(hw * 0.8, 0, z));
            }
        }
        return new THREE.BufferGeometry().setFromPoints(points);
    }, [staircase?.width, staircase?.depth]);

    if (!staircase || !outlineGeometry) return null;

    const color = isSelected ? "#fbbf24" : "#94a3b8";

    return (
        <group
            position={[staircase.position.x, 0.01, staircase.position.y]}
            rotation={[0, -staircase.rotation, 0]}
            onClick={(e) => {
                e.stopPropagation();
                selectStaircaseOpening(staircaseId);
            }}
        >
            {/* Dashed outline */}
            <line>
                <primitive object={outlineGeometry} attach="geometry" />
                <lineDashedMaterial
                    color={color}
                    dashSize={0.15}
                    gapSize={0.1}
                    linewidth={1}
                />
            </line>

            {/* Stair step lines */}
            {stairLines && (
                <lineSegments>
                    <primitive object={stairLines} attach="geometry" />
                    <lineBasicMaterial color={color} opacity={0.5} transparent />
                </lineSegments>
            )}

            {/* Label */}
            <Text
                position={[0, 0.02, 0]}
                rotation={[-Math.PI / 2, 0, 0]}
                fontSize={0.2}
                color={color}
                anchorX="center"
                anchorY="middle"
            >
                Stairs
            </Text>
        </group>
    );
}
