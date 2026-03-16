import { Suspense, useEffect, useRef } from "react";
import type { Route } from "./+types/home";
import { Canvas, useThree } from "@react-three/fiber";
import { Text } from "@react-three/drei";
import { useFloorplanStore } from "../store/useFloorplanStore";
import { useSectionFocusStore } from "../store/useSectionFocusStore";
import { BuildScene } from "../scene/BuildScene";
import { PreviewScene } from "../scene/PreviewScene";
import { Toolbar } from "../components/Toolbar";
import { PropertiesPanel } from "../components/PropertiesPanel";
import { StatusBar } from "../components/StatusBar";
import { TimeOfDayControl } from "../components/TimeOfDayControl";
import { useThemeColors } from "../hooks/useThemeColors";
import { loadMostRecentPlan, type LoadedPlan } from "~/db/queries";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Floorplan Editor" },
    {
      name: "description",
      content: "Upload a floorplan and build walls in 2D, then preview in 3D.",
    },
  ];
}

export async function loader({}: Route.LoaderArgs) {
  const plan = loadMostRecentPlan();
  return { plan };
}

function Scene() {
  const mode = useFloorplanStore((s) => s.mode);
  const clearActive = useSectionFocusStore((s) => s.clearActive);

  // Reset section focus when leaving preview mode
  useEffect(() => {
    if (mode === "build") clearActive();
  }, [mode, clearActive]);

  if (mode === "build") {
    return <BuildScene />;
  }

  return <PreviewScene />;
}

/**
 * Keeps the WebGL clear color in sync with the current theme.
 * Runs inside the Canvas so it has access to the Three.js renderer via useThree.
 */
function ClearColorSync() {
  const { gl } = useThree();
  const colors = useThemeColors();

  useEffect(() => {
    gl.setClearColor(colors.canvasBg);
  }, [gl, colors.canvasBg]);

  return null;
}

/**
 * Eagerly preloads the default troika-three-text font used by drei's <Text>.
 *
 * drei's Text component internally calls `suspend()` from suspend-react to
 * preload the font on first render.  If no <Suspense> boundary exists (or if
 * the boundary blanks the whole scene) this causes a visible flash / reload.
 *
 * By rendering a hidden <Text> inside its own <Suspense> boundary at Canvas
 * mount time, the font is fetched and cached *before* any Wall2D / Room2D
 * <Text> ever mounts.  Subsequent <Text> instances find the cache entry
 * already resolved and never suspend.
 *
 * The component renders a single space character at an invisible position so
 * it has no visual impact.
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
 * Hydrate the zustand store with the most recently saved plan from the
 * server-side loader.  Runs exactly once on the first client mount — the
 * ref guard ensures we never re-hydrate when React re-renders.
 *
 * Uses `hydratePlan` (not `loadPlan`) so the pre-fetched data from the
 * server loader is applied directly without triggering another network request.
 */
function useHydrateStore(plan: LoadedPlan | null) {
  const hydrated = useRef(false);

  useEffect(() => {
    if (hydrated.current || !plan) return;
    hydrated.current = true;

    useFloorplanStore.getState().hydratePlan(plan);
  }, [plan]);
}

/**
 * "Back to building" button shown when a floor section is active in 3D preview.
 * Clears the active section and restores the default building view.
 */
function BackToBuilding() {
  const activeFloorId = useSectionFocusStore((s) => s.activeFloorId);
  const clearActive = useSectionFocusStore((s) => s.clearActive);

  if (!activeFloorId) return null;

  return (
    <button
      onClick={clearActive}
      className="absolute top-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 px-4 py-2 rounded-lg bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm shadow-lg border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-white dark:hover:bg-gray-700 transition-colors cursor-pointer"
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

export default function Home({ loaderData }: Route.ComponentProps) {
  const plan = loaderData.plan as LoadedPlan | null;
  const mode = useFloorplanStore((s) => s.mode);

  useHydrateStore(plan);

  return (
    <div className="relative w-screen h-screen bg-gray-100 dark:bg-gray-950 overflow-hidden">
      {/* 3D Canvas */}
      <Canvas
        shadows
        gl={{
          antialias: true,
          alpha: false,
          powerPreference: "high-performance",
        }}
      >
        <ClearColorSync />
        {/* Preload the troika font so <Text> in Wall2D / Room2D never suspends */}
        <FontPreloader />
        <Scene />
      </Canvas>

      {/* UI Overlays */}
      <Toolbar />
      <PropertiesPanel />
      <StatusBar />
      {mode === "preview" && <TimeOfDayControl />}
      {mode === "preview" && <BackToBuilding />}
    </div>
  );
}
