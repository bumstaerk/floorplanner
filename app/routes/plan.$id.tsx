import { Suspense, useEffect, useRef } from "react";
import type { Route } from "./+types/plan.$id";
import { Canvas, useThree } from "@react-three/fiber";
import { Text } from "@react-three/drei";
import { useFloorplanStore } from "~/store/useFloorplanStore";
import { useSectionFocusStore } from "~/store/useSectionFocusStore";
import { useThemeStore } from "~/store/useThemeStore";
import { ViewerScene } from "~/scene/ViewerScene";
import { ViewerThemeContext } from "~/hooks/useViewerThemeColors";
import { TimeOfDayControl } from "~/components/TimeOfDayControl";
import { loadPlanById, type LoadedPlan } from "~/db/queries";
import { defaultModelThemeLight, defaultModelThemeDark } from "~/store/types";
import type { ModelTheme } from "~/store/types";

export function meta({ data }: Route.MetaArgs) {
    const plan = data?.plan as LoadedPlan | null;
    const name = plan?.name ?? "Floor Plan";
    return [
        { title: `${name} — 3D View` },
        { name: "description", content: `Interactive 3D view of ${name}` },
    ];
}

export async function loader({ params }: Route.LoaderArgs) {
    const plan = loadPlanById(params.id);
    if (!plan) {
        throw new Response("Plan not found", { status: 404 });
    }
    return { plan };
}

/**
 * Keeps the WebGL clear color in sync with the model theme background.
 */
function ClearColorSync({ color }: { color: string }) {
    const { gl } = useThree();

    useEffect(() => {
        gl.setClearColor(color);
    }, [gl, color]);

    return null;
}

/**
 * Preload the troika-three-text font to prevent Canvas suspend flash.
 */
function FontPreloader() {
    return (
        <Suspense fallback={null}>
            <Text position={[0, -9999, 0]} fontSize={0.01} visible={false}>
                {" "}
            </Text>
        </Suspense>
    );
}

/**
 * Hydrate the zustand store with the plan data exactly once.
 */
function useHydrateStore(plan: LoadedPlan) {
    const hydrated = useRef(false);

    useEffect(() => {
        if (hydrated.current) return;
        hydrated.current = true;
        useFloorplanStore.getState().hydratePlan(plan);
    }, [plan]);
}

/**
 * "Back to building" button shown when a floor section is active.
 */
function BackToBuilding() {
    const activeFloorId = useSectionFocusStore((s) => s.activeFloorId);
    const clearActive = useSectionFocusStore((s) => s.clearActive);

    if (!activeFloorId) return null;

    return (
        <button
            onClick={clearActive}
            className="absolute top-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 px-4 py-2 rounded-lg bg-white/90 dark:bg-neutral-800/90 backdrop-blur-sm shadow-lg border border-neutral-200 dark:border-neutral-700 text-sm font-medium text-neutral-700 dark:text-neutral-200 hover:bg-white dark:hover:bg-neutral-700 transition-colors cursor-pointer"
        >
            <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
            >
                <path d="M19 12H5" />
                <path d="M12 19l-7-7 7-7" />
            </svg>
            Back to building
        </button>
    );
}

export default function PlanViewer({ loaderData }: Route.ComponentProps) {
    const plan = loaderData.plan as LoadedPlan;
    const systemTheme = useThemeStore((s) => s.theme);

    useHydrateStore(plan);

    const floors = useFloorplanStore((s) => s.floors);
    const walls = useFloorplanStore((s) => s.walls);
    const rooms = useFloorplanStore((s) => s.rooms);
    const corners = useFloorplanStore((s) => s.corners);

    // Use the plan's saved theme, or fall back to defaults
    const modelTheme: ModelTheme =
        plan.modelTheme ??
        (systemTheme === "dark"
            ? defaultModelThemeDark
            : defaultModelThemeLight);

    return (
        <div className="w-screen h-screen overflow-hidden bg-neutral-100 dark:bg-neutral-950">
            <ViewerThemeContext.Provider value={modelTheme}>
                <Canvas
                    shadows
                    gl={{
                        antialias: true,
                        alpha: false,
                        powerPreference: "high-performance",
                        toneMapping: 3, // ACESFilmicToneMapping
                        toneMappingExposure: 1.0,
                    }}
                >
                    <ClearColorSync color={modelTheme.backgroundColor} />
                    <FontPreloader />
                    <ViewerScene
                        floors={floors}
                        walls={walls}
                        rooms={rooms}
                        corners={corners}
                        theme={modelTheme}
                    />
                </Canvas>
            </ViewerThemeContext.Provider>

            {/* Minimal overlay — plan name */}
            <div className="absolute top-4 left-4 pointer-events-none">
                <h1 className="text-lg font-medium text-neutral-800 dark:text-neutral-200 drop-shadow-sm">
                    {plan.name}
                </h1>
            </div>

            {/* Back link */}
            <a
                href="/"
                className="absolute top-4 right-4 px-3 py-1.5 text-sm rounded-md
                    bg-white/80 dark:bg-neutral-800/80 backdrop-blur
                    text-neutral-700 dark:text-neutral-300
                    hover:bg-white dark:hover:bg-neutral-700
                    border border-neutral-200 dark:border-neutral-700
                    transition-colors"
            >
                Back to Editor
            </a>

            {/* Day/night cycle control */}
            <TimeOfDayControl />

            {/* Section focus reset */}
            <BackToBuilding />
        </div>
    );
}
