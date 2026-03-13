import { useMemo } from "react";
import * as THREE from "three";
import { Line } from "@react-three/drei";
import type { WallOpening, Point2D } from "../store/types";

/**
 * Height constant for all 2D opening indicators (just above walls).
 */
const Y = 0.015;

interface Opening2DProps {
    opening: WallOpening;
    /** Wall start corner position (2D floorplan coords) */
    wallStart: Point2D;
    /** Wall end corner position (2D floorplan coords) */
    wallEnd: Point2D;
    /** Wall thickness in meters */
    wallThickness: number;
    /** Wall total length in meters */
    wallLength: number;
    /** Whether the parent wall is currently selected */
    isWallSelected: boolean;
}

/**
 * Renders a single opening (door, window, or hole) on a wall in 2D build mode
 * using standard architectural floorplan conventions:
 *
 *   - **Door**: A gap in the wall with a quarter-circle arc showing swing direction,
 *     plus a thin line from the hinge point to the end of the swing.
 *
 *   - **Window**: A gap in the wall with three thin parallel lines across it
 *     (the classic floorplan window symbol representing the glass pane).
 *
 *   - **Hole**: A gap in the wall with short dashed lines indicating the break.
 *
 * All positions are computed in world-space (XZ plane, Y up) relative to the
 * wall's start/end corners and direction/normal vectors.
 *
 * Coordinate mapping:
 *   Floorplan 2D (x, y) → Three.js world (x, Y, z) where z = floorplan y.
 */
export function Opening2D({
    opening,
    wallStart,
    wallEnd,
    wallThickness,
    wallLength,
    isWallSelected,
}: Opening2DProps) {
    const data = useMemo(() => {
        const dx = wallEnd.x - wallStart.x;
        const dy = wallEnd.y - wallStart.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len < 1e-9) return null;

        // Unit direction along the wall (start → end)
        const dirX = dx / len;
        const dirY = dy / len;

        // Unit normal (perpendicular, pointing "left" / +normal side)
        const normX = -dirY;
        const normY = dirX;

        const halfT = wallThickness / 2;

        // Clamp the opening to the wall bounds
        const oLeft = Math.max(0, opening.offset);
        const oRight = Math.min(wallLength, opening.offset + opening.width);
        if (oRight <= oLeft) return null;

        const oWidth = oRight - oLeft;

        // Opening center along the wall
        const oCenter = (oLeft + oRight) / 2;

        // World position of the opening's start edge (along wall direction)
        const startWorld: Point2D = {
            x: wallStart.x + dirX * oLeft,
            y: wallStart.y + dirY * oLeft,
        };

        // World position of the opening's end edge
        const endWorld: Point2D = {
            x: wallStart.x + dirX * oRight,
            y: wallStart.y + dirY * oRight,
        };

        // World position of the opening's center
        const centerWorld: Point2D = {
            x: wallStart.x + dirX * oCenter,
            y: wallStart.y + dirY * oCenter,
        };

        // Determine the face direction: "left" face = +normal, "right" face = -normal
        const faceMul = opening.face === "left" ? 1 : -1;

        return {
            dirX,
            dirY,
            normX,
            normY,
            halfT,
            oWidth,
            oLeft,
            oRight,
            oCenter,
            startWorld,
            endWorld,
            centerWorld,
            faceMul,
        };
    }, [opening, wallStart, wallEnd, wallThickness, wallLength]);

    if (!data) return null;

    switch (opening.type) {
        case "door":
            return <Door2D data={data} isSelected={isWallSelected} />;
        case "window":
            return <Window2D data={data} isSelected={isWallSelected} />;
        case "hole":
            return <Hole2D data={data} isSelected={isWallSelected} />;
        default:
            return null;
    }
}

// ─── Shared types ──────────────────────────────────────────────────────────────

interface OpeningData {
    dirX: number;
    dirY: number;
    normX: number;
    normY: number;
    halfT: number;
    oWidth: number;
    oLeft: number;
    oRight: number;
    oCenter: number;
    startWorld: Point2D;
    endWorld: Point2D;
    centerWorld: Point2D;
    faceMul: number;
}

// ─── Door ──────────────────────────────────────────────────────────────────────

