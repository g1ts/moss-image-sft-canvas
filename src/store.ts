import { create } from "zustand";
import type { Box, GalleryItem, GenItemParams, LayoutSummary, Scene } from "./types";
import { PALETTE, clampInt, toLayoutText, type ParsedLayout } from "./lib/geometry";
import { createHistory, type History } from "./lib/undoHistory";
import type { ParsedProjectScene } from "./lib/scenes";
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

function readSavedUrl(): string {
  try {
    return localStorage.getItem(LS_GEN_URL) || "";
  } catch {
    return "";
  }
}

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

// read-only: the canvas size is now stored per scene; this legacy key is
// migrated into the size of the first scene on a very first start
const LS_CANVAS_SIZE = "moss-image-sft-canvas:canvasSize";
const DEFAULT_CANVAS_SIZE = { w: 512, h: 512 };

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

const LS_SHOW_CAPTIONS = "moss-image-sft-canvas:showCaptions";

function readSavedShowCaptions(): boolean {
  try {
    const raw = localStorage.getItem(LS_SHOW_CAPTIONS);
    if (raw === null) return false;
    return raw !== "0";
  } catch {
    return false;
  }
}

function saveShowCaptions(v: boolean): void {
  try {
    localStorage.setItem(LS_SHOW_CAPTIONS, v ? "1" : "0");
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

const LS_RIGHT_HIDDEN = "moss-image-sft-canvas:rightHidden";

function readSavedRightHidden(): boolean {
  try {
    const raw = localStorage.getItem(LS_RIGHT_HIDDEN);
    if (raw === null) return false;
    return raw === "1";
  } catch {
    return false;
  }
}

function saveRightHidden(v: boolean): void {
  try {
    localStorage.setItem(LS_RIGHT_HIDDEN, v ? "1" : "0");
  } catch {
    /* ignore */
  }
}

// ---------------------------------------------------------------------------
// Scene set persistence

const LS_SCENES = "moss-image-sft-canvas:scenes";

interface SavedScenes {
  scenes: Scene[];
  activeSceneId: number;
  nextId: number;
  colorIndex: number;
}

function isBox(b: unknown): b is Box {
  if (!b || typeof b !== "object") return false;
  const o = b as Record<string, unknown>;
  return (
    typeof o.id === "number" &&
    typeof o.label === "string" &&
    typeof o.caption === "string" &&
    typeof o.text === "string" &&
    typeof o.xmin === "number" &&
    typeof o.xmax === "number" &&
    typeof o.ymin === "number" &&
    typeof o.ymax === "number" &&
    typeof o.color === "string" &&
    typeof o.z === "number" &&
    typeof o.hidden === "boolean" &&
    typeof o.locked === "boolean"
  );
}

function isScene(sc: unknown): sc is Scene {
  if (!sc || typeof sc !== "object") return false;
  const o = sc as Record<string, unknown>;
  return (
    typeof o.id === "number" &&
    typeof o.name === "string" &&
    typeof o.width === "number" &&
    typeof o.height === "number" &&
    isFinite(o.width as number) &&
    isFinite(o.height as number) &&
    (o.width as number) > 0 &&
    (o.height as number) > 0 &&
    Array.isArray(o.boxes) &&
    (o.boxes as unknown[]).every(isBox) &&
    typeof o.metaText === "string" &&
    typeof o.canvasType === "string" &&
    typeof o.sceneCaption === "string" &&
    typeof o.negPrompt === "string" &&
    (o.bgDataUrl === null || typeof o.bgDataUrl === "string") &&
    (o.uploadedBgDataUrl === null || typeof o.uploadedBgDataUrl === "string") &&
    typeof o.bgInfo === "string" &&
    typeof o.uploadedBgInfo === "string"
  );
}

function readSavedScenes(): SavedScenes | null {
  try {
    const raw = localStorage.getItem(LS_SCENES);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as
      | { scenes?: unknown; activeSceneId?: unknown; nextId?: unknown; colorIndex?: unknown }
      | null;
    if (!parsed || typeof parsed !== "object") return null;
    if (!Array.isArray(parsed.scenes) || !parsed.scenes.length || !(parsed.scenes as unknown[]).every(isScene)) {
      return null;
    }
    const scenes = parsed.scenes as Scene[];
    const activeSceneId =
      typeof parsed.activeSceneId === "number" && scenes.some(sc => sc.id === parsed.activeSceneId)
        ? parsed.activeSceneId
        : scenes[0].id;
    let nextId = 1;
    for (const sc of scenes) for (const b of sc.boxes) nextId = Math.max(nextId, b.id + 1);
    return {
      scenes,
      activeSceneId,
      nextId,
      colorIndex: typeof parsed.colorIndex === "number" && Number.isFinite(parsed.colorIndex) ? parsed.colorIndex : 0
    };
  } catch {
    return null;
  }
}

function makeScene(id: number, name: string, w: number, h: number): Scene {
  return {
    id,
    name,
    width: w,
    height: h,
    boxes: [],
    metaText: "",
    canvasType: "single",
    sceneCaption: "",
    negPrompt: "",
    bgDataUrl: null,
    uploadedBgDataUrl: null,
    bgInfo: "",
    uploadedBgInfo: ""
  };
}

let saveTimer: number | null = null;

function persistScenes(): void {
  const s = useStore.getState();
  const payload: SavedScenes = {
    scenes: s.scenes,
    activeSceneId: s.activeSceneId,
    nextId: s.nextId,
    colorIndex: s.colorIndex
  };
  try {
    localStorage.setItem(LS_SCENES, JSON.stringify(payload));
  } catch {
    // the quota may be exceeded by the background data URLs — retry without them
    try {
      localStorage.setItem(
        LS_SCENES,
        JSON.stringify({
          ...payload,
          scenes: payload.scenes.map(sc => ({
            ...sc,
            bgDataUrl: null,
            uploadedBgDataUrl: null,
            bgInfo: "",
            uploadedBgInfo: ""
          }))
        })
      );
    } catch {
      /* ignore */
    }
  }
}

function scheduleSave(): void {
  if (saveTimer !== null) return;
  saveTimer = window.setTimeout(() => {
    saveTimer = null;
    persistScenes();
  }, 500);
}

function flushSave(): void {
  if (saveTimer !== null) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  persistScenes();
}

window.addEventListener("beforeunload", flushSave);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") flushSave();
});

