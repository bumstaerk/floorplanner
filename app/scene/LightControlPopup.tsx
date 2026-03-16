import { useCallback, useEffect, useRef } from "react";
import { Html } from "@react-three/drei";
import type { LightState, LightColorMode } from "../store/types";
import { colorTempToHex } from "../store/types";

interface LightControlPopupProps {
  lightState: LightState;
  onChange: (patch: Partial<LightState>) => void;
  onClose: () => void;
}

/**
 * An HTML overlay anchored to a 3D light component.
 * Opens on click, closes on click-outside.
 * Shows on/off toggle, brightness slider, and either an RGB picker
 * or a colour-temperature (warmth) slider depending on colorMode.
 */
export function LightControlPopup({
  lightState,
  onChange,
  onClose,
}: LightControlPopupProps) {
  const { on, brightness, colorMode, colorTemp, rgb } = lightState;
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on click-outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("pointerdown", handleClick);
    return () => document.removeEventListener("pointerdown", handleClick);
  }, [onClose]);

  const toggleOn = useCallback(() => onChange({ on: !on }), [on, onChange]);

  const handleBrightness = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) =>
      onChange({ brightness: Number(e.target.value) }),
    [onChange],
  );

  const handleColorTemp = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) =>
      onChange({ colorTemp: Number(e.target.value) }),
    [onChange],
  );

  const handleRgb = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) =>
      onChange({ rgb: e.target.value }),
    [onChange],
  );

  const handleModeSwitch = useCallback(
    (mode: LightColorMode) => onChange({ colorMode: mode }),
    [onChange],
  );

  const warmthColor = colorTempToHex(colorTemp);

  return (
    <Html
      center
      style={{ pointerEvents: "auto" }}
      position={[0, 0.15, 0]}
    >
      <div
        ref={panelRef}
        onPointerDown={(e) => e.stopPropagation()}
        style={{
          background: "rgba(15, 23, 42, 0.95)",
          backdropFilter: "blur(12px)",
          borderRadius: 12,
          padding: "14px 18px",
          width: 240,
          color: "#e2e8f0",
          fontSize: 14,
          fontFamily: "system-ui, sans-serif",
          userSelect: "none",
          border: "1px solid rgba(148, 163, 184, 0.25)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
        }}
      >
        {/* Header: label + on/off */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 8,
          }}
        >
          <span style={{ fontWeight: 600, fontSize: 15 }}>Light</span>
          <button
            onClick={toggleOn}
            style={{
              width: 44,
              height: 24,
              borderRadius: 12,
              border: "none",
              cursor: "pointer",
              background: on ? "#3b82f6" : "#475569",
              position: "relative",
              transition: "background 0.15s",
            }}
          >
            <div
              style={{
                width: 18,
                height: 18,
                borderRadius: "50%",
                background: "#fff",
                position: "absolute",
                top: 3,
                left: on ? 23 : 3,
                transition: "left 0.15s",
              }}
            />
          </button>
        </div>

        {/* Brightness */}
        <div style={{ marginBottom: 8 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: 3,
            }}
          >
            <span style={{ color: "#94a3b8" }}>Brightness</span>
            <span>{brightness}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            value={brightness}
            onChange={handleBrightness}
            disabled={!on}
            style={{ width: "100%", accentColor: "#3b82f6" }}
          />
        </div>

        {/* Color mode tabs */}
        <div
          style={{
            display: "flex",
            gap: 4,
            marginBottom: 8,
          }}
        >
          <button
            onClick={() => handleModeSwitch("warmth")}
            style={{
              flex: 1,
              padding: "5px 0",
              border: "1px solid",
              borderColor:
                colorMode === "warmth"
                  ? "#3b82f6"
                  : "rgba(148,163,184,0.3)",
              borderRadius: 5,
              background:
                colorMode === "warmth"
                  ? "rgba(59,130,246,0.15)"
                  : "transparent",
              color: colorMode === "warmth" ? "#93c5fd" : "#94a3b8",
              cursor: "pointer",
              fontSize: 13,
            }}
          >
            Warmth
          </button>
          <button
            onClick={() => handleModeSwitch("rgb")}
            style={{
              flex: 1,
              padding: "5px 0",
              border: "1px solid",
              borderColor:
                colorMode === "rgb"
                  ? "#3b82f6"
                  : "rgba(148,163,184,0.3)",
              borderRadius: 5,
              background:
                colorMode === "rgb"
                  ? "rgba(59,130,246,0.15)"
                  : "transparent",
              color: colorMode === "rgb" ? "#93c5fd" : "#94a3b8",
              cursor: "pointer",
              fontSize: 13,
            }}
          >
            RGB
          </button>
        </div>

        {/* Warmth slider */}
        {colorMode === "warmth" && (
          <div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: 3,
              }}
            >
              <span style={{ color: "#94a3b8" }}>Temperature</span>
              <span>{colorTemp}K</span>
            </div>
            <input
              type="range"
              min={2700}
              max={6500}
              step={100}
              value={colorTemp}
              onChange={handleColorTemp}
              disabled={!on}
              style={{
                width: "100%",
                accentColor: warmthColor,
              }}
            />
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 10,
                color: "#64748b",
                marginTop: 2,
              }}
            >
              <span>Warm</span>
              <span>Cool</span>
            </div>
          </div>
        )}

        {/* RGB color picker */}
        {colorMode === "rgb" && (
          <div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <input
                type="color"
                value={rgb}
                onChange={handleRgb}
                disabled={!on}
                style={{
                  width: 32,
                  height: 24,
                  border: "1px solid rgba(148,163,184,0.3)",
                  borderRadius: 4,
                  padding: 0,
                  cursor: "pointer",
                  background: "transparent",
                }}
              />
              <span style={{ color: "#94a3b8", fontFamily: "monospace" }}>
                {rgb}
              </span>
            </div>
          </div>
        )}
      </div>
    </Html>
  );
}
