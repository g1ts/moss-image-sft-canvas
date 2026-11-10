import { create } from "zustand";
import type { Box, GalleryItem, GenItemParams, LayoutSummary } from "./types";
import { PALETTE, clampInt, toLayoutText, type ParsedLayout } from "./lib/geometry";
import { createHistory, type History } from "./lib/undoHistory";
import {
  LABEL_HISTORY_KEY,
  META_HISTORY_KEY,
  loadHistory,
  rememberValue,
  rememberValues,
  removeValue,
  saveHistory,
  splitMeta
} from "./lib/valueHistory";
import {
  apiFetch,
  buildGenBody,
  cancelJob,
  fetchGenCatalog,
  loadImage,
  waitForJob,
  JobCancelledError,
  type Job,
  type JobPreview,
  type LoraInfo,
  type LoraRow
} from "./lib/sdcpp";

export interface GenPreviewFrame {
  img: HTMLImageElement;
  step: number;
  totalSteps: number;
  pass: number;
}

export interface GenLoraRow extends LoraRow {
  id: number;
}

export interface GenStatus {
  msg: string;
  isError: boolean;
}

export interface GenParams {
  genUrl: string;
  genW: string;
  genH: string;
  genCount: string;
  genSteps: string;
  genCfg: string;
  genSeed: string;
  genClip: string;
  genClipManual: boolean;
  genSched: string;
  genMethod: string;
  genLoras: GenLoraRow[];
  genFromCanvas: boolean;
  genLivePreviewMode: string;
}

const LS_GEN_URL = "moss-image-sft-canvas.sdcpp.url";
const DEFAULT_GEN_URL = "";

const LS_GEN_AUTO_BG = "moss-image-sft-canvas:genAutoBg";

function readSavedAutoBg(): boolean {
  try {
    const raw = localStorage.getItem(LS_GEN_AUTO_BG);
    if (raw === null) return true;
    return raw !== "0";
  } catch {
    return true;
  }
}

function saveAutoBg(v: boolean): void {
  try {
    localStorage.setItem(LS_GEN_AUTO_BG, v ? "1" : "0");
  } catch {
    /* ignore */
  }
}

const LS_GEN_LIVE_PREVIEW = "moss-image-sft-canvas:genLivePreview";
const DEFAULT_LIVE_PREVIEW_MODE = "proj";

function readSavedLivePreviewMode(): string {
  try {
    const raw = localStorage.getItem(LS_GEN_LIVE_PREVIEW);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (typeof parsed === "string") {
        return parsed.length ? parsed : DEFAULT_LIVE_PREVIEW_MODE;
      }
      if (parsed && typeof parsed.mode === "string" && parsed.mode.length > 0) {
        return parsed.on === false ? "none" : parsed.mode;
      }
    }
  } catch {
    /* ignore */
  }
  return DEFAULT_LIVE_PREVIEW_MODE;
}

function saveLivePreviewMode(mode: string): void {
  try {
    localStorage.setItem(LS_GEN_LIVE_PREVIEW, JSON.stringify(mode));
  } catch {
    /* ignore */
  }
}

const LS_CANVAS_SIZE = "moss-image-sft-canvas:canvasSize";
const DEFAULT_CANVAS_SIZE = { w: 512, h: 512 };

function readSavedUrl(): string {
  try {
    return localStorage.getItem(LS_GEN_URL) || DEFAULT_GEN_URL;
  } catch {
    return DEFAULT_GEN_URL;
  }
}

function readSavedSize(): { w: number; h: number } {
  try {
    const raw = localStorage.getItem(LS_CANVAS_SIZE);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (
        parsed &&
        typeof parsed.w === "number" &&
        typeof parsed.h === "number" &&
        Number.isFinite(parsed.w) &&
        Number.isFinite(parsed.h) &&
        parsed.w > 0 &&
        parsed.h > 0
      ) {
        return { w: Math.round(parsed.w), h: Math.round(parsed.h) };
      }
    }
  } catch {
    /* ignore */
  }
  return DEFAULT_CANVAS_SIZE;
}

function saveCanvasSize(w: number, h: number): void {
  try {
    localStorage.setItem(LS_CANVAS_SIZE, JSON.stringify({ w, h }));
  } catch {
    /* ignore */
  }
}

const LS_GRID = "moss-image-sft-canvas:showGrid";