// ---------------------------------------------------------------------------
// The store

let genTimer: number | null = null;
let genJobId: string | number | null = null;
let genBaseUrl: string = "";
let cancelRequested = false;
let lastPreviewB64 = "";
let loraRowId = 1;
let catalogReq = 0;

interface CanvasState extends GenParams {
  scenes: Scene[];
  activeSceneId: number;
  selectedId: number | null;
  hoveredId: number | null;
  pendingBoxId: number | null;
  pendingIsNew: boolean;
  nextId: number;
  colorIndex: number;
  bgImage: HTMLImageElement | null;
  gallery: GalleryItem[];
  genBusy: boolean;
  genStatus: GenStatus;
  genPreviewFrame: GenPreviewFrame | null;
  cursor: { x: number; y: number } | null;
  action: string;
  toast: string;
  toastError: boolean;
  toastId: number;
  jsonMode: boolean;
  showGrid: boolean;
  showCaptions: boolean;
  gridSize: number;
  snapToGrid: boolean;
  alignEnabled: boolean;
  galleryHidden: boolean;
  rightHidden: boolean;
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

  addScene: () => void;
  duplicateScene: (id: number) => void;
  renameScene: (id: number, name: string) => void;
  deleteScene: (id: number) => void;
  setActiveScene: (id: number) => void;
  importProject: (parsed: ParsedProjectScene[]) => void;

