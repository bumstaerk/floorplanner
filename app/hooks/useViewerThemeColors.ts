import { createContext, useContext } from "react";
import type { ModelTheme } from "~/store/types";

/**
 * When rendering inside the viewer page, this context provides the plan's
 * ModelTheme so 3D components can use it for their colours instead of the
 * default editor theme.
 */
export const ViewerThemeContext = createContext<ModelTheme | null>(null);

/**
 * Returns the viewer's ModelTheme if inside a ViewerThemeContext, or null
 * if rendering in the regular editor.
 */
export function useViewerTheme(): ModelTheme | null {
    return useContext(ViewerThemeContext);
}
