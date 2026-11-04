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
import GearIcon from "./components/GearIcon";
import { useStore } from "./store";

export default function App() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [canvasSettingsOpen, setCanvasSettingsOpen] = useState(false);
  const pendingBoxId = useStore(s => s.pendingBoxId);
  const setPendingBoxId = useStore(s => s.setPendingBoxId);
  const genBusy = useStore(s => s.genBusy);
  const genStatus = useStore(s => s.genStatus);
  const jsonMode = useStore(s => s.jsonMode);
  const generate = useStore(s => s.generate);
  const cancelGeneration = useStore(s => s.cancelGeneration);

  useEffect(() => {
    if (!settingsOpen && !canvasSettingsOpen && pendingBoxId === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSettingsOpen(false);
        setCanvasSettingsOpen(false);
        setPendingBoxId(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [settingsOpen, canvasSettingsOpen, pendingBoxId, setPendingBoxId]);

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
          <Gallery />
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
    </>
  );
}