  applySize: (w: number, h: number) => void;
  setUploadedBg: (img: HTMLImageElement | null, info: string, dataUrl: string | null) => void;
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
  duplicateBox: (id: number) => void;
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
  setShowCaptions: (v: boolean) => void;
  setGridSize: (v: string | number) => void;
  setSnapToGrid: (v: boolean) => void;
  setAlignEnabled: (v: boolean) => void;
  setGalleryHidden: (v: boolean) => void;
  setRightHidden: (v: boolean) => void;
  removeLabelHistory: (label: string) => void;
  rememberLabel: (label: string) => void;
  rememberMeta: (text: string) => void;
  setCursor: (x: number, y: number) => void;
  setAction: (text: string) => void;
  showToast: (msg: string, isError?: boolean) => void;
  clearToast: () => void;
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

export function activeScene(s: { scenes: Scene[]; activeSceneId: number }): Scene {
  return s.scenes.find(sc => sc.id === s.activeSceneId) ?? s.scenes[0];
}

// The canvas and the boxes own the keyboard: whenever a box becomes selected (or the
// mouse goes down on the canvas) a focused text field is blurred, so hotkeys can never
// silently "go into the field" while a box is selected
export function blurActiveField(): void {
  const el = document.activeElement;
  if (!(el instanceof HTMLElement)) return;
  const tag = el.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable) {
    el.blur();
  }
}

// Undo/redo is kept per scene (not the exported JSON):
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

