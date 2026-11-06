import { useState, type CSSProperties } from "react";
import { useStore } from "../store";
import BackgroundSection from "./BackgroundSection";

type RatioPreset = { label: string; w: number; h: number };
type TierPreset = { label: string; area: number };

const MIN = 8;
const MAX = 8192;
const RATIO_TOL = 0.02;
const AREA_TOL = 0.05;

const RATIOS: RatioPreset[] = [
  { label: "1:1", w: 1, h: 1 },
  { label: "16:9", w: 16, h: 9 },
  { label: "9:16", w: 9, h: 16 },
  { label: "4:3", w: 4, h: 3 },
  { label: "3:4", w: 3, h: 4 },
  { label: "3:2", w: 3, h: 2 },
  { label: "2:3", w: 2, h: 3 }
];

const DEFAULT_SIZE = { w: 512, h: 512 };

const GRID_SIZES = [10, 25, 50, 100, 200];

const TIERS: TierPreset[] = [
  { label: "0.25 MP · 512", area: 512 * 512 },
  { label: "1 MP · ~1K", area: 1024 * 1024 },
  { label: "2.25 MP · ~1.5K", area: 1536 * 1536 },
  { label: "4 MP · ~2K", area: 2048 * 2048 }
];

function round8(n: number): number {
  return Math.min(MAX, Math.max(MIN, 8 * Math.round(n / 8)));
}

function dimsForRatio(rw: number, rh: number, area: number): { w: number; h: number } {
  const r = rw / rh;
  const h = Math.sqrt(area / r);
  return { w: round8(r * h), h: round8(h) };
}

function iconStyle(rw: number, rh: number): CSSProperties {
  const bw = 34;
  const bh = 24;
  const r = rw / rh;
  const w = r >= bw / bh ? bw : bh * r;
  return { width: Math.round(w * 10) / 10, height: Math.round((w / r) * 10) / 10 };
}

