import type { Box } from "../types";

export const DEFAULT_LABELS = ["object", "text", "character"];
export const DEFAULT_METAS = [
  "poster",
  "photo",
  "illustration",
  "infographic",
  "comic",
  "anime",
  "3d render",
  "product shot"
];

const MAX_HISTORY = 100;

export const LABEL_HISTORY_KEY = "moss-image-sft-canvas:labelHistory";
export const META_HISTORY_KEY = "moss-image-sft-canvas:metaHistory";

export function loadHistory(key: string): string[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(v => typeof v === "string" && v.trim() !== "");
  } catch {
    return [];
  }
}

export function saveHistory(key: string, list: string[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(list));
  } catch {
    // ignore quota/private-mode errors
  }
}

export function dedupeValues(list: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of list) {
    const key = v.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(v);
  }
  return out;
}

// Pure functions: they update the list, persistence is the caller's responsibility
export function rememberValue(current: string[], value: string): string[] {
  const v = value.trim();
  if (!v) return current;
  const k = v.toLowerCase();
  // Remove matches and "started" prefix values (after typing them out fully)
  const rest = current.filter(x => {
    const kx = x.trim().toLowerCase();
    return kx !== k && !k.startsWith(kx);
  });
  return [v, ...rest].slice(0, MAX_HISTORY);
}

export function rememberValues(current: string[], values: string[]): string[] {
  let out = current;
  for (const v of values) out = rememberValue(out, v);
  return out;
}

export function removeValue(current: string[], value: string): string[] {
  const k = value.trim().toLowerCase();
  return current.filter(x => x.trim().toLowerCase() !== k);
}

export function splitMeta(text: string): string[] {
  return text
    .split(",")
    .map(v => v.trim())
    .filter(v => v);
}

export function buildLabelOptions(
  history: string[],
  boxes: Box[],
  excludeId: number | null
): string[] {
  const canvasLabels = boxes
    .filter(b => b.id !== excludeId)
    .map(b => b.label.trim())
    .filter(v => v !== "");
  return dedupeValues([...DEFAULT_LABELS, ...history, ...canvasLabels]);
}
