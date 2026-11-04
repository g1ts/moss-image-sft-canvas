import type { Box, LayoutSummary } from "../types";

export const PALETTE = [
  "#e6194b", "#3cb44b", "#4363d8", "#f58231", "#911eb4",
  "#42d4f4", "#f032e6", "#469990", "#bfef45", "#fabed4"
];

export interface Pt {
  x: number;
  y: number;
}

export interface Rect {
  x1: number;
  x2: number;
  y1: number;
  y2: number;
}

export function norm(b: Box): Rect {
  return {
    x1: Math.min(b.xmin, b.xmax),
    x2: Math.max(b.xmin, b.xmax),
    y1: Math.min(b.ymin, b.ymax),
    y2: Math.max(b.ymin, b.ymax)
  };
}

export function commitBox(b: Box): void {
  const n = norm(b);
  b.xmin = Math.round(n.x1);
  b.xmax = Math.round(n.x2);
  b.ymin = Math.round(n.y1);
  b.ymax = Math.round(n.y2);
}

export function boxText(b: Box): string {
  const n = norm(b);
  return "[" + Math.round(n.y1) + ", " + Math.round(n.x1) + ", " + Math.round(n.y2) + ", " + Math.round(n.x2) + "]";
}

export function boxSize(b: Box): string {
  const n = norm(b);
  return Math.round(n.x2 - n.x1) + "×" + Math.round(n.y2 - n.y1);
}

export function hexToRgba(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return "rgba(" + ((n >> 16) & 255) + "," + ((n >> 8) & 255) + "," + (n & 255) + "," + a + ")";
}

export function clampInt(v: string | number, lo: number, hi: number, fallback: number): number {
  let n: number;
  if (typeof v === "number") n = v;
  else n = parseInt(v, 10);
  if (!isFinite(n)) n = fallback;
  return Math.max(lo, Math.min(hi, n));
}

export function numVal(v: string | number, d: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}

export type HandlePoint = readonly [name: string, x: number, y: number];

export function handlePoints(b: Box): HandlePoint[] {
  const n = norm(b);
  const mx = (n.x1 + n.x2) / 2, my = (n.y1 + n.y2) / 2;
  return [
    ["nw", n.x1, n.y1], ["n", mx, n.y1], ["ne", n.x2, n.y1],
    ["e", n.x2, my],
    ["se", n.x2, n.y2], ["s", mx, n.y2], ["sw", n.x1, n.y2],
    ["w", n.x1, my]
  ];
}

export function toLayoutText(summary: LayoutSummary, boxes: Box[]): string {
  const summaryObj: Record<string, unknown> = {};
  if (summary.meta.length > 0) summaryObj.meta = summary.meta;
  summaryObj.canvas = summary.canvas;
  summaryObj.caption = summary.caption;
  return JSON.stringify({
    summary: summaryObj,
    items: boxes.map(b => {
      const n = norm(b);
      const item: Record<string, unknown> = { label: b.label };
      if (b.caption) item.caption = b.caption;
      if (b.text) item.text = b.text;
      item.bbox = [
        Math.round(n.y1),
        Math.round(n.x1),
        Math.round(n.y2),
        Math.round(n.x2)
      ];
      return item;
    }),
    bbox_coord_space: "abs_centralized",
    bbox_format: "yxyx"
  }, null, 2);
}

export interface ParsedLayout {
  summary: LayoutSummary | null;
  items: { bbox: number[]; label: string; caption: string; text: string }[];
}

export function parseLayout(data: unknown): ParsedLayout {
  const obj = data as
    | {
        summary?: unknown;
        items?: unknown;
        bbox_coord_space?: unknown;
        bbox_format?: unknown;
      }
    | null;
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) {
    throw new Error('Expected an object of the form { "summary": {...}, "items": [...] }');
  }
  if (obj.bbox_coord_space !== undefined && obj.bbox_coord_space !== "abs_centralized") {
    throw new Error('bbox_coord_space: only "abs_centralized" is supported');
  }
  if (obj.bbox_format !== undefined && obj.bbox_format !== "yxyx") {
    throw new Error('bbox_format: only "yxyx" is supported');
  }
  if (!Array.isArray(obj.items)) {
    throw new Error('Expected an "items" array');
  }
  const items: ParsedLayout["items"] = [];
  for (let i = 0; i < obj.items.length; i++) {
    const it = obj.items[i] as
      | { bbox?: unknown; box_2d?: unknown; label?: unknown; caption?: unknown; text?: unknown }
      | null;
    if (!it || typeof it !== "object") {
      throw new Error("items[" + i + "]: expected an object");
    }
    const raw = (Array.isArray(it.bbox) ? it.bbox : it.box_2d) as unknown;
    if (!Array.isArray(raw) || raw.length !== 4 || !raw.every(v => typeof v === "number" && isFinite(v))) {
      throw new Error("items[" + i + "].bbox: expected an array of 4 numbers [y_min, x_min, y_max, x_max]");
    }
    items.push({
      bbox: raw as number[],
      label: typeof it.label === "string" ? it.label : "box " + (i + 1),
      caption: typeof it.caption === "string" ? it.caption : "",
      text: typeof it.text === "string" ? it.text : ""
    });
  }
  let summary: LayoutSummary | null = null;
  const s = obj.summary;
  if (s !== undefined) {
    summary = { meta: [], canvas: "single", caption: "" };
    if (!s || typeof s !== "object" || Array.isArray(s)) {
      throw new Error("summary: expected an object { meta, canvas, caption }");
    }
    const so = s as { meta?: unknown; canvas?: unknown; caption?: unknown };
    if (so.meta !== undefined) {
      if (typeof so.meta === "string") {
        summary.meta = so.meta
          .split(",")
          .map(v => v.trim())
          .filter(v => v);
      } else if (Array.isArray(so.meta) && so.meta.every(v => typeof v === "string")) {
        summary.meta = so.meta as string[];
      } else {
        throw new Error("summary.meta: expected an array of strings");
      }
    }
    if (so.canvas !== undefined) {
      if (typeof so.canvas !== "string") throw new Error("summary.canvas: expected a string");
      summary.canvas = so.canvas;
    }
    if (so.caption !== undefined) {
      if (typeof so.caption !== "string") throw new Error("summary.caption: expected a string");
      summary.caption = so.caption;
    }
  }
  return { summary, items };
}