export default function CanvasSettingsModal({
  open,
  onClose
}: {
  open: boolean;
  onClose: () => void;
}) {
  const W = useStore(s => s.width);
  const H = useStore(s => s.height);
  const applySize = useStore(s => s.applySize);
  const showGrid = useStore(s => s.showGrid);
  const setShowGrid = useStore(s => s.setShowGrid);
  const gridSize = useStore(s => s.gridSize);
  const setGridSize = useStore(s => s.setGridSize);
  const snapToGrid = useStore(s => s.snapToGrid);
  const setSnapToGrid = useStore(s => s.setSnapToGrid);
  const alignEnabled = useStore(s => s.alignEnabled);
  const setAlignEnabled = useStore(s => s.setAlignEnabled);
  const [draftW, setDraftW] = useState<string | null>(null);
  const [draftH, setDraftH] = useState<string | null>(null);
  const [draftGrid, setDraftGrid] = useState<string | null>(null);
  const [ratioLocked, setRatioLocked] = useState(() => {
    const st = useStore.getState();
    return RATIOS.some(rt => Math.abs(st.width / st.height - rt.w / rt.h) / (rt.w / rt.h) < RATIO_TOL);
  });

  const ratioValue = W / H;
  const selRatio =
    RATIOS.find(rt => Math.abs(ratioValue - rt.w / rt.h) / (rt.w / rt.h) < RATIO_TOL) ?? null;
  const areaValue = W * H;
  const selTier = TIERS.find(t => Math.abs(areaValue - t.area) / t.area < AREA_TOL) ?? null;
  const ratioPair = selRatio ? { w: selRatio.w, h: selRatio.h } : { w: W, h: H };

  const clearDrafts = () => {
    setDraftW(null);
    setDraftH(null);
  };

  const commitGrid = () => {
    if (draftGrid === null) return;
    setGridSize(draftGrid);
    setDraftGrid(null);
  };

  const pickRatio = (rt: RatioPreset) => {
    const d = dimsForRatio(rt.w, rt.h, W * H);
    applySize(d.w, d.h);
    clearDrafts();
    setRatioLocked(true);
  };

  const pickTier = (t: TierPreset) => {
    const d = dimsForRatio(ratioPair.w, ratioPair.h, t.area);
    applySize(d.w, d.h);
    clearDrafts();
  };

  const pickDefault = () => {
    applySize(DEFAULT_SIZE.w, DEFAULT_SIZE.h);
    clearDrafts();
  };

  const swap = () => {
    applySize(H, W);
    clearDrafts();
  };

  const commit = () => {
    if (draftW === null && draftH === null) return;
    const pw = draftW !== null && !Number.isNaN(parseInt(draftW, 10)) ? round8(parseInt(draftW, 10)) : W;
    const ph = draftH !== null && !Number.isNaN(parseInt(draftH, 10)) ? round8(parseInt(draftH, 10)) : H;
    let nw = pw;
    let nh = ph;
    if (ratioLocked) {
      const r = ratioPair.w / ratioPair.h;
      if (draftH !== null && draftW === null) {
        nw = round8(ph * r);
      } else {
        nh = round8(pw / r);
      }
    }
    applySize(nw, nh);
    clearDrafts();
  };

  return (
    <div
      className={"modal-backdrop" + (open ? "" : " hidden")}
      onMouseDown={e => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal wide" role="dialog" aria-modal="true" aria-label="Canvas settings">
        <div className="modal-header">
          <h2>Canvas settings</h2>
          <button className="modal-close" aria-label="Close" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="modal-body">
          <div className="cs-section">
            <h2>Aspect ratio</h2>
            <div className="chip-row">
              {RATIOS.map(rt => (
                <button
                  key={rt.label}
                  type="button"
                  className={"chip chip-ratio" + (selRatio?.label === rt.label ? " sel" : "")}
                  onClick={() => pickRatio(rt)}
                >
                  <span className="chip-ico" style={iconStyle(rt.w, rt.h)} />
                  <span className="chip-label">{rt.label}</span>
                </button>
              ))}
            </div>
            <div className="cs-hint">
              When the ratio changes, approximately the same pixel area is preserved.
            </div>
          </div>
          <div className="cs-section">
            <h2>Resolution</h2>
            <div className="chip-row">
              <button type="button" className="chip chip-tier" onClick={pickDefault}>
                <span className="chip-title">Default</span>
                <span className="chip-sub">512 × 512</span>
              </button>
              {TIERS.map(t => {
                const d = dimsForRatio(ratioPair.w, ratioPair.h, t.area);
                return (
                  <button
                    key={t.label}
                    type="button"
                    className={"chip chip-tier" + (selTier?.label === t.label ? " sel" : "")}
                    onClick={() => pickTier(t)}
                  >
                    <span className="chip-title">{t.label}</span>
                    <span className="chip-sub">{d.w} × {d.h}</span>
                  </button>
                );
              })}
            </div>
            <div className="cs-hint">
              Resolution tiers set the pixel budget; dimensions follow the ratio.
            </div>
          </div>
          <div className="cs-section">
            <div className="cs-head">
              <h2>Exact size</h2>
              <button type="button" className="btn-toggle" onClick={() => setRatioLocked(v => !v)}>
                {ratioLocked ? "Ratio locked" : "Ratio unlocked"}
              </button>
            </div>
            <div className="cs-dims">
              <div>
                <label htmlFor="csW">Width (px)</label>
                <input
                  type="number"
                  id="csW"
                  min={MIN}
                  max={MAX}
                  step={8}
                  spellCheck={false}
                  value={draftW !== null ? draftW : String(W)}
                  onChange={e => setDraftW(e.target.value)}
                  onBlur={commit}
                  onKeyDown={e => {
                    if (e.key === "Enter") commit();
                  }}
                />
              </div>
              <div>
                <label htmlFor="csH">Height (px)</label>
                <input
                  type="number"
                  id="csH"
                  min={MIN}
                  max={MAX}
                  step={8}
                  spellCheck={false}
                  value={draftH !== null ? draftH : String(H)}
                  onChange={e => setDraftH(e.target.value)}
                  onBlur={commit}
                  onKeyDown={e => {
                    if (e.key === "Enter") commit();
                  }}
                />
              </div>
            </div>
            <div className="row" style={{ marginTop: 10 }}>
              <button type="button" id="btnCsSwap" onClick={swap}>
                Swap
              </button>
            </div>
            <div className="cs-req" id="csRequested">
              Requested: {W} × {H} · {selRatio ? selRatio.label : "free"} ·{" "}
              {(W * H / 1e6).toFixed(2)} MP
            </div>
            <div className="cs-hint">
              Width and height are multiples of 8 px. Larger sizes require more memory.
            </div>
          </div>
          <div className="cs-section">
            <h2>Grid</h2>
            <div className="row">
              <span className="switch-label">Show</span>
              <label className="switch" title="Show/hide grid">
                <input
                  type="checkbox"
                  id="gridToggle"
                  aria-label="Show grid"
                  checked={showGrid}
                  onChange={e => setShowGrid(e.target.checked)}
                />
                <span className="switch-track" aria-hidden="true" />
              </label>
              <span className="switch-label">Snap</span>
              <label className="switch" title="Snap boxes to the grid while dragging">
                <input
                  type="checkbox"
                  id="snapToggle"
                  aria-label="Snap to grid"
                  checked={snapToGrid}
                  onChange={e => setSnapToGrid(e.target.checked)}
                />
                <span className="switch-track" aria-hidden="true" />
              </label>
              <span className="switch-label">Align</span>
              <label className="switch" title="Snap to box and canvas lines, with guide lines">
                <input
                  type="checkbox"
                  id="alignToggle"
                  aria-label="Alignment guides and magnet"
                  checked={alignEnabled}
                  onChange={e => setAlignEnabled(e.target.checked)}
                />
                <span className="switch-track" aria-hidden="true" />
              </label>
            </div>
            <div className="row" style={{ marginTop: 10 }}>
              <span className="switch-label" style={{ flexShrink: 0 }}>Size</span>
              <div className="chip-row" style={{ flex: 1, minWidth: 0 }}>
                {GRID_SIZES.map(g => (
                  <button
                    key={g}
                    type="button"
                    className={"chip chip-grid" + (gridSize === g ? " sel" : "")}
                    onClick={() => {
                      setGridSize(g);
                      setDraftGrid(null);
                    }}
                  >
                    <span className="chip-label">{g}px</span>
                  </button>
                ))}
                <input
                  type="number"
                  id="csGridSize"
                  className="grid-size-input"
                  min={4}
                  max={2048}
                  step={1}
                  spellCheck={false}
                  aria-label="Grid size (px)"
                  value={draftGrid !== null ? draftGrid : String(gridSize)}
                  onChange={e => setDraftGrid(e.target.value)}
                  onBlur={commitGrid}
                  onKeyDown={e => {
                    if (e.key === "Enter") commitGrid();
                  }}
                />
              </div>
            </div>
          </div>
          <BackgroundSection />
        </div>
      </div>
    </div>
  );
}
