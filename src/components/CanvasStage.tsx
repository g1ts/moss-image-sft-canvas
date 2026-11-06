import { useCallback, useEffect, useRef, type MouseEvent as ReactMouseEvent } from "react";
import { useStore } from "../store";
import GearIcon from "./GearIcon";
import {
  alignCandidates,
  boxSize,
  boxText,
  commitBox,
  computeAlign,
  handlePoints,
  hexToRgba,
  norm,
  snapToCandidate,
  snapVal,
  type AlignGuide,
  type Pt
} from "../lib/geometry";
import type { Box } from "../types";

type Drag =
  | { mode: "draw"; box: Box }
  | { mode: "move"; start: Pt; orig: Box; box: Box }
  | { mode: "resize"; handle: string; start: Pt; orig: Box; box: Box };

export default function CanvasStage({ onOpenSettings }: { onOpenSettings: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const renderScaleRef = useRef(1);
  const dragRef = useRef<Drag | null>(null);
  const guidesRef = useRef<AlignGuide[] | null>(null);

  const boxes = useStore(s => s.boxes);
  const selectedId = useStore(s => s.selectedId);
  const hoveredId = useStore(s => s.hoveredId);
  const setHoveredId = useStore(s => s.setHoveredId);
  const bgImage = useStore(s => s.bgImage);
  const genBusy = useStore(s => s.genBusy);
  const genPreviewFrame = useStore(s => s.genPreviewFrame);
  const width = useStore(s => s.width);
  const height = useStore(s => s.height);
  const jsonMode = useStore(s => s.jsonMode);
  const showGrid = useStore(s => s.showGrid);
  const gridSize = useStore(s => s.gridSize);

  const draw = useCallback(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    const st = useStore.getState();
    const W = st.width, H = st.height;
    ctx.setTransform(renderScaleRef.current, 0, 0, renderScaleRef.current, 0, 0);
    ctx.clearRect(-W / 2, -H / 2, W, H);
    ctx.translate(W / 2, H / 2);
    const frame = st.genBusy ? st.genPreviewFrame : null;
    const bg = frame ? frame.img : st.bgImage;
    if (bg) {
      ctx.drawImage(bg, -W / 2, -H / 2, W, H);
    } else {
      ctx.fillStyle = "#191d23";
      ctx.fillRect(-W / 2, -H / 2, W, H);
    }
    if (st.showGrid) drawGrid(ctx, W, H, st.gridSize);
    if (!st.jsonMode) return;
    const ordered = [...st.boxes].sort((a, b) => a.z - b.z);
    const hovId = st.hoveredId;
    for (const b of ordered) drawBox(ctx, b, b.id === st.selectedId, false, H, b.id === hovId);
    const drag = dragRef.current;
    if (drag && drag.mode === "draw") drawBox(ctx, drag.box, true, true, H, false);
    drawGuides(ctx, W, H, guidesRef.current);
    const sel = st.boxes.find(b => b.id === st.selectedId);
    if (sel) drawHandles(ctx, cv, sel);
  }, []);

  const applyAlign = useCallback((box: Box) => {
    const st = useStore.getState();
    if (!st.alignEnabled) {
      guidesRef.current = null;
      return;
    }
    const cv = canvasRef.current;
    if (!cv) return;
    const threshold = alignThreshold(cv, st.width);
    const others = st.boxes.filter(b => b.id !== box.id);
    const res = computeAlign(box, others, st.width, st.height, threshold);
    guidesRef.current = res.guides;
    if (res.dx !== 0) {
      box.xmin += res.dx;
      box.xmax += res.dx;
    }
    if (res.dy !== 0) {
      box.ymin += res.dy;
      box.ymax += res.dy;
    }
  }, []);

  const applyAlignEdge = useCallback((box: Box, handle: string) => {
    const st = useStore.getState();
    if (!st.alignEnabled) {
      guidesRef.current = null;
      return;
    }
    const cv = canvasRef.current;
    if (!cv) {
      guidesRef.current = null;
      return;
    }
    const threshold = alignThreshold(cv, st.width);
    const others = st.boxes.filter(b => b.id !== box.id);
    const { candX, candY } = alignCandidates(others, st.width, st.height);
    const guides: AlignGuide[] = [];
    const tryEdge = (axis: "x" | "y", key: "xmin" | "xmax" | "ymin" | "ymax") => {
      const at = snapToCandidate(box[key], axis === "x" ? candX : candY, threshold);
      if (at !== null) {
        box[key] = at;
        guides.push({ axis, at });
      }
    };
    if (handle.includes("w")) tryEdge("x", "xmin");
    if (handle.includes("e")) tryEdge("x", "xmax");
    if (handle.includes("n")) tryEdge("y", "ymin");
    if (handle.includes("s")) tryEdge("y", "ymax");
    guidesRef.current = guides;
  }, []);

  const resizeCanvas = useCallback(() => {
    const cv = canvasRef.current, wrap = wrapRef.current;
    if (!cv || !wrap) return;
    const st = useStore.getState();
    const availW = Math.max(50, wrap.clientWidth - 24);
    const availH = Math.max(50, wrap.clientHeight - 24);
    const scale = Math.min(availW / st.width, availH / st.height, 2);
    cv.style.width = Math.round(st.width * scale) + "px";
    cv.style.height = Math.round(st.height * scale) + "px";
    const dpr = window.devicePixelRatio || 1;
    cv.width = Math.max(1, Math.round(st.width * scale * dpr));
    cv.height = Math.max(1, Math.round(st.height * scale * dpr));
    renderScaleRef.current = scale * dpr;
    draw();
  }, [draw]);

  const toLogical = useCallback((clientX: number, clientY: number): Pt => {
    const cv = canvasRef.current!;
    const r = cv.getBoundingClientRect();
    const st = useStore.getState();
    return {
      x: (clientX - r.left) * (st.width / r.width) - st.width / 2,
      y: (clientY - r.top) * (st.height / r.height) - st.height / 2
    };
  }, []);

  const toScreen = useCallback((lx: number, ly: number): Pt => {
    const cv = canvasRef.current!;
    const r = cv.getBoundingClientRect();
    const st = useStore.getState();
    return {
      x: r.left + (lx + st.width / 2) * (r.width / st.width),
      y: r.top + (ly + st.height / 2) * (r.height / st.height)
    };
  }, []);

  const hitHandle = useCallback(
    (box: Box, clientX: number, clientY: number): string | null => {
      for (const [name, hx, hy] of handlePoints(box)) {
        const s = toScreen(hx, hy);
        if (Math.abs(clientX - s.x) <= 7 && Math.abs(clientY - s.y) <= 7) return name;
      }
      return null;
    },
    [toScreen]
  );

  const hitBox = useCallback((p: Pt): Box | null => {
    const st = useStore.getState();
    const ordered = [...st.boxes].sort((a, b) => b.z - a.z);
    for (const b of ordered) {
      const n = norm(b);
      if (p.x >= n.x1 && p.x <= n.x2 && p.y >= n.y1 && p.y <= n.y2) return b;
    }
    return null;
  }, []);

  const updateCursor = useCallback(
    (clientX: number, clientY: number) => {
      const cv = canvasRef.current;
      if (!cv) return;
      const st = useStore.getState();
      if (!st.jsonMode) {
        cv.style.cursor = "default";
        setHoveredId(null);
        return;
      }
      const sel = st.boxes.find(b => b.id === st.selectedId);
      if (sel) {
        const h = hitHandle(sel, clientX, clientY);
        if (h) {
          cv.style.cursor =
            (h === "n" || h === "s") ? "ns-resize" :
            (h === "e" || h === "w") ? "ew-resize" :
            (h === "ne" || h === "sw") ? "nesw-resize" :
            "nwse-resize";
          setHoveredId(null);
          return;
        }
      }
      const hit = hitBox(toLogical(clientX, clientY));
      cv.style.cursor = hit ? "move" : "crosshair";
      setHoveredId(hit ? hit.id : null);
    },
    [hitBox, hitHandle, toLogical, setHoveredId]
  );

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const ro = new ResizeObserver(() => resizeCanvas());
    ro.observe(wrap);
    window.addEventListener("resize", resizeCanvas);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", resizeCanvas);
    };
  }, [resizeCanvas]);

  useEffect(() => {
    resizeCanvas();
  }, [resizeCanvas, width, height]);

  useEffect(() => {
    draw();
  }, [draw, boxes, selectedId, hoveredId, bgImage, genBusy, genPreviewFrame, jsonMode, showGrid, gridSize]);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      const st = useStore.getState();
      const p = toLogical(e.clientX, e.clientY);
      st.setCursor(Math.round(p.x), Math.round(p.y));
      const drag = dragRef.current;
      if (!drag) {
        if (e.target === canvasRef.current) updateCursor(e.clientX, e.clientY);
        return;
      }
      if (drag.mode === "draw") {
        drag.box.xmax = st.snapToGrid ? snapVal(p.x, st.gridSize) : p.x;
        drag.box.ymax = st.snapToGrid ? snapVal(p.y, st.gridSize) : p.y;
        applyAlignEdge(drag.box, "se");
        st.setAction(boxText(drag.box) + "  " + boxSize(drag.box));
        draw();
      } else if (drag.mode === "move") {
        const dx = p.x - drag.start.x;
        const dy = p.y - drag.start.y;
        const o = drag.orig, b = drag.box;
        const ndx = st.snapToGrid ? snapVal(o.xmin + dx, st.gridSize) - o.xmin : Math.round(dx);
        const ndy = st.snapToGrid ? snapVal(o.ymin + dy, st.gridSize) - o.ymin : Math.round(dy);
        b.xmin = o.xmin + ndx;
        b.xmax = o.xmax + ndx;
        b.ymin = o.ymin + ndy;
        b.ymax = o.ymax + ndy;
        applyAlign(b);
        st.setAction("move: " + boxText(b));
        draw();
      } else {
        const dx = p.x - drag.start.x;
        const dy = p.y - drag.start.y;
        const o = drag.orig, b = drag.box, h = drag.handle;
        const sx = h.includes("w") ? o.xmin : o.xmax;
        const sy = h.includes("n") ? o.ymin : o.ymax;
        const ndx = st.snapToGrid ? snapVal(sx + dx, st.gridSize) - sx : Math.round(dx);
        const ndy = st.snapToGrid ? snapVal(sy + dy, st.gridSize) - sy : Math.round(dy);
        if (h.includes("w")) b.xmin = o.xmin + ndx;
        if (h.includes("e")) b.xmax = o.xmax + ndx;
        if (h.includes("n")) b.ymin = o.ymin + ndy;
        if (h.includes("s")) b.ymax = o.ymax + ndy;
        applyAlignEdge(b, h);
        st.setAction("resize: " + boxText(b));
        draw();
      }
    };

    const onMouseUp = () => {
      const drag = dragRef.current;
      if (!drag) return;
      const st = useStore.getState();
        if (drag.mode === "draw") {
          const b = drag.box;
          commitBox(b);
          if (b.xmax - b.xmin < 2 || b.ymax - b.ymin < 2) {
            st.select(null);
          } else {
            b.label = "object";
            st.finishDraw(b);
          }
        } else {
          commitBox(drag.box);
          st.touchBoxes();
        }
        dragRef.current = null;
        guidesRef.current = null;
        st.setAction("");
        draw();
      };

    const onKeyDown = (e: KeyboardEvent) => {
      const tag = document.activeElement ? document.activeElement.tagName : "";
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      const st = useStore.getState();
      if (st.pendingBoxId !== null) return;
      if (e.key === "Delete" || e.key === "Backspace") {
        if (st.jsonMode && st.selectedId) {
          st.deleteBox(st.selectedId);
          e.preventDefault();
        }
      } else if (e.key === "Escape") {
        if (dragRef.current) {
          dragRef.current = null;
          guidesRef.current = null;
          st.setAction("");
          draw();
        } else if (st.selectedId) {
          st.select(null);
        }
      }
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [draw, toLogical, updateCursor, applyAlign, applyAlignEdge]);

  const onMouseDown = (e: ReactMouseEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const st = useStore.getState();
    if (!st.jsonMode) return;
    const p = toLogical(e.clientX, e.clientY);
    setHoveredId(null);
    const sel = st.boxes.find(b => b.id === st.selectedId);
    if (sel) {
      const h = hitHandle(sel, e.clientX, e.clientY);
      if (h) {
        dragRef.current = { mode: "resize", handle: h, start: p, orig: { ...sel }, box: sel };
        return;
      }
    }
    const hit = hitBox(p);
    if (hit) {
      st.select(hit.id);
      dragRef.current = { mode: "move", start: p, orig: { ...hit }, box: hit };
      return;
    }
    const box = st.beginDraw(p.x, p.y);
    dragRef.current = { mode: "draw", box };
  };

  const onDoubleClick = (e: ReactMouseEvent<HTMLCanvasElement>) => {
    const st = useStore.getState();
    if (!st.jsonMode) return;
    const p = toLogical(e.clientX, e.clientY);
    const hit = hitBox(p);
    if (hit) st.openBoxEditor(hit.id);
  };

  return (
    <div id="canvasWrap" ref={wrapRef}>
      <canvas
        id="cv"
        ref={canvasRef}
        onMouseDown={onMouseDown}
        onDoubleClick={onDoubleClick}
        onMouseLeave={() => setHoveredId(null)}
      />
      <button
        className="gear-btn canvas-gear"
        aria-label="Canvas settings"
        title="Canvas settings"
        onClick={onOpenSettings}
      >
        <GearIcon />
      </button>
    </div>
  );
}

