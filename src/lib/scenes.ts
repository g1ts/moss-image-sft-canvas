import type { Scene } from "../types";
import { layoutObject, parseLayout, type ParsedLayout } from "./geometry";

export const PROJECT_APP = "moss-image-sft-canvas";
export const PROJECT_VERSION = 1;

// One scene inside a project file: a layout document (summary + items)
// plus scene-level fields (name, size, negative prompt, backgrounds)
export interface ParsedProjectScene {
  name: string;
  width: number;
  height: number;
  negPrompt: string;
  bg: string | null;
  uploadedBg: string | null;
  layout: ParsedLayout;
}

function isPositiveNumber(v: unknown): v is number {
  return typeof v === "number" && isFinite(v) && v > 0;
}

function dataUrlOrNull(v: unknown, where: string, field: string): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v !== "string" || !v.startsWith("data:image/")) {
    throw new Error(where + "." + field + ": expected a data URL string");
  }
  return v;
}

function stringOr(v: unknown, fallback: string, where: string, field: string): string {
  if (v === undefined || v === null) return fallback;
  if (typeof v !== "string") throw new Error(where + "." + field + ": expected a string");
  return v;
}

export function parseProject(data: unknown): ParsedProjectScene[] {
  let list: unknown[];
  if (Array.isArray(data)) {
    list = data;
  } else if (data && typeof data === "object" && Array.isArray((data as { scenes?: unknown }).scenes)) {
    list = (data as { scenes: unknown[] }).scenes;
  } else if (data && typeof data === "object" && Array.isArray((data as { items?: unknown }).items)) {
    // a plain single-scene layout document
    list = [data];
  } else {
    throw new Error(
      "expected a scene set: an object with a \"scenes\" array, an array of scenes, or a single layout object"
    );
  }
  if (!list.length) throw new Error("the file does not contain any scenes");
  return list.map((entry, i) => {
    const where = "scenes[" + i + "]";
    const obj = entry as
      | {
          name?: unknown;
          width?: unknown;
          height?: unknown;
          negPrompt?: unknown;
          bg?: unknown;
          uploadedBg?: unknown;
          summary?: unknown;
          items?: unknown;
          bbox_coord_space?: unknown;
          bbox_format?: unknown;
        }
      | null;
    if (!obj || typeof obj !== "object") {
      throw new Error(where + ": expected an object");
    }
    let width = 512;
    let height = 512;
    if (obj.width !== undefined || obj.height !== undefined) {
      if (!isPositiveNumber(obj.width) || !isPositiveNumber(obj.height)) {
        throw new Error(where + ".width/height: expected positive numbers");
      }
      width = obj.width;
      height = obj.height;
    }
    const layout = parseLayout({
      summary: obj.summary,
      items: obj.items,
      bbox_coord_space: obj.bbox_coord_space,
      bbox_format: obj.bbox_format
    });
    return {
      name: stringOr(obj.name, "Scene " + (i + 1), where, "name").trim() || "Scene " + (i + 1),
      width,
      height,
      negPrompt: stringOr(obj.negPrompt, "", where, "negPrompt"),
      bg: dataUrlOrNull(obj.bg, where, "bg"),
      uploadedBg: dataUrlOrNull(obj.uploadedBg, where, "uploadedBg"),
      layout
    };
  });
}

export function toProjectText(scenes: Scene[]): string {
  const entries = scenes.map(sc => {
    const summary = {
      meta: sc.metaText
        .split(",")
        .map(v => v.trim())
        .filter(v => v),
      canvas: sc.canvasType,
      caption: sc.sceneCaption
    };
    const entry: Record<string, unknown> = {
      name: sc.name,
      width: sc.width,
      height: sc.height
    };
    if (sc.negPrompt) entry.negPrompt = sc.negPrompt;
    if (sc.bgDataUrl) entry.bg = sc.bgDataUrl;
    if (sc.uploadedBgDataUrl && sc.uploadedBgDataUrl !== sc.bgDataUrl) entry.uploadedBg = sc.uploadedBgDataUrl;
    Object.assign(entry, layoutObject(summary, sc.boxes, true));
    return entry;
  });
  return JSON.stringify({ app: PROJECT_APP, version: PROJECT_VERSION, scenes: entries }, null, 2);
}
