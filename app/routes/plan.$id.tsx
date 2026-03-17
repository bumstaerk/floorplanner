import { Suspense, useEffect, useRef } from "react";
import type { Route } from "./+types/plan.$id";
import { Canvas, useThree } from "@react-three/fiber";
import { Text } from "@react-three/drei";
import { useFloorplanStore } from "~/store/useFloorplanStore";
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
        </div>
    );
}
