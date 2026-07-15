import { Window, WindowBoundaries } from "./admin.types";

export const WINDOWS: Window[] = [
  { key: "24h", ms: 24 * 60 * 60 * 1000 },
  { key: "7d", ms: 7 * 24 * 60 * 60 * 1000 },
  { key: "1m", ms: 30 * 24 * 60 * 60 * 1000 },
];

export const getWindowBoundaries = (
  now: Date,
  durationMs: number,
): WindowBoundaries => ({
  currentStart: new Date(now.getTime() - durationMs),
  previousStart: new Date(now.getTime() - 2 * durationMs),
});