/**
 * 2D door symbol:
 *   - A white/clear gap in the wall fill where the door opening is
 *   - A thin line from the hinge point to the fully open position
 *   - A quarter-circle arc showing the door swing
 *
 * The hinge is at the start-edge of the opening on the face side.
 * The door swings 90° outward from the wall on the specified face.
 *
 *          hinge ─────── swing end
 *            │  ╲  arc  ╱
 *            │    ╲   ╱
 *            │     (sweep)
 *          wall
 */
function Door2D({
    data,
    isSelected,
}: {
    data: OpeningData;
    isSelected: boolean;
}) {
    const { arcPoints, hingePt, swingEndPt, gapQuad } = useMemo(() => {
        const {
            dirX,
            dirY,
            normX,
            normY,
            halfT,
            oWidth,
            startWorld,
            endWorld,
            faceMul,
        } = data;

        // Gap quad: a rectangle cut into the wall to show the opening.
        // The gap extends across the full wall thickness at the opening location.
        const gapLS: Point2D = {
            x: startWorld.x + normX * halfT,
            y: startWorld.y + normY * halfT,
        };
        const gapLE: Point2D = {
            x: endWorld.x + normX * halfT,
            y: endWorld.y + normY * halfT,
        };
        const gapRS: Point2D = {
            x: startWorld.x - normX * halfT,
            y: startWorld.y - normY * halfT,
        };
        const gapRE: Point2D = {
            x: endWorld.x - normX * halfT,
            y: endWorld.y - normY * halfT,
        };

        const gapQuad = { gapLS, gapLE, gapRS, gapRE };

        // Hinge point: at the start edge of the opening, on the face side of the wall
        const hingePt: Point2D = {
            x: startWorld.x + normX * halfT * faceMul,
            y: startWorld.y + normY * halfT * faceMul,
        };

        // The door swings outward from the face side.
        // Swing end point: perpendicular to the wall, at distance = oWidth from hinge
        const swingEndPt: Point2D = {
            x: hingePt.x + normX * oWidth * faceMul,
            y: hingePt.y + normY * oWidth * faceMul,
        };

        // Quarter-circle arc from the wall edge to the fully-open position.
        // The arc sweeps from the direction along the wall (toward the end) to
        // the direction perpendicular to the wall (outward on the face side).
        //
        // Arc center = hinge point
        // Arc radius = opening width
        // Start angle: along the wall direction (dirX, dirY)
        // End angle: perpendicular to wall on the face side (normX*faceMul, normY*faceMul)

        const segments = 24;
        const arcPoints: [number, number, number][] = [];

        // Angle of the wall direction
        const angleWall = Math.atan2(dirY, dirX);
        // Angle of the face normal
        const angleNorm = Math.atan2(normY * faceMul, normX * faceMul);

        // Figure out sweep direction: we want to go from angleWall to angleNorm
        // in the shorter arc direction (should be ~90°).
        let startAngle = angleWall;
        let endAngle = angleNorm;

        // Normalize the sweep to be within (-PI, PI]
        let sweep = endAngle - startAngle;
        while (sweep > Math.PI) sweep -= 2 * Math.PI;
        while (sweep < -Math.PI) sweep += 2 * Math.PI;

        for (let i = 0; i <= segments; i++) {
            const t = i / segments;
            const a = startAngle + sweep * t;
            const px = hingePt.x + Math.cos(a) * oWidth;
            const py = hingePt.y + Math.sin(a) * oWidth;
            arcPoints.push([px, Y + 0.002, py]);
        }

        return { arcPoints, hingePt, swingEndPt, gapQuad };
    }, [data]);

    const color = isSelected ? "#60a5fa" : "#e2e8f0";
    const gapColor = "#0f172a"; // Dark background to "erase" the wall fill

    return (
        <group>
            {/* Gap fill: cover the wall fill with a dark rectangle to create the opening */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, Y - 0.002, 0]}>
                <bufferGeometry>
                    <bufferAttribute
                        attach="attributes-position"
                        args={[
                            new Float32Array([
                                gapQuad.gapLS.x,
                                gapQuad.gapLS.y,
                                0,
                                gapQuad.gapLE.x,
                                gapQuad.gapLE.y,
                                0,
                                gapQuad.gapRE.x,
                                gapQuad.gapRE.y,
                                0,
                                gapQuad.gapLS.x,
                                gapQuad.gapLS.y,
                                0,
                                gapQuad.gapRE.x,
                                gapQuad.gapRE.y,
                                0,
                                gapQuad.gapRS.x,
                                gapQuad.gapRS.y,
                                0,
                            ]),
                            3,
                        ]}
                    />
                </bufferGeometry>
                <meshBasicMaterial
                    color={gapColor}
                    depthWrite={false}
                    depthTest={false}
                    transparent
                    opacity={0.85}
                />
            </mesh>

            {/* Door swing arc */}
            <Line
                points={arcPoints}
                color={color}
                lineWidth={1.2}
                depthTest={false}
            />

            {/* Line from hinge to swing end (the door leaf) */}
            <Line
                points={[
                    [hingePt.x, Y + 0.002, hingePt.y],
                    [swingEndPt.x, Y + 0.002, swingEndPt.y],
                ]}
                color={color}
                lineWidth={1.5}
                depthTest={false}
            />

            {/* Thin lines at the gap edges (the door frame in 2D) */}
            <Line
                points={[
                    [
                        data.startWorld.x + data.normX * data.halfT,
                        Y + 0.001,
                        data.startWorld.y + data.normY * data.halfT,
                    ],
                    [
                        data.startWorld.x - data.normX * data.halfT,
                        Y + 0.001,
                        data.startWorld.y - data.normY * data.halfT,
                    ],
                ]}
                color={color}
                lineWidth={1}
                depthTest={false}
            />
            <Line
                points={[
                    [
                        data.endWorld.x + data.normX * data.halfT,
                        Y + 0.001,
                        data.endWorld.y + data.normY * data.halfT,
                    ],
                    [
                        data.endWorld.x - data.normX * data.halfT,
                        Y + 0.001,
                        data.endWorld.y - data.normY * data.halfT,
                    ],
                ]}
                color={color}
                lineWidth={1}
                depthTest={false}
            />
        </group>
    );
}