function alignThreshold(cv: HTMLCanvasElement, stWidth: number): number {
  const r = cv.getBoundingClientRect();
  return r.width > 0 ? 4 * (stWidth / r.width) : 4;
}

function drawGrid(ctx: CanvasRenderingContext2D, W: number, H: number, step: number) {
  ctx.lineWidth = 1;
  const k0 = Math.ceil(-W / 2 / step), k1 = Math.floor(W / 2 / step);
  for (let k = k0; k <= k1; k++) {
    const x = k * step;
    ctx.strokeStyle = x === 0
      ? "rgba(255,255,255,0.40)"
      : (k % 2 === 0 ? "rgba(255,255,255,0.10)" : "rgba(255,255,255,0.045)");
    ctx.beginPath();
    ctx.moveTo(x + 0.5, -H / 2);
    ctx.lineTo(x + 0.5, H / 2);
    ctx.stroke();
  }
  const m0 = Math.ceil(-H / 2 / step), m1 = Math.floor(H / 2 / step);
  for (let k = m0; k <= m1; k++) {
    const y = k * step;
    ctx.strokeStyle = y === 0
      ? "rgba(255,255,255,0.40)"
      : (k % 2 === 0 ? "rgba(255,255,255,0.10)" : "rgba(255,255,255,0.045)");
    ctx.beginPath();
    ctx.moveTo(-W / 2, y + 0.5);
    ctx.lineTo(W / 2, y + 0.5);
    ctx.stroke();
  }
  ctx.strokeStyle = "rgba(255,255,255,0.30)";
  ctx.strokeRect(-W / 2, -H / 2, W, H);
}