function readSavedGrid(): boolean {
  try {
    const raw = localStorage.getItem(LS_GRID);
    if (raw === null) return true;
    return raw !== "0";
  } catch {
    return true;
  }
}

function saveGrid(v: boolean): void {
  try {
    localStorage.setItem(LS_GRID, v ? "1" : "0");
  } catch {
    /* ignore */
  }
}

const LS_GRID_SIZE = "moss-image-sft-canvas:gridSize";
const MIN_GRID_SIZE = 4;
const MAX_GRID_SIZE = 2048;
const DEFAULT_GRID_SIZE = 50;

function readSavedGridSize(): number {
  try {
    const raw = localStorage.getItem(LS_GRID_SIZE);
    if (raw) {
      const n = parseInt(raw, 10);
      if (isFinite(n) && n >= MIN_GRID_SIZE && n <= MAX_GRID_SIZE) return n;
    }
  } catch {
    /* ignore */
  }
  return DEFAULT_GRID_SIZE;
}

function saveGridSize(v: number): void {
  try {
    localStorage.setItem(LS_GRID_SIZE, String(v));
  } catch {
    /* ignore */
  }
}

const LS_SNAP_GRID = "moss-image-sft-canvas:snapToGrid";

function readSavedSnapGrid(): boolean {
  try {
    const raw = localStorage.getItem(LS_SNAP_GRID);
    if (raw === null) return false;
    return raw !== "0";
  } catch {
    return false;
  }
}

function saveSnapGrid(v: boolean): void {
  try {
    localStorage.setItem(LS_SNAP_GRID, v ? "1" : "0");
  } catch {
    /* ignore */
  }
}

const LS_ALIGN = "moss-image-sft-canvas:alignEnabled";

function readSavedAlign(): boolean {
  try {
    const raw = localStorage.getItem(LS_ALIGN);
    if (raw === null) return true;
    return raw !== "0";
  } catch {
    return true;
  }
}

function saveAlign(v: boolean): void {
  try {
    localStorage.setItem(LS_ALIGN, v ? "1" : "0");
  } catch {
    /* ignore */
  }
}

const LS_GALLERY_HIDDEN = "moss-image-sft-canvas:galleryHidden";

function readSavedGalleryHidden(): boolean {
  try {
    const raw = localStorage.getItem(LS_GALLERY_HIDDEN);
    if (raw === null) return false;
    return raw === "1";
  } catch {
    return false;
  }
}

function saveGalleryHidden(v: boolean): void {
  try {
    localStorage.setItem(LS_GALLERY_HIDDEN, v ? "1" : "0");
  } catch {
    /* ignore */
  }
}

let genTimer: number | null = null;
let genJobId: string | number | null = null;
let genBaseUrl: string = "";
let cancelRequested = false;
let lastPreviewB64 = "";
let loraRowId = 1;
let catalogReq = 0;

interface CanvasState extends GenParams {
  width: number;
  height: number;
  boxes: Box[];
  selectedId: number | null;
  hoveredId: number | null;
  pendingBoxId: number | null;
  pendingIsNew: boolean;
  nextId: number;
  colorIndex: number;
  bgImage: HTMLImageElement | null;
  bgInfo: string;
  uploadedBg: HTMLImageElement | null;
  uploadedBgInfo: string;
  gallery: GalleryItem[];
  genBusy: boolean;
  genStatus: GenStatus;
  genPreviewFrame: GenPreviewFrame | null;
  cursor: { x: number; y: number } | null;
  action: string;
  metaText: string;
  canvasType: string;
  sceneCaption: string;
  negPrompt: string;
  jsonMode: boolean;
  showGrid: boolean;
  gridSize: number;
  snapToGrid: boolean;
  alignEnabled: boolean;
  galleryHidden: boolean;
  labelHistory: string[];
  metaHistory: string[];
  schedOptions: string[];
  samplerOptions: string[];
  loraOptions: LoraInfo[];
  previewModes: string[];
  catalogLoading: boolean;
  catalogError: string | null;
  genAutoBg: boolean;
  canUndo: boolean;
  canRedo: boolean;

  undo: () => void;
  redo: () => void;
  beginChange: () => void;
  endChange: () => void;
  cancelChange: () => void;