// ─── Window ────────────────────────────────────────────────────────────────────

/**
 * 2D window symbol (standard architectural convention):
 *   - A gap in the wall fill
 *   - Three parallel lines across the gap representing the glass:
 *     two outer lines along the wall faces, one center line
 *
 *     ═══╤═══════╤═══   ← left wall face line continues through
 *        │ ───── │       ← inner pane line (slightly inset)
 *        │ ───── │       ← center pane line
 *        │ ───── │       ← inner pane line (slightly inset)
 *     ═══╧═══════╧═══   ← right wall face line continues through
 */
function Window2D({
    data,
    isSelected,
}: {
    data: OpeningData;
    isSelected: boolean;
}) {
    const lines = useMemo(() => {
        const {
            dirX,
            dirY,
            normX,
            normY,
            halfT,
            startWorld,
            endWorld,
        } = data;

        // Three lines across the window gap:
        //   1. Left face line (at +halfT from center)
        //   2. Center line
        //   3. Right face line (at -halfT from center)
        //
        // Plus two inner pane lines slightly inset from the faces

        const paneInset = halfT * 0.35; // How far in from the face the pane lines sit

        const makeLinePoints = (
            normalOffset: number,
        ): [number, number, number][] => {
            return [
                [
                    startWorld.x + normX * normalOffset,
                    Y + 0.002,
                    startWorld.y + normY * normalOffset,
                ],
                [
                    endWorld.x + normX * normalOffset,
                    Y + 0.002,
                    endWorld.y + normY * normalOffset,
                ],
            ];
        };

        return {
            leftFace: makeLinePoints(halfT),
            leftInner: makeLinePoints(halfT - paneInset),
            center: makeLinePoints(0),
            rightInner: makeLinePoints(-halfT + paneInset),
            rightFace: makeLinePoints(-halfT),
        };
    }, [data]);

    const color = isSelected ? "#60a5fa" : "#e2e8f0";
    const paneColor = isSelected ? "#93c5fd" : "#94a3b8";
    const gapColor = "#0f172a";

    return (
        <group>
            {/* Gap fill */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, Y - 0.002, 0]}>
                <bufferGeometry>
                    <bufferAttribute
                        attach="attributes-position"
                        args={[
                            new Float32Array([
                                data.startWorld.x + data.normX * data.halfT,
                                data.startWorld.y + data.normY * data.halfT,
                                0,
                                data.endWorld.x + data.normX * data.halfT,
                                data.endWorld.y + data.normY * data.halfT,
                                0,
                                data.endWorld.x - data.normX * data.halfT,
                                data.endWorld.y - data.normY * data.halfT,
                                0,
                                data.startWorld.x + data.normX * data.halfT,
                                data.startWorld.y + data.normY * data.halfT,
                                0,
                                data.endWorld.x - data.normX * data.halfT,
                                data.endWorld.y - data.normY * data.halfT,
                                0,
                                data.startWorld.x - data.normX * data.halfT,
                                data.startWorld.y - data.normY * data.halfT,
                                0,
                            ]),
                            3,
                        ]}
                    />
                </bufferGeometry>
                <meshBasicMaterial
                    color={gapColor}
                    depthWrite={false}
                    depthTest={false}
                    transparent
                    opacity={0.85}
                />
            </mesh>

            {/* Left face line (outer) */}
            <Line
                points={lines.leftFace}
                color={color}
                lineWidth={2}
                depthTest={false}
            />

            {/* Left inner pane line */}
            <Line
                points={lines.leftInner}
                color={paneColor}
                lineWidth={1}
                depthTest={false}
            />

            {/* Center pane line */}
            <Line
                points={lines.center}
                color={paneColor}
                lineWidth={1}
                depthTest={false}
            />

            {/* Right inner pane line */}
            <Line
                points={lines.rightInner}
                color={paneColor}
                lineWidth={1}
                depthTest={false}
            />

            {/* Right face line (outer) */}
            <Line
                points={lines.rightFace}
                color={color}
                lineWidth={2}
                depthTest={false}
            />

            {/* Vertical end caps connecting the face lines */}
            <Line
                points={[
                    [
                        data.startWorld.x + data.normX * data.halfT,
                        Y + 0.002,
                        data.startWorld.y + data.normY * data.halfT,
                    ],
                    [
                        data.startWorld.x - data.normX * data.halfT,
                        Y + 0.002,
                        data.startWorld.y - data.normY * data.halfT,
                    ],
                ]}
                color={color}
                lineWidth={1.5}
                depthTest={false}
            />
            <Line
                points={[
                    [
                        data.endWorld.x + data.normX * data.halfT,
                        Y + 0.002,
                        data.endWorld.y + data.normY * data.halfT,
                    ],
                    [
                        data.endWorld.x - data.normX * data.halfT,
                        Y + 0.002,
                        data.endWorld.y - data.normY * data.halfT,
                    ],
                ]}
                color={color}
                lineWidth={1.5}
                depthTest={false}
            />
        </group>
    );
}

