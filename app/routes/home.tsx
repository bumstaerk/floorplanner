import { useEffect, useRef } from "react";
import type { Route } from "./+types/home";
import { Canvas, useThree } from "@react-three/fiber";
import { useFloorplanStore } from "../store/useFloorplanStore";
import { BuildScene } from "../scene/BuildScene";
import { PreviewScene } from "../scene/PreviewScene";
import { Toolbar } from "../components/Toolbar";
import { PropertiesPanel } from "../components/PropertiesPanel";
import { StatusBar } from "../components/StatusBar";
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

export default function Home({ loaderData }: Route.ComponentProps) {
  const plan = loaderData.plan as LoadedPlan | null;

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
        <Scene />
      </Canvas>

      {/* UI Overlays */}
      <Toolbar />
      <PropertiesPanel />
      <StatusBar />
    </div>
  );
}