  applySize: (w: number, h: number) => void;
  setUploadedBg: (img: HTMLImageElement | null, info: string) => void;
  select: (id: number | null) => void;
  setHoveredId: (id: number | null) => void;
  setPendingBoxId: (id: number | null) => void;
  openBoxEditor: (id: number) => void;
  beginDraw: (x: number, y: number) => Box;
  finishDraw: (box: Box) => void;
  touchBoxes: () => void;
  updateBox: (
    id: number,
    patch: {
      label?: string;
      caption?: string;
      text?: string;
      color?: string;
      xmin?: number;
      xmax?: number;
      ymin?: number;
      ymax?: number;
      hidden?: boolean;
      locked?: boolean;
    }
  ) => void;
  deleteBox: (id: number) => void;
  moveBox: (id: number, toIndex: number) => void;
  clearAll: () => void;
  importLayout: (parsed: ParsedLayout) => void;
  setMetaText: (text: string) => void;
  removeMetaValue: (value: string) => void;
  addMetaValue: (value: string) => void;
  setCanvasType: (text: string) => void;
  setSceneCaption: (text: string) => void;
  setNegPrompt: (text: string) => void;
  setJsonMode: (v: boolean) => void;
  setShowGrid: (v: boolean) => void;
  setGridSize: (v: string | number) => void;
  setSnapToGrid: (v: boolean) => void;
  setAlignEnabled: (v: boolean) => void;
  setGalleryHidden: (v: boolean) => void;
  removeLabelHistory: (label: string) => void;
  rememberLabel: (label: string) => void;
  rememberMeta: (text: string) => void;
  setCursor: (x: number, y: number) => void;
  setAction: (text: string) => void;
  setGenBusy: (busy: boolean) => void;
  setGenStatus: (msg: string, isError: boolean) => void;
  setGenParam: (patch: Partial<GenParams>) => void;
  setGenLivePreview: (mode: string) => void;
  setGenAutoBg: (v: boolean) => void;
  saveGenUrl: () => void;
  loadCatalog: () => Promise<void>;
  addLoraRow: () => void;
  removeLoraRow: (id: number) => void;
  updateLoraRow: (id: number, patch: Partial<Omit<GenLoraRow, "id">>) => void;
  generate: () => Promise<void>;
  cancelGeneration: () => Promise<void>;
  addGalleryItem: (img: HTMLImageElement, prompt: string, params: GenItemParams) => void;
  deleteGalleryItem: (id: number) => void;
  useAsBg: (id: number) => void;
}

// Undo/redo operates on the internal document state (not the exported JSON):
// every Box keeps its hidden/locked flags, so "hidden" and "deleted" stay distinct steps.
//
// Change sessions (beginChange/endChange) cover both mouse drags (mousedown/mouseup)
// and text fields (focus/blur): the snapshot is taken when the session starts and pushed
// to the history on session end only if the document actually changed — so a whole
// typing session is a single undo step.
interface DocSnap {
  boxes: Box[];
  metaText: string;
  canvasType: string;
  sceneCaption: string;
  negPrompt: string;
}

const UNDO_LIMIT = 100;
const UNDO_COALESCE_MS = 500;

function docSnap(s: CanvasState): DocSnap {
  return {
    boxes: s.boxes.map(b => ({ ...b })),
    metaText: s.metaText,
    canvasType: s.canvasType,
    sceneCaption: s.sceneCaption,
    negPrompt: s.negPrompt
  };
}

// z is excluded on purpose: a plain click raises a box to the front and must not create a step
function docFingerprint(s: DocSnap): string {
  const boxes = s.boxes
    .map(b =>
      [b.xmin, b.xmax, b.ymin, b.ymax, b.label, b.caption, b.text, b.color, b.hidden ? 1 : 0, b.locked ? 1 : 0].join(":")
    )
    .join("|");
  return boxes + "#" + s.metaText + "#" + s.canvasType + "#" + s.sceneCaption + "#" + s.negPrompt;
}

const history: History<DocSnap> = createHistory<DocSnap>({
  limit: UNDO_LIMIT,
  coalesceMs: UNDO_COALESCE_MS,
  fingerprint: docFingerprint
});

// keys of discrete operations must be unique (undo of a delete inside the coalesce window of a new delete)
let opSeq = 0;

const histFlags = () => ({ canUndo: history.canUndo, canRedo: history.canRedo });

export function summaryFromState(s: { metaText: string; canvasType: string; sceneCaption: string }): LayoutSummary {
  return {
    meta: splitMeta(s.metaText),
    canvas: s.canvasType,
    caption: s.sceneCaption
  };
}

const savedSize = readSavedSize();

