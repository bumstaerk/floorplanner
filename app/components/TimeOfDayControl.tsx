import { useTimeOfDayStore } from "../store/useTimeOfDayStore";

/** Format a fractional hour (0–24) as HH:MM */
function formatTime(hour: number): string {
  const h = Math.floor(hour) % 24;
  const m = Math.floor((hour % 1) * 60);
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

/** Get a label for the current time period */
function getTimePeriod(hour: number): string {
  const h = ((hour % 24) + 24) % 24;
  if (h >= 5 && h < 7) return "Dawn";
  if (h >= 7 && h < 12) return "Morning";
  if (h >= 12 && h < 14) return "Midday";
  if (h >= 14 && h < 17) return "Afternoon";
  if (h >= 17 && h < 19.5) return "Dusk";
  if (h >= 19.5 && h < 22) return "Evening";
  return "Night";
}

/** Get a colour indicator for the current time period */
function getTimeIndicatorColor(hour: number): string {
  const h = ((hour % 24) + 24) % 24;
  if (h >= 5 && h < 7) return "#f59e0b"; // amber
  if (h >= 7 && h < 17) return "#3b82f6"; // blue
  if (h >= 17 && h < 19.5) return "#ef4444"; // red-orange
  return "#6366f1"; // indigo
}

/**
 * Floating UI overlay for controlling the time of day.
 * Sits in the bottom-right of the viewport.
 */
export function TimeOfDayControl() {
  const timeOfDay = useTimeOfDayStore((s) => s.timeOfDay);
  const enabled = useTimeOfDayStore((s) => s.enabled);
  const setTimeOfDay = useTimeOfDayStore((s) => s.setTimeOfDay);
  const setEnabled = useTimeOfDayStore((s) => s.setEnabled);

  return (
    <div
      className="absolute bottom-4 right-4 z-20 select-none
        bg-white/90 dark:bg-neutral-900/90 backdrop-blur-sm
        border border-neutral-200 dark:border-neutral-700
        rounded-lg shadow-lg
        transition-all duration-200"
      style={{ width: enabled ? 240 : "auto" }}
    >
      {/* Header with toggle */}
      <div className="flex items-center gap-2 px-3 py-2">
        <button
          onClick={() => setEnabled(!enabled)}
          className={`
            relative w-9 h-5 rounded-full transition-colors duration-200 flex-shrink-0
            ${enabled ? "bg-blue-500" : "bg-neutral-300 dark:bg-neutral-600"}
          `}
          title={enabled ? "Disable day/night cycle" : "Enable day/night cycle"}
        >
          <span
            className={`
              absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm
              transition-transform duration-200
              ${enabled ? "translate-x-4" : "translate-x-0.5"}
            `}
          />
        </button>
        <span className="text-xs font-medium text-neutral-600 dark:text-neutral-400 whitespace-nowrap">
          Day/Night
        </span>

        {enabled && (
          <div className="flex items-center gap-1.5 ml-auto">
            <span
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: getTimeIndicatorColor(timeOfDay) }}
            />
            <span className="text-xs font-mono text-neutral-700 dark:text-neutral-300">
              {formatTime(timeOfDay)}
            </span>
          </div>
        )}
      </div>

      {/* Slider — only visible when enabled */}
      {enabled && (
        <div className="px-3 pb-3 space-y-1">
          <input
            type="range"
            min={0}
            max={24}
            step={0.25}
            value={timeOfDay}
            onChange={(e) => setTimeOfDay(parseFloat(e.target.value))}
            className="w-full h-1.5 rounded-full appearance-none cursor-pointer
              bg-gradient-to-r from-indigo-900 via-amber-400 via-blue-400 via-amber-500 to-indigo-900
              [&::-webkit-slider-thumb]:appearance-none
              [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4
              [&::-webkit-slider-thumb]:rounded-full
              [&::-webkit-slider-thumb]:bg-white
              [&::-webkit-slider-thumb]:shadow-md
              [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-neutral-300
              [&::-webkit-slider-thumb]:cursor-pointer
              [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4
              [&::-moz-range-thumb]:rounded-full
              [&::-moz-range-thumb]:bg-white
              [&::-moz-range-thumb]:shadow-md
              [&::-moz-range-thumb]:border [&::-moz-range-thumb]:border-neutral-300
              [&::-moz-range-thumb]:cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-neutral-400 dark:text-neutral-500">
            <span>00:00</span>
            <span className="text-neutral-500 dark:text-neutral-400 font-medium">
              {getTimePeriod(timeOfDay)}
            </span>
            <span>24:00</span>
          </div>
          {/* Quick presets */}
          <div className="flex gap-1 pt-1">
            {[
              { label: "Dawn", time: 6 },
              { label: "Noon", time: 12 },
              { label: "Dusk", time: 18 },
              { label: "Night", time: 22 },
            ].map((preset) => (
              <button
                key={preset.label}
                onClick={() => setTimeOfDay(preset.time)}
                className={`
                  flex-1 text-[10px] py-0.5 rounded
                  transition-colors duration-150
                  ${
                    Math.abs(timeOfDay - preset.time) < 0.5
                      ? "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300"
                      : "bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700"
                  }
                `}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
