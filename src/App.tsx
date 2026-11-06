import { useEffect, useState } from "react";
import SummarySection from "./components/SummarySection";
import BoxList from "./components/BoxList";

import CanvasStage from "./components/CanvasStage";
import Gallery from "./components/Gallery";
import JsonPanel from "./components/JsonPanel";
import StatusBar from "./components/StatusBar";
import SettingsModal from "./components/SettingsModal";
import CanvasSettingsModal from "./components/CanvasSettingsModal";
import BoxModal from "./components/BoxModal";
import ImagePreviewModal from "./components/ImagePreviewModal";
import GearIcon from "./components/GearIcon";
import { useStore } from "./store";

// text fields that are part of the document snapshot — Ctrl+Z there runs the store undo
const DOC_FIELD_IDS = new Set([
  "jsonMeta",
  "jsonCanvas",
  "sumCaption",
  "sumNegPrompt",
  "bmLabel",
  "bmCaption",
  "bmText",
  "bmXmin",
  "bmXmax",
  "bmYmin",
  "bmYmax"
]);

export default function App() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [canvasSettingsOpen, setCanvasSettingsOpen] = useState(false);
  const [previewItemId, setPreviewItemId] = useState<number | null>(null);
  const pendingBoxId = useStore(s => s.pendingBoxId);
  const setPendingBoxId = useStore(s => s.setPendingBoxId);
  const genBusy = useStore(s => s.genBusy);
  const genStatus = useStore(s => s.genStatus);
  const jsonMode = useStore(s => s.jsonMode);
  const generate = useStore(s => s.generate);
  const cancelGeneration = useStore(s => s.cancelGeneration);
  const canUndo = useStore(s => s.canUndo);
  const canRedo = useStore(s => s.canRedo);
  const undo = useStore(s => s.undo);
  const redo = useStore(s => s.redo);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      // e.code is layout-independent, so the shortcut works on the Russian layout too
      const code = e.code;
      if (code !== "KeyZ" && code !== "KeyY") return;
      const el = document.activeElement;
      if (el) {
        const tag = el.tagName;
        const editable =
          tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || (el instanceof HTMLElement && el.isContentEditable);
        // non-document fields (URL, generation params, sizes) keep the browser's native undo
        if (editable && !(el instanceof HTMLElement && DOC_FIELD_IDS.has(el.id))) return;
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

  return (
    <>
      <header>
        <h1>MOSS-Image-SFT Canvas</h1>
        <span className="hint">
          Visual bounding-box layout editor: draw boxes, export JSON, generate images
        </span>
        <div className="header-actions">
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
      </header>
      <main>
        {jsonMode && (
          <aside className="left">
            <BoxList />
          </aside>
        )}
        <div id="centerCol">
          <CanvasStage onOpenSettings={() => setCanvasSettingsOpen(true)} />
          <Gallery onPreview={setPreviewItemId} />
        </div>
        <aside className="right">
          <SummarySection />
          <JsonPanel />
        </aside>
      </main>
      <StatusBar />
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