function docSnap(sc: Scene): DocSnap {
  return {
    boxes: sc.boxes.map(b => ({ ...b })),
    metaText: sc.metaText,
    canvasType: sc.canvasType,
    sceneCaption: sc.sceneCaption,
    negPrompt: sc.negPrompt
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

const sceneHistories = new Map<number, History<DocSnap>>();

function histOf(id: number): History<DocSnap> {
  let h = sceneHistories.get(id);
  if (!h) {
    h = createHistory<DocSnap>({
      limit: UNDO_LIMIT,
      coalesceMs: UNDO_COALESCE_MS,
      fingerprint: docFingerprint
    });
    sceneHistories.set(id, h);
  }
  return h;
}

// keys of discrete operations must be unique (undo of a delete inside the coalesce window of a new delete)
let opSeq = 0;

const histFlagsOf = (id: number) => {
  const h = histOf(id);
  return { canUndo: h.canUndo, canRedo: h.canRedo };
};

export function summaryFromState(s: { metaText: string; canvasType: string; sceneCaption: string }): LayoutSummary {
  return {
    meta: splitMeta(s.metaText),
    canvas: s.canvasType,
    caption: s.sceneCaption
  };
}

// A background image element for a scene data URL; reuses the current element when it matches.
// Returns null while a fresh image is still decoding; onload then sets it via setState,
// which triggers a redraw (state never holds an undecoded element)
function bgImageFor(url: string, sceneId: number): HTMLImageElement | null {
  const cur = useStore.getState().bgImage;
  if (cur && cur.src === url && cur.complete && cur.naturalWidth > 0) return cur;
  const img = new Image();
  img.onload = () => {
    const st = useStore.getState();
    const act = activeScene(st);
    if (act.id === sceneId && act.bgDataUrl === url && st.bgImage !== img) {
      useStore.setState({ bgImage: img });
    }
  };
  img.src = url;
  return img.complete && img.naturalWidth > 0 ? img : null;
}

const savedScenes = readSavedScenes();
const legacySize = readSavedSize();
const initialScenes = savedScenes ? savedScenes.scenes : [makeScene(1, "Scene 1", legacySize.w, legacySize.h)];

export const useStore = create<CanvasState>()((set, get) => {
  // update fields of the active scene; extra = additional global state to set
  const updateActive = (patch: Partial<Scene> | ((sc: Scene) => Partial<Scene>), extra: Partial<CanvasState> = {}) => {
    set(s => {
      const sc = activeScene(s);
      const p = typeof patch === "function" ? patch(sc) : patch;
      return {
        scenes: s.scenes.map(x => (x.id === sc.id ? { ...x, ...p } : x)),
        ...extra
      };
    });
    scheduleSave();
  };

  // commit a pending text-edit session of the active scene (it becomes stale on scene ops)
  const commitPending = () => {
    const sc = activeScene(get());
    histOf(sc.id).end(docSnap(sc));
  };

  const setDoc = (snap: DocSnap) => {
    const s = get();
    const sc = activeScene(s);
    histOf(sc.id).cancel(); // a pending text-edit session is stale once the document is replaced
    const ids = new Set(snap.boxes.map(b => b.id));
    const keep = (id: number | null) => (id !== null && !ids.has(id) ? null : id);
    updateActive(
      {
        boxes: snap.boxes.map(b => ({ ...b })),
        metaText: snap.metaText,
        canvasType: snap.canvasType,
        sceneCaption: snap.sceneCaption,
        negPrompt: snap.negPrompt
      },
      {
        selectedId: keep(s.selectedId),
        hoveredId: keep(s.hoveredId),
        pendingBoxId: keep(s.pendingBoxId),
        pendingIsNew: keep(s.pendingBoxId) ? s.pendingIsNew : false,
        ...histFlagsOf(sc.id)
      }
    );
  };

  return ({
  scenes: initialScenes,
  activeSceneId: savedScenes ? savedScenes.activeSceneId : initialScenes[0].id,
  selectedId: null,
  hoveredId: null,
  pendingBoxId: null,
  pendingIsNew: false,
  nextId: savedScenes ? savedScenes.nextId : 1,
  colorIndex: savedScenes ? savedScenes.colorIndex : 0,
  bgImage: null,
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
  toast: "",
  toastError: false,
  toastId: 0,
  jsonMode: true,
  showGrid: readSavedGrid(),
  showCaptions: readSavedShowCaptions(),
  gridSize: readSavedGridSize(),
  snapToGrid: readSavedSnapGrid(),
  alignEnabled: readSavedAlign(),
  galleryHidden: readSavedGalleryHidden(),
  rightHidden: readSavedRightHidden(),
  labelHistory: loadHistory(LABEL_HISTORY_KEY),
  metaHistory: loadHistory(META_HISTORY_KEY),
  canUndo: false,
  canRedo: false,

  undo: () => {
    const sc = activeScene(get());
    const snap = histOf(sc.id).undo(docSnap(sc));
    if (!snap) return;
    setDoc(snap);
  },

  redo: () => {
    const sc = activeScene(get());
    const snap = histOf(sc.id).redo(docSnap(sc));
    if (!snap) return;
    setDoc(snap);
  },

  beginChange: () => {
    const sc = activeScene(get());
    histOf(sc.id).begin(docSnap(sc));
  },

  endChange: () => {
    const sc = activeScene(get());
    if (histOf(sc.id).end(docSnap(sc))) {
      set(histFlagsOf(sc.id));
      scheduleSave();
    }
  },

  cancelChange: () => {
    const sc = activeScene(get());
    histOf(sc.id).cancel();
  },

  addScene: () => {
    const s = get();
    const sc = activeScene(s);
    const id = Math.max(0, ...s.scenes.map(x => x.id)) + 1;
    commitPending();
    const scene = makeScene(id, "Scene " + id, sc.width, sc.height);
    set({
      scenes: [...s.scenes, scene],
      activeSceneId: id,
      selectedId: null,
      hoveredId: null,
      pendingBoxId: null,
      pendingIsNew: false,
      bgImage: null,
      canUndo: false,
      canRedo: false
    });
    scheduleSave();
  },

  duplicateScene: (id) => {
    const s = get();
    const src = s.scenes.find(x => x.id === id);
    if (!src) return;
    commitPending();
    const newId = Math.max(0, ...s.scenes.map(x => x.id)) + 1;
    let nid = s.nextId;
    const boxes = src.boxes.map(b => ({ ...b, id: nid++ }));
    const scene: Scene = { ...src, id: newId, name: src.name + " copy", boxes };
    const idx = s.scenes.findIndex(x => x.id === id);
    const scenes = s.scenes.slice();
    scenes.splice(idx + 1, 0, scene);
    set({
      scenes,
      nextId: nid,
      activeSceneId: newId,
      selectedId: null,
      hoveredId: null,
      pendingBoxId: null,
      pendingIsNew: false,
      bgImage: scene.bgDataUrl ? bgImageFor(scene.bgDataUrl, newId) : null,
      canUndo: false,
      canRedo: false
    });
    scheduleSave();
  },

  renameScene: (id, name) => {
    const n = name.trim();
    if (!n) return;
    set(s => ({ scenes: s.scenes.map(x => (x.id === id ? { ...x, name: n } : x)) }));
    scheduleSave();
  },

  deleteScene: (id) => {
    const s = get();
    if (s.scenes.length <= 1) return;
    const idx = s.scenes.findIndex(x => x.id === id);
    if (idx === -1) return;
    commitPending();
    const scenes = s.scenes.filter(x => x.id !== id);
    sceneHistories.delete(id);
    const switching = s.activeSceneId === id;
    const next = scenes[Math.min(idx, scenes.length - 1)];
    set({
      scenes,
      activeSceneId: switching ? next.id : s.activeSceneId,
      selectedId: null,
      hoveredId: null,
      pendingBoxId: null,
      pendingIsNew: false,
      bgImage: switching ? (next.bgDataUrl ? bgImageFor(next.bgDataUrl, next.id) : null) : s.bgImage,
      ...(switching ? histFlagsOf(next.id) : {})
    });
    scheduleSave();
  },

  setActiveScene: (id) => {
    const s = get();
    const target = s.scenes.find(x => x.id === id);
    if (!target || id === s.activeSceneId) return;
    commitPending();
    set({
      activeSceneId: id,
      selectedId: null,
      hoveredId: null,
      pendingBoxId: null,
      pendingIsNew: false,
      bgImage: target.bgDataUrl ? bgImageFor(target.bgDataUrl, id) : null,
      ...histFlagsOf(id)
    });
    scheduleSave();
  },

  importProject: (parsed) => {
    if (!parsed.length) return;
    const s = get();
    commitPending();
    sceneHistories.clear(); // every scene id is replaced
    let nextId = s.nextId;
    let colorIndex = s.colorIndex;
    let sceneId = Math.max(0, ...s.scenes.map(x => x.id)) + 1;
    let labelHistory = s.labelHistory;
    let metaHistory = s.metaHistory;
    const scenes: Scene[] = parsed.map((p, i) => {
      for (const it of p.layout.items) labelHistory = rememberValue(labelHistory, it.label);
      if (p.layout.summary) metaHistory = rememberValues(metaHistory, p.layout.summary.meta);
      const boxes: Box[] = p.layout.items.map((it, j) => {
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
          z: j + 1,
          hidden: it.hidden,
          locked: it.locked
        };
      });
      const sm = p.layout.summary;
      return {
        id: sceneId++,
        name: p.name || "Scene " + (i + 1),
        width: p.width,
        height: p.height,
        boxes,
        metaText: sm ? sm.meta.join(", ") : "",
        canvasType: sm ? sm.canvas : "single",
        sceneCaption: sm ? sm.caption : "",
        negPrompt: p.negPrompt,
        bgDataUrl: p.bg,
        uploadedBgDataUrl: p.uploadedBg,
        bgInfo: p.bg ? "imported" : "",
        uploadedBgInfo: p.uploadedBg ? "imported" : ""
      };
    });
    saveHistory(LABEL_HISTORY_KEY, labelHistory);
    saveHistory(META_HISTORY_KEY, metaHistory);
    const first = scenes[0];
    set({
      scenes,
      activeSceneId: first.id,
      nextId,
      colorIndex,
      labelHistory,
      metaHistory,
      selectedId: null,
      hoveredId: null,
      pendingBoxId: null,
      pendingIsNew: false,
      bgImage: first.bgDataUrl ? bgImageFor(first.bgDataUrl, first.id) : null,
      canUndo: false,
      canRedo: false
    });
    scheduleSave();
  },

  applySize: (w, h) => {
    updateActive({ width: w, height: h });
  },

  setUploadedBg: (img, info, dataUrl) => {
    updateActive({
      bgDataUrl: dataUrl,
      uploadedBgDataUrl: dataUrl,
      bgInfo: info,
      uploadedBgInfo: info
    });
    set({ bgImage: img });
  },

  select: (id) => {
    if (id !== null) blurActiveField();
    set(s => {
      const sc = activeScene(s);
      if (id === null) return { selectedId: null };
      const idx = sc.boxes.findIndex(b => b.id === id);
      if (idx === -1) return { selectedId: id };
      const topZ = sc.boxes.reduce((m, b) => Math.max(m, b.z), 0);
      if (sc.boxes[idx].z === topZ) return { selectedId: id };
      const boxes = sc.boxes.map(b => (b.id === id ? { ...b, z: topZ + 1 } : b));
      return {
        selectedId: id,
        scenes: s.scenes.map(x => (x.id === sc.id ? { ...x, boxes } : x))
      };
    });
  },

  setHoveredId: (id) => set(s => (s.hoveredId === id ? {} : { hoveredId: id })),

  // commit any pending text-edit session: closing the modal (Enter, Escape, buttons)
  // unmounts the focused field, so its blur event never fires
  setPendingBoxId: (id) => {
    const sc = activeScene(get());
    histOf(sc.id).end(docSnap(sc));
    set({ pendingBoxId: id, pendingIsNew: false, ...histFlagsOf(sc.id) });
  },

  openBoxEditor: (id) => {
    get().select(id);
    set({ pendingBoxId: id, pendingIsNew: false });
  },

  beginDraw: (x, y) => {
    const s = get();
    const sc = activeScene(s);
    const topZ = sc.boxes.reduce((m, b) => Math.max(m, b.z), 0);
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

  finishDraw: (box) => {
    set(s => {
      const sc = activeScene(s);
      return {
        scenes: s.scenes.map(x => (x.id === sc.id ? { ...x, boxes: [...x.boxes, box] } : x)),
        selectedId: box.id,
        pendingBoxId: box.id,
        pendingIsNew: true
      };
    });
    scheduleSave();
  },

  touchBoxes: () => {
    set(s => {
      const sc = activeScene(s);
      return { scenes: s.scenes.map(x => (x.id === sc.id ? { ...x, boxes: [...x.boxes] } : x)) };
    });
    scheduleSave();
  },

  updateBox: (id, patch) => {
    const s = get();
    const sc = activeScene(s);
    if (!sc.boxes.some(b => b.id === id)) return;
    // label/caption/text edit live while the field is focused — their session commits on blur
    const isText = patch.label !== undefined || patch.caption !== undefined || patch.text !== undefined;
    if (!isText) {
      const field =
        patch.xmin !== undefined || patch.xmax !== undefined || patch.ymin !== undefined || patch.ymax !== undefined
          ? "coords"
          : Object.keys(patch)[0] || "patch";
      histOf(sc.id).record(docSnap(sc), "box:" + id + ":" + field);
    }
    set(s2 => {
      const sc2 = activeScene(s2);
      const toggled = patch.hidden !== undefined || patch.locked !== undefined;
      return {
        scenes: s2.scenes.map(x =>
          x.id === sc2.id ? { ...x, boxes: x.boxes.map(b => (b.id === id ? { ...b, ...patch } : b)) } : x
        ),
        ...(toggled && s2.hoveredId === id ? { hoveredId: null } : {}),
        ...histFlagsOf(sc2.id)
      };
    });
    scheduleSave();
  },

  deleteBox: (id) => {
    const s = get();
    const sc = activeScene(s);
    if (!sc.boxes.some(b => b.id === id)) return;
    histOf(sc.id).record(docSnap(sc), "op:" + ++opSeq);
    set(s2 => {
      const sc2 = activeScene(s2);
      return {
        scenes: s2.scenes.map(x => (x.id === sc2.id ? { ...x, boxes: x.boxes.filter(b => b.id !== id) } : x)),
        selectedId: s2.selectedId === id ? null : s2.selectedId,
        hoveredId: s2.hoveredId === id ? null : s2.hoveredId,
        pendingBoxId: s2.pendingBoxId === id ? null : s2.pendingBoxId,
        pendingIsNew: s2.pendingBoxId === id ? false : s2.pendingIsNew,
        ...histFlagsOf(sc2.id)
      };
    });
    scheduleSave();
  },

  duplicateBox: (id) => {
    const s = get();
    const sc = activeScene(s);
    const src = sc.boxes.find(b => b.id === id);
    if (!src) return;
    histOf(sc.id).record(docSnap(sc), "op:" + ++opSeq);
    const OFF = 16;
    const topZ = sc.boxes.reduce((m, b) => Math.max(m, b.z), 0);
    const copy: Box = {
      ...src,
      id: s.nextId,
      xmin: src.xmin + OFF,
      xmax: src.xmax + OFF,
      ymin: src.ymin + OFF,
      ymax: src.ymax + OFF,
      z: topZ + 1
    };
    set(s2 => {
      const sc2 = activeScene(s2);
      return {
        scenes: s2.scenes.map(x => (x.id === sc2.id ? { ...x, boxes: [...x.boxes, copy] } : x)),
        nextId: s2.nextId + 1,
        selectedId: copy.id,
        ...histFlagsOf(sc2.id)
      };
    });
    scheduleSave();
  },

  moveBox: (id, toIndex) => {
    const s = get();
    const sc = activeScene(s);
    if (sc.boxes.findIndex(b => b.id === id) === -1) return;
    histOf(sc.id).record(docSnap(sc), "op:" + ++opSeq);
    set(s2 => {
      const sc2 = activeScene(s2);
      const from = sc2.boxes.findIndex(b => b.id === id);
      if (from === -1) return {};
      const boxes = sc2.boxes.slice();
      const [box] = boxes.splice(from, 1);
      const target = Math.max(0, Math.min(from < toIndex ? toIndex - 1 : toIndex, boxes.length));
      boxes.splice(target, 0, box);
      return {
        scenes: s2.scenes.map(x => (x.id === sc2.id ? { ...x, boxes } : x)),
        ...histFlagsOf(sc2.id)
      };
    });
    scheduleSave();
  },

  clearAll: () => {
    const s = get();
    const sc = activeScene(s);
    const empty = !sc.boxes.length && !sc.metaText && !sc.canvasType && !sc.sceneCaption && !sc.negPrompt;
    if (!empty) histOf(sc.id).record(docSnap(sc), "op:" + ++opSeq);
    set(s2 => {
      const sc2 = activeScene(s2);
      return {
        scenes: s2.scenes.map(x =>
          x.id === sc2.id
            ? { ...x, boxes: [], metaText: "", canvasType: "single", sceneCaption: "", negPrompt: "" }
            : x
        ),
        selectedId: null,
        hoveredId: null,
        pendingBoxId: null,
        pendingIsNew: false,
        ...histFlagsOf(sc2.id)
      };
    });
    scheduleSave();
  },

  importLayout: (parsed) => {
    const s = get();
    const sc = activeScene(s);
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
        hidden: it.hidden,
        locked: it.locked
      };
    });
    const sm = parsed.summary;
    const nextMeta = sm ? sm.meta.join(", ") : sc.metaText;
    const nextCanvas = sm ? sm.canvas : sc.canvasType;
    const nextCaption = sm ? sm.caption : sc.sceneCaption;
    if (
      docFingerprint({ boxes, metaText: nextMeta, canvasType: nextCanvas, sceneCaption: nextCaption, negPrompt: sc.negPrompt }) !==
      docFingerprint(docSnap(sc))
    ) {
      histOf(sc.id).record(docSnap(sc), "op:" + ++opSeq);
    }
    saveHistory(LABEL_HISTORY_KEY, labelHistory);
    saveHistory(META_HISTORY_KEY, metaHistory);
    set(s2 => {
      const sc2 = activeScene(s2);
      return {
        scenes: s2.scenes.map(x =>
          x.id === sc2.id
            ? { ...x, boxes, metaText: nextMeta, canvasType: nextCanvas, sceneCaption: nextCaption }
            : x
        ),
        nextId,
        colorIndex,
        labelHistory,
        metaHistory,
        selectedId: null,
        hoveredId: null,
        ...histFlagsOf(sc2.id)
      };
    });
    scheduleSave();
  },

  // typing sessions commit on blur (see beginChange/endChange)
  setMetaText: (text) => {
    const sc = activeScene(get());
    if (sc.metaText === text) return;
    updateActive({ metaText: text });
  },

  // Discrete edits from the meta picker: a pending typing session is committed first,
  // then the step is recorded, so both stay separately undoable
  removeMetaValue: (value) => {
    const s = get();
    const sc = activeScene(s);
    const k = value.trim().toLowerCase();
    if (!k) return;
    const cur = splitMeta(sc.metaText);
    const next = cur.filter(t => t.toLowerCase() !== k);
    if (next.length === cur.length) return;
    const h = histOf(sc.id);
    h.end(docSnap(sc));
    h.record(docSnap(sc), "op:" + ++opSeq);
    updateActive({ metaText: next.join(", ") }, { ...histFlagsOf(sc.id) });
    if (document.activeElement === document.getElementById("jsonMeta")) {
      const sc2 = activeScene(get());
      histOf(sc2.id).begin(docSnap(sc2));
    }
  },

  addMetaValue: (value) => {
    const v = value.trim();
    if (!v) return;
    const s = get();
    const sc = activeScene(s);
    const cur = splitMeta(sc.metaText);
    if (cur.some(t => t.toLowerCase() === v.toLowerCase())) return;
    const h = histOf(sc.id);
    h.end(docSnap(sc));
    h.record(docSnap(sc), "op:" + ++opSeq);
    const mh = rememberValues(s.metaHistory, [v]);
    saveHistory(META_HISTORY_KEY, mh);
    updateActive({ metaText: cur.length ? cur.join(", ") + ", " + v : v }, { metaHistory: mh, ...histFlagsOf(sc.id) });
    if (document.activeElement === document.getElementById("jsonMeta")) {
      const sc2 = activeScene(get());
      histOf(sc2.id).begin(docSnap(sc2));
    }
  },

  setCanvasType: (text) => {
    const sc = activeScene(get());
    if (sc.canvasType === text) return;
    updateActive({ canvasType: text });
  },

  setSceneCaption: (text) => {
    const sc = activeScene(get());
    if (sc.sceneCaption === text) return;
    updateActive({ sceneCaption: text });
  },

  setNegPrompt: (text) => {
    const sc = activeScene(get());
    if (sc.negPrompt === text) return;
    updateActive({ negPrompt: text });
  },

  setJsonMode: (v) => set({ jsonMode: v }),

  setShowGrid: (v) => {
    set({ showGrid: v });
    saveGrid(v);
  },

  setShowCaptions: (v) => {
    set({ showCaptions: v });
    saveShowCaptions(v);
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

  setRightHidden: (v) => {
    set({ rightHidden: v });
    saveRightHidden(v);
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

  showToast: (msg, isError = false) =>
    set(s => ({ toast: msg, toastError: isError, toastId: s.toastId + 1 })),
  clearToast: () => set({ toast: "" }),

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
    const sc = activeScene(s);
    let prompt: string;
    if (s.jsonMode) {
      prompt = toLayoutText(
        summaryFromState({ metaText: sc.metaText, canvasType: sc.canvasType, sceneCaption: sc.sceneCaption }),
        sc.boxes
      );
    } else {
      if (!sc.sceneCaption.trim()) {
        set({ genStatus: { msg: "specify a caption", isError: true } });
        return;
      }
      prompt = sc.sceneCaption;
    }
    const ew = s.genFromCanvas ? String(sc.width) : s.genW;
    const eh = s.genFromCanvas ? String(sc.height) : s.genH;
    let body: ReturnType<typeof buildGenBody>["body"];
    let clamped: ReturnType<typeof buildGenBody>["clamped"];
    try {
      ({ body, clamped } = buildGenBody({
        prompt,
        negativePrompt: sc.negPrompt,
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
        const act = activeScene(st);
        set({ bgImage: lastEl });
        set(s2 => ({
          scenes: s2.scenes.map(x =>
            x.id === act.id
              ? {
                  ...x,
                  bgDataUrl: lastEl.src,
                  bgInfo:
                    lastEl.naturalWidth + "×" + lastEl.naturalHeight + " → " + x.width + "×" + x.height + " (generated)"
                }
              : x
          )
        }));
        scheduleSave();
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
    const sc = activeScene(s);
    const g = s.gallery.find(x => x.id === id);
    if (!g) return;
    if (s.bgImage === g.img) {
      const url = sc.uploadedBgDataUrl;
      updateActive(
        { bgDataUrl: url, bgInfo: url ? sc.uploadedBgInfo : "" },
        { bgImage: url ? bgImageFor(url, sc.id) : null }
      );
      return;
    }
    updateActive(
      {
        bgDataUrl: g.img.src,
        bgInfo:
          g.img.naturalWidth + "×" + g.img.naturalHeight + " → " + sc.width + "×" + sc.height + " (generated)"
      },
      { bgImage: g.img }
    );
  }
  });
});

// restore the background of the initial active scene (the image loads asynchronously)
{
  const s = useStore.getState();
  const sc = activeScene(s);
  if (sc.bgDataUrl) bgImageFor(sc.bgDataUrl, sc.id);
}