export const useStore = create<CanvasState>()((set, get) => {
  // restore a document snapshot, dropping selection refs that no longer exist
  const setDoc = (snap: DocSnap) => {
    history.cancel(); // a pending text-edit session is stale once the document is replaced
    const s = get();
    const ids = new Set(snap.boxes.map(b => b.id));
    const keep = (id: number | null) => (id !== null && !ids.has(id) ? null : id);
    const pendingBoxId = keep(s.pendingBoxId);
    set({
      boxes: snap.boxes.map(b => ({ ...b })),
      metaText: snap.metaText,
      canvasType: snap.canvasType,
      sceneCaption: snap.sceneCaption,
      negPrompt: snap.negPrompt,
      selectedId: keep(s.selectedId),
      hoveredId: keep(s.hoveredId),
      pendingBoxId,
      pendingIsNew: pendingBoxId !== null ? s.pendingIsNew : false,
      ...histFlags()
    });
  };

  return ({
  width: savedSize.w,
  height: savedSize.h,
  boxes: [],
  selectedId: null,
  hoveredId: null,
  pendingBoxId: null,
  pendingIsNew: false,
  nextId: 1,
  colorIndex: 0,
  bgImage: null,
  bgInfo: "",
  uploadedBg: null,
  uploadedBgInfo: "",
  gallery: [],
  genBusy: false,
  genStatus: { msg: "", isError: false },
  genPreviewFrame: null,
  genUrl: readSavedUrl(),
  genW: "512",
  genH: "512",
  genCount: "1",
  genSteps: "20",
  genCfg: "7",
  genSeed: "-1",
  genClip: "2",
  genClipManual: false,
  genSched: "default",
  genMethod: "euler",
  genLoras: [],
  genFromCanvas: true,
  genLivePreviewMode: readSavedLivePreviewMode(),
  schedOptions: [],
  samplerOptions: [],
  loraOptions: [],
  previewModes: [],
  catalogLoading: false,
  catalogError: null,
  genAutoBg: readSavedAutoBg(),
  cursor: null,
  action: "",
  metaText: "",
  canvasType: "single",
  sceneCaption: "",
  negPrompt: "",
  jsonMode: true,
  showGrid: readSavedGrid(),
  gridSize: readSavedGridSize(),
  snapToGrid: readSavedSnapGrid(),
  alignEnabled: readSavedAlign(),
  galleryHidden: readSavedGalleryHidden(),
  labelHistory: loadHistory(LABEL_HISTORY_KEY),
  metaHistory: loadHistory(META_HISTORY_KEY),
  canUndo: false,
  canRedo: false,

  undo: () => {
    const snap = history.undo(docSnap(get()));
    if (!snap) return;
    setDoc(snap);
  },

  redo: () => {
    const snap = history.redo(docSnap(get()));
    if (!snap) return;
    setDoc(snap);
  },

  beginChange: () => {
    history.begin(docSnap(get()));
  },

  endChange: () => {
    if (history.end(docSnap(get()))) set(histFlags());
  },

  cancelChange: () => {
    history.cancel();
  },

  applySize: (w, h) => {
    set({ width: w, height: h });
    saveCanvasSize(w, h);
  },

  setUploadedBg: (img, info) =>
    set({ uploadedBg: img, uploadedBgInfo: info, bgImage: img, bgInfo: info }),

  select: (id) =>
    set(s => {
      if (id === null) return { selectedId: null };
      const idx = s.boxes.findIndex(b => b.id === id);
      if (idx === -1) return { selectedId: id };
      const topZ = s.boxes.reduce((m, b) => Math.max(m, b.z), 0);
      const box = s.boxes[idx];
      if (box.z === topZ) return { selectedId: id };
      box.z = topZ + 1;
      return { selectedId: id, boxes: [...s.boxes] };
    }),

  setHoveredId: (id) => set(s => (s.hoveredId === id ? {} : { hoveredId: id })),

  // commit any pending text-edit session: closing the modal (Enter, Escape, buttons)
  // unmounts the focused field, so its blur event never fires
  setPendingBoxId: (id) => {
    history.end(docSnap(get()));
    set({ pendingBoxId: id, pendingIsNew: false, ...histFlags() });
  },

  openBoxEditor: (id) => {
    get().select(id);
    set({ pendingBoxId: id, pendingIsNew: false });
  },

  beginDraw: (x, y) => {
    const s = get();
    const topZ = s.boxes.reduce((m, b) => Math.max(m, b.z), 0);
    const box: Box = {
      id: s.nextId,
      label: "",
      caption: "",
      text: "",
      xmin: x,
      xmax: x,
      ymin: y,
      ymax: y,
      color: PALETTE[s.colorIndex % PALETTE.length],
      z: topZ + 1,
      hidden: false,
      locked: false
    };
    set({ nextId: s.nextId + 1, colorIndex: s.colorIndex + 1, selectedId: null });
    return box;
  },

  finishDraw: (box) =>
    set(s => ({ boxes: [...s.boxes, box], selectedId: box.id, pendingBoxId: box.id, pendingIsNew: true })),

  touchBoxes: () => set(s => ({ boxes: [...s.boxes] })),

  updateBox: (id, patch) => {
    const s = get();
    if (!s.boxes.some(b => b.id === id)) return;
    // label/caption/text edit live while the field is focused — their session commits on blur
    const isText = patch.label !== undefined || patch.caption !== undefined || patch.text !== undefined;
    if (!isText) {
      const field =
        patch.xmin !== undefined || patch.xmax !== undefined || patch.ymin !== undefined || patch.ymax !== undefined
          ? "coords"
          : Object.keys(patch)[0] || "patch";
      history.record(docSnap(s), "box:" + id + ":" + field);
    }
    set(s2 => {
      const toggled = patch.hidden !== undefined || patch.locked !== undefined;
      return {
        boxes: s2.boxes.map(b => (b.id === id ? { ...b, ...patch } : b)),
        ...(toggled && s2.hoveredId === id ? { hoveredId: null } : {}),
        ...histFlags()
      };
    });
  },

  deleteBox: (id) => {
    const s = get();
    if (!s.boxes.some(b => b.id === id)) return;
    history.record(docSnap(s), "op:" + ++opSeq);
    set(s2 => ({
      boxes: s2.boxes.filter(b => b.id !== id),
      selectedId: s2.selectedId === id ? null : s2.selectedId,
      hoveredId: s2.hoveredId === id ? null : s2.hoveredId,
      pendingBoxId: s2.pendingBoxId === id ? null : s2.pendingBoxId,
      pendingIsNew: s2.pendingBoxId === id ? false : s2.pendingIsNew,
      ...histFlags()
    }));
  },

  moveBox: (id, toIndex) => {
    const s = get();
    if (s.boxes.findIndex(b => b.id === id) === -1) return;
    history.record(docSnap(s), "op:" + ++opSeq);
    set(s2 => {
      const from = s2.boxes.findIndex(b => b.id === id);
      if (from === -1) return {};
      const boxes = s2.boxes.slice();
      const [box] = boxes.splice(from, 1);
      const target = Math.max(0, Math.min(from < toIndex ? toIndex - 1 : toIndex, boxes.length));
      boxes.splice(target, 0, box);
      return { boxes, ...histFlags() };
    });
  },

  clearAll: () => {
    const s = get();
    const empty = !s.boxes.length && !s.metaText && !s.canvasType && !s.sceneCaption && !s.negPrompt;
    if (!empty) history.record(docSnap(s), "op:" + ++opSeq);
    set({
      boxes: [],
      selectedId: null,
      hoveredId: null,
      pendingBoxId: null,
      pendingIsNew: false,
      metaText: "",
      canvasType: "single",
      sceneCaption: "",
      negPrompt: "",
      ...histFlags()
    });
  },

  importLayout: (parsed) => {
    const s = get();
    let nextId = s.nextId;
    let colorIndex = s.colorIndex;
    let labelHistory = s.labelHistory;
    for (const it of parsed.items) labelHistory = rememberValue(labelHistory, it.label);
    let metaHistory = s.metaHistory;
    if (parsed.summary) metaHistory = rememberValues(metaHistory, parsed.summary.meta);
    const boxes: Box[] = parsed.items.map((it, i) => {
      const [ay, bx, cy, dx] = it.bbox.map(Math.round);
      return {
        id: nextId++,
        label: it.label,
        caption: it.caption,
        text: it.text,
        ymin: Math.min(ay, cy),
        ymax: Math.max(ay, cy),
        xmin: Math.min(bx, dx),
        xmax: Math.max(bx, dx),
        color: PALETTE[colorIndex++ % PALETTE.length],
        z: i + 1,
        hidden: false,
        locked: false
      };
    });
    const sm = parsed.summary;
    const nextMeta = sm ? sm.meta.join(", ") : s.metaText;
    const nextCanvas = sm ? sm.canvas : s.canvasType;
    const nextCaption = sm ? sm.caption : s.sceneCaption;
    if (
      docFingerprint({ boxes, metaText: nextMeta, canvasType: nextCanvas, sceneCaption: nextCaption, negPrompt: s.negPrompt }) !==
      docFingerprint({ boxes: s.boxes, metaText: s.metaText, canvasType: s.canvasType, sceneCaption: s.sceneCaption, negPrompt: s.negPrompt })
    ) {
      history.record(docSnap(s), "op:" + ++opSeq);
    }
    saveHistory(LABEL_HISTORY_KEY, labelHistory);
    saveHistory(META_HISTORY_KEY, metaHistory);
    set({
      boxes,
      nextId,
      colorIndex,
      labelHistory,
      metaHistory,
      selectedId: null,
      hoveredId: null,
      metaText: nextMeta,
      canvasType: nextCanvas,
      sceneCaption: nextCaption,
      ...histFlags()
    });
  },

  // typing sessions commit on blur (see beginChange/endChange)
  setMetaText: (text) => {
    if (get().metaText === text) return;
    set({ metaText: text });
  },

  // Discrete edits from the meta picker: a pending typing session is committed first,
  // then the step is recorded, so both stay separately undoable
  removeMetaValue: (value) => {
    const s = get();
    const k = value.trim().toLowerCase();
    if (!k) return;
    const cur = splitMeta(s.metaText);
    const next = cur.filter(t => t.toLowerCase() !== k);
    if (next.length === cur.length) return;
    history.end(docSnap(s));
    history.record(docSnap(s), "op:" + ++opSeq);
    set({ metaText: next.join(", "), ...histFlags() });
    if (document.activeElement === document.getElementById("jsonMeta")) {
      history.begin(docSnap(get()));
    }
  },

  addMetaValue: (value) => {
    const v = value.trim();
    if (!v) return;
    const s = get();
    const cur = splitMeta(s.metaText);
    if (cur.some(t => t.toLowerCase() === v.toLowerCase())) return;
    history.end(docSnap(s));
    history.record(docSnap(s), "op:" + ++opSeq);
    const mh = rememberValues(s.metaHistory, [v]);
    saveHistory(META_HISTORY_KEY, mh);
    set({
      metaText: cur.length ? cur.join(", ") + ", " + v : v,
      metaHistory: mh,
      ...histFlags()
    });
    if (document.activeElement === document.getElementById("jsonMeta")) {
      history.begin(docSnap(get()));
    }
  },

  setCanvasType: (text) => {
    if (get().canvasType === text) return;
    set({ canvasType: text });
  },

  setSceneCaption: (text) => {
    if (get().sceneCaption === text) return;
    set({ sceneCaption: text });
  },

  setNegPrompt: (text) => {
    if (get().negPrompt === text) return;
    set({ negPrompt: text });
  },

  setJsonMode: (v) => set({ jsonMode: v }),

  setShowGrid: (v) => {
    set({ showGrid: v });
    saveGrid(v);
  },

  setGridSize: (v) => {
    const n = clampInt(v, MIN_GRID_SIZE, MAX_GRID_SIZE, DEFAULT_GRID_SIZE);
    set({ gridSize: n });
    saveGridSize(n);
  },

  setSnapToGrid: (v) => {
    set({ snapToGrid: v });
    saveSnapGrid(v);
  },

  setAlignEnabled: (v) => {
    set({ alignEnabled: v });
    saveAlign(v);
  },

  setGalleryHidden: (v) => {
    set({ galleryHidden: v });
    saveGalleryHidden(v);
  },

  removeLabelHistory: (label) =>
    set(s => {
      const next = removeValue(s.labelHistory, label);
      saveHistory(LABEL_HISTORY_KEY, next);
      return { labelHistory: next };
    }),

  // Writing to history — only on actual blur / selection / close
  rememberLabel: (label) =>
    set(s => {
      const next = rememberValue(s.labelHistory, label);
      saveHistory(LABEL_HISTORY_KEY, next);
      return { labelHistory: next };
    }),

  rememberMeta: (text) =>
    set(s => {
      const next = rememberValues(s.metaHistory, splitMeta(text));
      saveHistory(META_HISTORY_KEY, next);
      return { metaHistory: next };
    }),

  setCursor: (x, y) => set({ cursor: { x, y } }),

  setAction: (text) => set({ action: text }),

  setGenBusy: (busy) => set({ genBusy: busy }),

  setGenStatus: (msg, isError) => set({ genStatus: { msg, isError } }),

  setGenParam: (patch) => set(patch),

  setGenLivePreview: (mode) => {
    saveLivePreviewMode(mode);
    set({ genLivePreviewMode: mode });
  },

  setGenAutoBg: (v) => {
    set({ genAutoBg: v });
    saveAutoBg(v);
  },

  saveGenUrl: () => {
    try {
      localStorage.setItem(LS_GEN_URL, get().genUrl.trim());
    } catch {
      /* ignore */
    }
  },

  loadCatalog: async () => {
    const base = get().genUrl.trim();
    if (!base) {
      set({ catalogLoading: false, catalogError: "specify the server URL" });
      return;
    }
    const req = ++catalogReq;
    set({ catalogLoading: true });
    try {
      const cat = await fetchGenCatalog(base);
      if (req !== catalogReq) return;
      set({
        catalogLoading: false,
        schedOptions: cat.schedulers,
        samplerOptions: cat.samplers,
        loraOptions: cat.loras,
        previewModes: cat.previewModes,
        catalogError: cat.error
      });
    } catch (e) {
      if (req !== catalogReq) return;
      set({ catalogLoading: false, catalogError: (e as Error).message });
    }
  },

  addLoraRow: () =>
    set(s => ({ genLoras: [...s.genLoras, { id: loraRowId++, path: "", mult: "1" }] })),

  removeLoraRow: (id) => set(s => ({ genLoras: s.genLoras.filter(r => r.id !== id) })),

  updateLoraRow: (id, patch) =>
    set(s => ({ genLoras: s.genLoras.map(r => (r.id === id ? { ...r, ...patch } : r)) })),

  generate: async () => {
    const s = get();
    if (s.genBusy) return;
    let prompt: string;
    if (s.jsonMode) {
      prompt = toLayoutText(
        summaryFromState({ metaText: s.metaText, canvasType: s.canvasType, sceneCaption: s.sceneCaption }),
        s.boxes
      );
    } else {
      if (!s.sceneCaption.trim()) {
        set({ genStatus: { msg: "specify a caption", isError: true } });
        return;
      }
      prompt = s.sceneCaption;
    }
    const ew = s.genFromCanvas ? String(s.width) : s.genW;
    const eh = s.genFromCanvas ? String(s.height) : s.genH;
    let body: ReturnType<typeof buildGenBody>["body"];
    let clamped: ReturnType<typeof buildGenBody>["clamped"];
    try {
      ({ body, clamped } = buildGenBody({
        prompt,
        negativePrompt: s.negPrompt,
        width: ew,
        height: eh,
        count: s.genCount,
        steps: s.genSteps,
        cfg: s.genCfg,
        seed: s.genSeed,
        clip: s.genClipManual ? s.genClip : "-1",
        scheduler: s.genSched,
        method: s.genMethod,
        loras: s.genLoras,
        livePreviewMode: s.genAutoBg ? s.genLivePreviewMode : "none",
        livePreviewModes: s.previewModes
      }));
    } catch (e) {
      set({ genStatus: { msg: (e as Error).message, isError: true } });
      return;
    }
    if (!s.genFromCanvas) {
      set({ genW: String(clamped.width), genH: String(clamped.height) });
    }
    set({ genCount: String(clamped.count), genSteps: String(clamped.steps) });
    const base = s.genUrl.trim().replace(/\/+$/, "");
    if (!base) {
      set({ genStatus: { msg: "specify the server URL", isError: true } });
      return;
    }
    genJobId = null;
    genBaseUrl = "";
    cancelRequested = false;
    lastPreviewB64 = "";
    set({ genBusy: true, genPreviewFrame: null });
    const t0 = Date.now();
    try {
      const job = (await apiFetch(base + "/sdcpp/v1/img_gen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      })) as Job | null;
      const id = job && (job.id !== undefined ? job.id : job.job_id);
      if (!job || !id) throw new Error("the server did not return a job id: " + JSON.stringify(job));
      genJobId = id;
      genBaseUrl = base;
      set({ genStatus: { msg: "sent (job " + id + "), running...", isError: false } });
      if (cancelRequested) {
        cancelRequested = false;
        await cancelJob(base, id);
      }
      genTimer = window.setInterval(() => {
        const frame = get().genPreviewFrame;
        const suffix = frame && frame.totalSteps > 0
          ? " · step " + frame.step + "/" + frame.totalSteps + (frame.pass > 1 ? " (pass " + frame.pass + ")" : "")
          : "";
        set({ genStatus: { msg: "running... " + ((Date.now() - t0) / 1000).toFixed(0) + "s" + suffix, isError: false } });
      }, 500);
      const result = await waitForJob(base, job, (preview: JobPreview) => {
        if (!preview.b64_json || preview.b64_json === lastPreviewB64) return;
        lastPreviewB64 = preview.b64_json;
        loadImage("data:image/png;base64," + preview.b64_json)
          .then(img => {
            if (!get().genBusy) return;
            set({
              genPreviewFrame: {
                img,
                step: preview.step ?? 0,
                totalSteps: preview.total_steps ?? 0,
                pass: preview.pass ?? 1
              }
            });
          })
          .catch(() => {
            /* skip a broken preview frame */
          });
      });
      const images = result.images || [];
      if (!images.length) throw new Error("the server did not return any images");
      const format = result.output_format || "png";
      const params: GenItemParams = {
        server: base,
        negativePrompt: body.negative_prompt,
        width: body.width,
        height: body.height,
        count: body.batch_count,
        steps: body.sample_params.sample_steps,
        cfg: body.sample_params.guidance.txt_cfg,
        seed: typeof result.seed === "number" ? result.seed : body.seed,
        clipSkip: body.clip_skip,
        scheduler: body.sample_params.scheduler,
        method: body.sample_params.sample_method,
        loras: body.lora.map(l => ({ path: l.path, mult: l.multiplier })),
        format,
        createdAt: Date.now()
      };
      let lastEl: HTMLImageElement | null = null;
      for (const img of images) {
        if (!img.b64_json) throw new Error("image without a b64_json field");
        const el = await loadImage("data:image/" + format + ";base64," + img.b64_json);
        get().addGalleryItem(el, prompt, params);
        lastEl = el;
      }
      if (lastEl && get().genAutoBg) {
        const st = get();
        set({
          bgImage: lastEl,
          bgInfo:
            lastEl.naturalWidth + "×" + lastEl.naturalHeight + " → " + st.width + "×" + st.height + " (generated)"
        });
      }
      if (genTimer !== null) clearInterval(genTimer);
      genTimer = null;
      set({ genStatus: { msg: "done in " + ((Date.now() - t0) / 1000).toFixed(1) + "s (" + images.length + ")", isError: false } });
    } catch (e) {
      if (genTimer !== null) clearInterval(genTimer);
      genTimer = null;
      const cancelled = e instanceof JobCancelledError;
      set({
        genStatus: {
          msg: cancelled ? "job cancelled" : "error: " + (e as Error).message,
          isError: !cancelled
        }
      });
    } finally {
      genJobId = null;
      genBaseUrl = "";
      lastPreviewB64 = "";
      set({ genBusy: false, genPreviewFrame: null });
    }
  },

  cancelGeneration: async () => {
    if (!get().genBusy) return;
    if (genTimer !== null) {
      clearInterval(genTimer);
      genTimer = null;
    }
    if (genJobId !== null) {
      set({ genStatus: { msg: "cancelling...", isError: false } });
      try {
        await cancelJob(genBaseUrl, genJobId);
      } catch {
        /* the job state will bring the polling in generate() to completion */
      }
    } else {
      cancelRequested = true;
      set({ genStatus: { msg: "cancelling...", isError: false } });
    }
  },

  addGalleryItem: (img, prompt, params) =>
    set(s => ({
      gallery: [{ id: s.nextId, img, prompt, params }, ...s.gallery],
      nextId: s.nextId + 1
    })),

  deleteGalleryItem: (id) => set(s => ({ gallery: s.gallery.filter(g => g.id !== id) })),

  useAsBg: (id) => {
    const s = get();
    const g = s.gallery.find(x => x.id === id);
    if (!g) return;
    if (s.bgImage === g.img) {
      set(
        s.uploadedBg
          ? { bgImage: s.uploadedBg, bgInfo: s.uploadedBgInfo }
          : { bgImage: null, bgInfo: "" }
      );
      return;
    }
    set({
      bgImage: g.img,
      bgInfo:
        g.img.naturalWidth + "×" + g.img.naturalHeight + " → " + s.width + "×" + s.height + " (generated)"
    });
  }
  });
});