// ─── Hole ──────────────────────────────────────────────────────────────────────

/**
 * 2D hole symbol:
 *   - A gap in the wall fill
 *   - Short dashed lines along each face edge at the break points,
 *     indicating a structural opening (no frame, no door/window)
 *
 *     ═══╎       ╎═══   ← dashed break marks on both faces
 *        ╎       ╎
 *     ═══╎       ╎═══
 */
function Hole2D({
    data,
    isSelected,
}: {
    data: OpeningData;
    isSelected: boolean;
}) {
    const breakLines = useMemo(() => {
        const {
            dirX,
            dirY,
            normX,
            normY,
            halfT,
            startWorld,
            endWorld,
        } = data;

        // Short tick marks at each corner of the gap
        const tickLen = halfT * 0.4;

        const makeTickPair = (
            base: Point2D,
            normalOffset: number,
        ): [number, number, number][] => {
            const bx = base.x + normX * normalOffset;
            const by = base.y + normY * normalOffset;
            return [
                [bx - dirX * tickLen, Y + 0.002, by - dirY * tickLen],
                [bx + dirX * tickLen, Y + 0.002, by + dirY * tickLen],
            ];
        };

        return {
            // Ticks on the start edge (left and right face)
            startLeft: makeTickPair(startWorld, halfT),
            startRight: makeTickPair(startWorld, -halfT),
            // Ticks on the end edge
            endLeft: makeTickPair(endWorld, halfT),
            endRight: makeTickPair(endWorld, -halfT),
        };
    }, [data]);

    const { dashedEdges } = useMemo(() => {
        const {
            normX,
            normY,
            halfT,
            startWorld,
            endWorld,
        } = data;

        // Dashed lines along the left and right face through the gap
        const leftDash: [number, number, number][] = [
            [
                startWorld.x + normX * halfT,
                Y + 0.002,
                startWorld.y + normY * halfT,
            ],
            [
                endWorld.x + normX * halfT,
                Y + 0.002,
                endWorld.y + normY * halfT,
            ],
        ];

        const rightDash: [number, number, number][] = [
            [
                startWorld.x - normX * halfT,
                Y + 0.002,
                startWorld.y - normY * halfT,
            ],
            [
                endWorld.x - normX * halfT,
                Y + 0.002,
                endWorld.y - normY * halfT,
            ],
        ];

        return { dashedEdges: { left: leftDash, right: rightDash } };
    }, [data]);

    const color = isSelected ? "#60a5fa" : "#94a3b8";
    const gapColor = "#0f172a";

    return (
        <group>
            {/* Gap fill */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, Y - 0.002, 0]}>
                <bufferGeometry>
                    <bufferAttribute
                        attach="attributes-position"
                        args={[
                            new Float32Array([
                                data.startWorld.x + data.normX * data.halfT,
                                data.startWorld.y + data.normY * data.halfT,
                                0,
                                data.endWorld.x + data.normX * data.halfT,
                                data.endWorld.y + data.normY * data.halfT,
                                0,
                                data.endWorld.x - data.normX * data.halfT,
                                data.endWorld.y - data.normY * data.halfT,
                                0,
                                data.startWorld.x + data.normX * data.halfT,
                                data.startWorld.y + data.normY * data.halfT,
                                0,
                                data.endWorld.x - data.normX * data.halfT,
                                data.endWorld.y - data.normY * data.halfT,
                                0,
                                data.startWorld.x - data.normX * data.halfT,
                                data.startWorld.y - data.normY * data.halfT,
                                0,
                            ]),
                            3,
                        ]}
                    />
                </bufferGeometry>
                <meshBasicMaterial
                    color={gapColor}
                    depthWrite={false}
                    depthTest={false}
                    transparent
                    opacity={0.85}
                />
            </mesh>

            {/* Dashed lines along the face edges through the gap */}
            <Line
                points={dashedEdges.left}
                color={color}
                lineWidth={1}
                dashed
                dashSize={0.06}
                gapSize={0.04}
                depthTest={false}
            />
            <Line
                points={dashedEdges.right}
                color={color}
                lineWidth={1}
                dashed
                dashSize={0.06}
                gapSize={0.04}
                depthTest={false}
            />

            {/* Break tick marks at the gap edges */}
            <Line
                points={breakLines.startLeft}
                color={color}
                lineWidth={1.5}
                depthTest={false}
            />
            <Line
                points={breakLines.startRight}
                color={color}
                lineWidth={1.5}
                depthTest={false}
            />
            <Line
                points={breakLines.endLeft}
                color={color}
                lineWidth={1.5}
                depthTest={false}
            />
            <Line
                points={breakLines.endRight}
                color={color}
                lineWidth={1.5}
                depthTest={false}
            />

            {/* Cross-gap lines at each end (connecting the face edges) */}
            <Line
                points={[
                    [
                        data.startWorld.x + data.normX * data.halfT,
                        Y + 0.002,
                        data.startWorld.y + data.normY * data.halfT,
                    ],
                    [
                        data.startWorld.x - data.normX * data.halfT,
                        Y + 0.002,
                        data.startWorld.y - data.normY * data.halfT,
                    ],
                ]}
                color={color}
                lineWidth={1}
                dashed
                dashSize={0.04}
                gapSize={0.03}
                depthTest={false}
            />
            <Line
                points={[
                    [
                        data.endWorld.x + data.normX * data.halfT,
                        Y + 0.002,
                        data.endWorld.y + data.normY * data.halfT,
                    ],
                    [
                        data.endWorld.x - data.normX * data.halfT,
                        Y + 0.002,
                        data.endWorld.y - data.normY * data.halfT,
                    ],
                ]}
                color={color}
                lineWidth={1}
                dashed
                dashSize={0.04}
                gapSize={0.03}
                depthTest={false}
            />
        </group>
    );
}
