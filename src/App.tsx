import { useEffect, useState } from "react";
import LeftPanel from "./components/LeftPanel";

import CanvasStage from "./components/CanvasStage";
import Gallery from "./components/Gallery";
import RightPanel from "./components/RightPanel";
import Toast from "./components/Toast";
import ScenePicker from "./components/ScenePicker";
import StatusBar from "./components/StatusBar";
import SettingsModal from "./components/SettingsModal";
import CanvasSettingsModal from "./components/CanvasSettingsModal";
import BoxModal from "./components/BoxModal";
import ImagePreviewModal from "./components/ImagePreviewModal";
import GearIcon from "./components/GearIcon";
import { useStore, activeScene } from "./store";

export default function App() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [canvasSettingsOpen, setCanvasSettingsOpen] = useState(false);
  const [previewItemId, setPreviewItemId] = useState<number | null>(null);
  const [mobilePanel, setMobilePanel] = useState<"none" | "boxes" | "prompt">("none");
  const pendingBoxId = useStore(s => s.pendingBoxId);
  const setPendingBoxId = useStore(s => s.setPendingBoxId);
  const scene = useStore(activeScene);
  const genBusy = useStore(s => s.genBusy);
  const genStatus = useStore(s => s.genStatus);
  const jsonMode = useStore(s => s.jsonMode);
  const setJsonMode = useStore(s => s.setJsonMode);
  const generate = useStore(s => s.generate);
  const cancelGeneration = useStore(s => s.cancelGeneration);
  const canUndo = useStore(s => s.canUndo);
  const canRedo = useStore(s => s.canRedo);
  const undo = useStore(s => s.undo);
  const redo = useStore(s => s.redo);
  const snapToGrid = useStore(s => s.snapToGrid);
  const setSnapToGrid = useStore(s => s.setSnapToGrid);
  const alignEnabled = useStore(s => s.alignEnabled);
  const setAlignEnabled = useStore(s => s.setAlignEnabled);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      // e.code is layout-independent, so the shortcut works on the Russian layout too
      const code = e.code;
      if (code !== "KeyZ" && code !== "KeyY") return;
      // keep the browser's native undo/redo inside text fields
      const el = document.activeElement;
      if (el) {
        const tag = el.tagName;
        if (
          tag === "INPUT" ||
          tag === "TEXTAREA" ||
          tag === "SELECT" ||
          (el instanceof HTMLElement && el.isContentEditable)
        )
          return;
      }
      e.preventDefault();
      const st = useStore.getState();
      if (code === "KeyY" && !e.shiftKey) st.redo();
      else if (code === "KeyZ" && e.shiftKey) st.redo();
      else st.undo();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!settingsOpen && !canvasSettingsOpen && pendingBoxId === null && previewItemId === null)
      return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSettingsOpen(false);
        setCanvasSettingsOpen(false);
        setPendingBoxId(null);
        setPreviewItemId(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [settingsOpen, canvasSettingsOpen, pendingBoxId, previewItemId, setPendingBoxId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey && e.key === "Enter")) return;
      e.preventDefault();
      useStore.getState().generate();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // the boxes panel only exists in JSON mode
  useEffect(() => {
    if (!jsonMode && mobilePanel === "boxes") setMobilePanel("none");
  }, [jsonMode, mobilePanel]);

  // Escape closes a mobile drawer (but never under an open modal)
  useEffect(() => {
    if (mobilePanel === "none") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (settingsOpen || canvasSettingsOpen || previewItemId !== null) return;
      if (useStore.getState().pendingBoxId !== null) return;
      setMobilePanel("none");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobilePanel, settingsOpen, canvasSettingsOpen, previewItemId]);

  // Clear the box selection when the cursor moves to a text field or clicks outside
  // the canvas, so hotkeys never silently "go into the field" while a box is selected
  useEffect(() => {
    const clearSelection = () => {
      const st = useStore.getState();
      if (st.selectedId !== null) st.select(null);
    };
    // The box modal edits the selected box and its hotkeys are already disabled while it is open
    const isBoxModalTarget = (t: Element) =>
      useStore.getState().pendingBoxId !== null && t.closest(".modal") !== null;
    const onFocusIn = (e: FocusEvent) => {
      const t = e.target;
      if (!(t instanceof HTMLElement)) return;
      const tag = t.tagName;
      if (tag !== "INPUT" && tag !== "TEXTAREA" && tag !== "SELECT" && !t.isContentEditable) return;
      if (isBoxModalTarget(t)) return;
      clearSelection();
    };
    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      const t = e.target;
      if (!(t instanceof Element)) return;
      const wrap = document.getElementById("canvasWrap");
      if (wrap && wrap.contains(t)) return;
      if (t.closest(".box-item") !== null) return; // box list rows select on click themselves
      if (isBoxModalTarget(t)) return;
      clearSelection();
    };
    // capture phase: must run before React's close handlers reset pendingBoxId
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("mousedown", onMouseDown, true);
    return () => {
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("mousedown", onMouseDown, true);
    };
  }, []);

  return (
    <>
      <header>
        <h1 title="Visual bounding-box layout editor: draw boxes, export JSON, generate images">
          MOSS-Image-SFT Canvas
        </h1>
        <div className="header-actions">
          <ScenePicker />
          <div className="header-tools">
            <div className="history-nav">
              <button
                id="btnUndo"
                className="gear-btn"
                aria-label="Undo"
                title="Undo (Ctrl+Z)"
                disabled={!canUndo}
                onClick={() => undo()}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M9 14 4 9l5-5" />
                  <path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5 5.5 5.5 0 0 1-5.5 5.5H11" />
                </svg>
              </button>
              <button
                id="btnRedo"
                className="gear-btn"
                aria-label="Redo"
                title="Redo (Ctrl+Shift+Z)"
                disabled={!canRedo}
                onClick={() => redo()}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="m15 14 5-5-5-5" />
                  <path d="M20 9H9.5A5.5 5.5 0 0 0 4 14.5a5.5 5.5 0 0 0 5.5 5.5H13" />
                </svg>
              </button>
            </div>
            <div className="header-grid">
              <span className="switch-pair">
                <span className="switch-label">Snap</span>
                <span className="switch-icon" aria-hidden="true">
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <path d="M3 9h18" />
                    <path d="M3 15h18" />
                    <path d="M9 3v18" />
                    <path d="M15 3v18" />
                  </svg>
                </span>
                <label className="switch" title="Snap boxes to the grid while dragging">
                  <input
                    type="checkbox"
                    aria-label="Snap to grid"
                    checked={snapToGrid}
                    onChange={e => setSnapToGrid(e.target.checked)}
                  />
                  <span className="switch-track" aria-hidden="true" />
                </label>
              </span>
              <span className="switch-pair">
                <span className="switch-label">Align</span>
                <span className="switch-icon" aria-hidden="true">
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M8 4v16" />
                    <path d="M16 4v16" />
                    <path d="M3 12h18" />
                  </svg>
                </span>
                <label className="switch" title="Snap to box and canvas lines, with guide lines">
                  <input
                    type="checkbox"
                    aria-label="Alignment guides and magnet"
                    checked={alignEnabled}
                    onChange={e => setAlignEnabled(e.target.checked)}
                  />
                  <span className="switch-track" aria-hidden="true" />
                </label>
              </span>
              <span className="switch-pair">
                <span className="switch-label">JSON</span>
                <span className="switch-icon" aria-hidden="true">
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M8 3H7a2 2 0 0 0-2 2v5a2 2 0 0 1-2 2 2 2 0 0 1 2 2v5c0 1.1.9 2 2 2h1" />
                    <path d="M16 21h1a2 2 0 0 0 2-2v-5c0-1.1.9-2 2-2a2 2 0 0 1-2-2V5a2 2 0 0 0-2-2h-1" />
                  </svg>
                </span>
                <label className="switch" title="Toggle JSON mode">
                  <input
                    type="checkbox"
                    id="jsonModeToggle"
                    aria-label="JSON mode"
                    checked={jsonMode}
                    onChange={e => setJsonMode(e.target.checked)}
                  />
                  <span className="switch-track" aria-hidden="true" />
                </label>
              </span>
            </div>
          </div>
          <span
            id="genStatus"
            title={genStatus.msg}
            style={{ color: genStatus.isError ? "var(--danger)" : "var(--muted)" }}
          >
            {genStatus.msg}
          </span>
          {genBusy && (
            <button
              id="btnCancel"
              className="danger"
              title="Cancel generation"
              onClick={() => cancelGeneration()}
            >
              Cancel
            </button>
          )}
          <button
            id="btnGenerate"
            className="primary"
            disabled={genBusy}
            title="Generate (Ctrl+Enter)"
            onClick={() => generate()}
          >
            {genBusy ? "Generating..." : "Generate"}
          </button>
          <button
            className="gear-btn"
            aria-label="Settings"
            title="Settings"
            onClick={() => setSettingsOpen(true)}
          >
            <GearIcon />
          </button>
        </div>
        <div className="mobile-nav">
          {jsonMode && (
            <button
              className={mobilePanel === "boxes" ? "active" : ""}
              aria-label="Boxes panel"
              aria-expanded={mobilePanel === "boxes"}
              onClick={() => setMobilePanel(p => (p === "boxes" ? "none" : "boxes"))}
            >
              Boxes ({scene.boxes.length})
            </button>
          )}
          <button
            className={mobilePanel === "prompt" ? "active" : ""}
            aria-label="Prompt and JSON panel"
            aria-expanded={mobilePanel === "prompt"}
            onClick={() => setMobilePanel(p => (p === "prompt" ? "none" : "prompt"))}
          >
            Prompt / JSON
          </button>
        </div>
      </header>
      <main>
        {jsonMode && <LeftPanel open={mobilePanel === "boxes"} />}
        <div id="centerCol">
          <CanvasStage onOpenSettings={() => setCanvasSettingsOpen(true)} />
          <Gallery onPreview={setPreviewItemId} />
        </div>
        <RightPanel open={mobilePanel === "prompt"} />
      </main>
      {mobilePanel !== "none" && (
        <div
          className="mobile-backdrop"
          aria-hidden="true"
          onClick={() => setMobilePanel("none")}
        />
      )}
      <StatusBar />
      <Toast />
      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <CanvasSettingsModal open={canvasSettingsOpen} onClose={() => setCanvasSettingsOpen(false)} />
      <BoxModal boxId={pendingBoxId} onClose={() => setPendingBoxId(null)} />
      <ImagePreviewModal
        itemId={previewItemId}
        onNavigate={setPreviewItemId}
        onClose={() => setPreviewItemId(null)}
      />
    </>
  );
}