function drawGuides(ctx: CanvasRenderingContext2D, W: number, H: number, guides: AlignGuide[] | null) {
  if (!guides || !guides.length) return;
  ctx.lineWidth = 1;
  ctx.strokeStyle = "#ff4d6d";
  for (const g of guides) {
    ctx.beginPath();
    if (g.axis === "x") {
      ctx.moveTo(g.at + 0.5, -H / 2);
      ctx.lineTo(g.at + 0.5, H / 2);
    } else {
      ctx.moveTo(-W / 2, g.at + 0.5);
      ctx.lineTo(W / 2, g.at + 0.5);
    }
    ctx.stroke();
  }
}

function drawBox(ctx: CanvasRenderingContext2D, b: Box, selected: boolean, preview: boolean, H: number, hovered: boolean) {
  const n = norm(b);
  const w = n.x2 - n.x1, h = n.y2 - n.y1;
  ctx.fillStyle = hexToRgba(b.color, selected ? 0.15 : hovered ? 0.35 : 0.15);
  ctx.fillRect(n.x1, n.y1, w, h);
  ctx.lineWidth = selected ? 2.5 : hovered ? 2 : 1.5;
  ctx.strokeStyle = b.color;
  ctx.setLineDash(preview ? [8, 5] : []);
  ctx.strokeRect(n.x1, n.y1, w, h);
  ctx.setLineDash([]);
  if (hovered || preview) {
    const text = (b.label ? b.label + "   " : "") + Math.round(w) + "×" + Math.round(h);
    const fs = 13;
    ctx.font = "600 " + fs + "px system-ui, sans-serif";
    const tw = ctx.measureText(text).width;
    let ty = n.y1 - 6;
    if (n.y1 - fs - 8 < -H / 2) ty = n.y1 + fs + 6;
    ctx.fillStyle = "rgba(10,12,16,0.8)";
    ctx.fillRect(n.x1 - 4, ty - fs - 2, tw + 10, fs + 7);
    ctx.fillStyle = "#ffffff";
    ctx.fillText(text, n.x1 + 1, ty);
  }
}

function drawHandles(ctx: CanvasRenderingContext2D, cv: HTMLCanvasElement, b: Box) {
  const r = cv.getBoundingClientRect();
  const st = useStore.getState();
  const scale = r.width / st.width;
  const s = Math.max(6, 8 / scale);
  ctx.lineWidth = 1.5;
  for (const [, hx, hy] of handlePoints(b)) {
    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = "#333333";
    ctx.fillRect(hx - s / 2, hy - s / 2, s, s);
    ctx.strokeRect(hx - s / 2, hy - s / 2, s, s);
  }
}
