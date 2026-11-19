import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { useStore, activeScene } from "../store";
import { parseProject, toProjectText } from "../lib/scenes";
import TrashIcon from "./TrashIcon";

export default function ScenePicker() {
  const scene = useStore(activeScene);
  const scenes = useStore(s => s.scenes);
  const setActiveScene = useStore(s => s.setActiveScene);
  const addScene = useStore(s => s.addScene);
  const duplicateScene = useStore(s => s.duplicateScene);
  const renameScene = useStore(s => s.renameScene);
  const deleteScene = useStore(s => s.deleteScene);
  const importProject = useStore(s => s.importProject);
  const [open, setOpen] = useState(false);
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [draftName, setDraftName] = useState("");
  const [importError, setImportError] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Close on an outside click or Escape
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Cancel an in-progress rename whenever the menu closes
  useEffect(() => {
    if (!open) setRenamingId(null);
  }, [open]);

  const commitRename = () => {
    if (renamingId !== null) renameScene(renamingId, draftName);
    setRenamingId(null);
  };

  const downloadProject = () => {
    const text = toProjectText(useStore.getState().scenes);
    const blob = new Blob([text], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "scenes.json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    setOpen(false);
  };

  const onImportFile = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      setImportError("");
      let parsed;
      try {
        parsed = parseProject(JSON.parse(String(reader.result)));
      } catch (err) {
        setImportError((err as Error).message);
        setOpen(true);
        return;
      }
      if (!confirm("Replace the current scenes with the imported ones?")) return;
      importProject(parsed);
      setOpen(false);
    };
    reader.onerror = () => {
      setImportError("could not read the file");
      setOpen(true);
    };
    reader.readAsText(f);
  };

  return (
    <div className="scene-picker" ref={rootRef}>
      <button
        className={"scene-btn" + (open ? " open" : "")}
        aria-haspopup="menu"
        aria-expanded={open}
        title="Scenes"
        onClick={() => setOpen(o => !o)}
      >
        <span className="scene-btn-name">{scene.name}</span>
        <svg
          className="scene-caret"
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      <button
        className="gear-btn"
        aria-label="Export scenes"
        title="Export all scenes to a .json file"
        onClick={downloadProject}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
      </button>
      <button
        className="gear-btn"
        aria-label="Import scenes"
        title="Import scenes from a .json file"
        onClick={() => fileRef.current?.click()}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 8 12 3 17 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
      </button>
      <input
        type="file"
        id="sceneFile"
        accept="application/json,.json"
        hidden
        ref={fileRef}
        onChange={onImportFile}
      />
      {open && (
        <div className="scene-menu" role="menu">
          {scenes.map(sc => (
            <div
              key={sc.id}
              className={"scene-row" + (sc.id === scene.id ? " active" : "")}
              role="menuitem"
              onClick={() => {
                if (renamingId === sc.id) return;
                setActiveScene(sc.id);
                setOpen(false);
              }}
            >
              {renamingId === sc.id ? (
                <input
                  className="scene-rename"
                  autoFocus
                  value={draftName}
                  spellCheck={false}
                  onChange={e => setDraftName(e.target.value)}
                  onFocus={e => e.currentTarget.select()}
                  onBlur={commitRename}
                  onKeyDown={e => {
                    e.stopPropagation();
                    if (e.key === "Enter") commitRename();
                    else if (e.key === "Escape") setRenamingId(null);
                  }}
                  onClick={e => e.stopPropagation()}
                />
              ) : (
                <>
                  <span className="scene-row-name">{sc.name}</span>
                  <span className="scene-row-size">{sc.width}×{sc.height}</span>
                </>
              )}
              {renamingId !== sc.id && (
                <span className="scene-row-actions">
                  <button
                    className="scene-row-btn"
                    title="Rename scene"
                    aria-label="Rename scene"
                    onClick={e => {
                      e.stopPropagation();
                      setRenamingId(sc.id);
                      setDraftName(sc.name);
                    }}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                    </svg>
                  </button>
                  <button
                    className="scene-row-btn"
                    title="Duplicate scene"
                    aria-label="Duplicate scene"
                    onClick={e => {
                      e.stopPropagation();
                      duplicateScene(sc.id);
                      setOpen(false);
                    }}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                    </svg>
                  </button>
                  <button
                    className="scene-row-btn"
                    title={scenes.length === 1 ? "Cannot delete the only scene" : "Delete scene"}
                    aria-label="Delete scene"
                    disabled={scenes.length === 1}
                    onClick={e => {
                      e.stopPropagation();
                      if (confirm('Delete scene "' + sc.name + '"?')) {
                        deleteScene(sc.id);
                        setOpen(false);
                      }
                    }}
                  >
                    <TrashIcon />
                  </button>
                </span>
              )}
            </div>
          ))}
          <div className="scene-menu-sep" />
          <div
            className="scene-row"
            role="menuitem"
            onClick={() => {
              addScene();
              setOpen(false);
            }}
          >
            <span className="scene-row-name">+ New scene</span>
          </div>
          {importError && <div className="scene-menu-error">{importError}</div>}
        </div>
      )}
    </div>
  );
}
