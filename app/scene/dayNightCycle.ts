import * as THREE from "three";

/**
 * Atmospheric lighting parameters computed from a time-of-day value.
 * All colours are hex strings; positions are relative offsets from scene center.
 */
interface AtmosphericLighting {
  /** Sun direction unit vector (world space, Y-up) */
  sunDirection: THREE.Vector3;
  /** Sun/key directional light intensity */
  sunIntensity: number;
  /** Sun light colour */
  sunColor: string;
  /** Ambient light intensity */
  ambientIntensity: number;
  /** Ambient light colour */
  ambientColor: string;
  /** Hemisphere sky colour (top) */
  hemiSkyColor: string;
  /** Hemisphere ground colour (bottom) */
  hemiGroundColor: string;
  /** Hemisphere intensity */
  hemiIntensity: number;
  /** Fog / background colour */
  fogColor: string;
  /** Fill light intensity */
  fillIntensity: number;
  /** Fill light colour */
  fillColor: string;
}

/** Linearly interpolate between two hex colours */
function lerpColor(a: string, b: string, t: number): string {
  const ca = new THREE.Color(a);
  const cb = new THREE.Color(b);
  ca.lerp(cb, t);
  return `#${ca.getHexString()}`;
}

/** Smoothstep for nicer transitions */
function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/**
 * Compute atmospheric lighting from a time-of-day value.
 *
 * @param hour  Time of day (0–24, fractional). 12 = noon, 0/24 = midnight.
 */
export function computeAtmosphericLighting(hour: number): AtmosphericLighting {
  // Normalize to 0–24
  const h = ((hour % 24) + 24) % 24;

  // ── Sun position ──────────────────────────────────────────────────────
  // Sun altitude: peaks at noon (90°), below horizon at night
  // Sunrise ~6, sunset ~18 for simplicity
  const solarNoon = 12;
  const hourAngle = ((h - solarNoon) / 12) * Math.PI; // -π to π over 24h
  const altitude = Math.cos(hourAngle) * (Math.PI / 2) * 0.95; // max ~85°
  const azimuth = hourAngle * 0.8; // sun traverses east to west

  const sunDir = new THREE.Vector3(
    Math.sin(azimuth) * Math.cos(altitude),
    Math.sin(altitude),
    Math.cos(azimuth) * Math.cos(altitude),
  ).normalize();

  // Sun elevation factor: 0 = horizon, 1 = high noon
  const sunElevation = Math.max(0, Math.sin(altitude));

  // ── Time-of-day phases ────────────────────────────────────────────────
  // dawn:  5–7
  // day:   7–17
  // dusk:  17–19
  // night: 19–5

  // Dawn factor (0 outside dawn, peaks at 1 during dawn)
  const dawn = Math.max(
    smoothstep(4.5, 6, h) * (1 - smoothstep(6, 7.5, h)),
    0,
  );
  // Dusk factor
  const dusk = Math.max(
    smoothstep(16.5, 18, h) * (1 - smoothstep(18, 19.5, h)),
    0,
  );
  // Day factor (1 during full day)
  const day = smoothstep(6, 8, h) * (1 - smoothstep(17, 19, h));
  // Night factor
  const night = 1 - smoothstep(4.5, 7, h) + smoothstep(18, 20.5, h);
  const nightClamped = Math.min(1, Math.max(0, night));

  // ── Sun colour ────────────────────────────────────────────────────────
  // Noon: warm white, dawn/dusk: orange-gold, night: dim blue
  let sunColor = "#ffffff";
  if (dawn > 0.01) {
    sunColor = lerpColor("#ffffff", "#ff8c42", dawn);
  } else if (dusk > 0.01) {
    sunColor = lerpColor("#ffffff", "#ff6b35", dusk);
  }
  if (nightClamped > 0.5) {
    sunColor = lerpColor(sunColor, "#1a1a3e", (nightClamped - 0.5) * 2);
  }

  // ── Sun intensity ─────────────────────────────────────────────────────
  // Strong during day, fading at dawn/dusk, minimal at night
  const sunIntensity = Math.max(0.02, sunElevation * 0.9);

  // ── Ambient ───────────────────────────────────────────────────────────
  const ambientIntensity =
    0.08 + day * 0.42 + dawn * 0.2 + dusk * 0.15;
  let ambientColor = "#8090b0"; // default cool
  if (day > 0.5) {
    ambientColor = lerpColor("#8090b0", "#d0d8e8", (day - 0.5) * 2);
  }
  if (dawn > 0.01) {
    ambientColor = lerpColor(ambientColor, "#c89060", dawn * 0.6);
  }
  if (dusk > 0.01) {
    ambientColor = lerpColor(ambientColor, "#a07050", dusk * 0.6);
  }
  if (nightClamped > 0.5) {
    ambientColor = lerpColor(
      ambientColor,
      "#151530",
      (nightClamped - 0.5) * 2,
    );
  }

  // ── Hemisphere ────────────────────────────────────────────────────────
  let hemiSkyColor = "#4a6fa5"; // neutral blue sky
  let hemiGroundColor = "#8b7355"; // warm ground
  const hemiIntensity = 0.1 + day * 0.2 + dawn * 0.1 + dusk * 0.08;

  if (day > 0.5) {
    hemiSkyColor = lerpColor("#4a6fa5", "#87ceeb", (day - 0.5) * 2);
  }
  if (dawn > 0.01) {
    hemiSkyColor = lerpColor(hemiSkyColor, "#ffb088", dawn * 0.7);
    hemiGroundColor = lerpColor(hemiGroundColor, "#c09060", dawn * 0.5);
  }
  if (dusk > 0.01) {
    hemiSkyColor = lerpColor(hemiSkyColor, "#d06848", dusk * 0.7);
    hemiGroundColor = lerpColor(hemiGroundColor, "#805040", dusk * 0.5);
  }
  if (nightClamped > 0.5) {
    const nightT = (nightClamped - 0.5) * 2;
    hemiSkyColor = lerpColor(hemiSkyColor, "#0a0a20", nightT);
    hemiGroundColor = lerpColor(hemiGroundColor, "#101018", nightT);
  }

  // ── Fog / background ──────────────────────────────────────────────────
  let fogColor = "#c8c8d0"; // neutral day
  if (day > 0.5) {
    fogColor = lerpColor("#c8c8d0", "#dde4f0", (day - 0.5) * 2);
  }
  if (dawn > 0.01) {
    fogColor = lerpColor(fogColor, "#e8b888", dawn * 0.6);
  }
  if (dusk > 0.01) {
    fogColor = lerpColor(fogColor, "#c08060", dusk * 0.6);
  }
  if (nightClamped > 0.5) {
    fogColor = lerpColor(fogColor, "#080810", (nightClamped - 0.5) * 2);
  }

  // ── Fill light ────────────────────────────────────────────────────────
  const fillIntensity = 0.05 + day * 0.2 + dawn * 0.1 + dusk * 0.08;
  let fillColor = "#8090c0";
  if (dawn > 0.01) {
    fillColor = lerpColor(fillColor, "#c0a080", dawn * 0.5);
  }
  if (dusk > 0.01) {
    fillColor = lerpColor(fillColor, "#a08060", dusk * 0.5);
  }
  if (nightClamped > 0.5) {
    fillColor = lerpColor(fillColor, "#101020", (nightClamped - 0.5) * 2);
  }

  return {
    sunDirection: sunDir,
    sunIntensity,
    sunColor,
    ambientIntensity,
    ambientColor,
    hemiSkyColor,
    hemiGroundColor,
    hemiIntensity,
    fogColor,
    fillIntensity,
    fillColor,
  };
}
