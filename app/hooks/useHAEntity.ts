import { useHAStore } from "../store/useHAStore";
import type { HAEntityState } from "../store/types";

/**
 * Returns the live state for a single HA entity, or null if the entity ID is
 * null or the entity hasn't been received yet.
 */
export function useHAEntity(entityId: string | null): HAEntityState | null {
    return useHAStore((s) => (entityId ? (s.states[entityId] ?? null) : null));
}
