import { useMemo, useState } from "react";
import { useStore, summaryFromState } from "../store";
import { parseLayout, toLayoutText } from "../lib/geometry";
import { splitMeta } from "../lib/valueHistory";
import LabelInput from "./LabelInput";

export default function JsonPanel() {
  const boxes = useStore(s => s.boxes);
  const metaText = useStore(s => s.metaText);
  const canvasType = useStore(s => s.canvasType);
  const sceneCaption = useStore(s => s.sceneCaption);
  const jsonMode = useStore(s => s.jsonMode);
  const setJsonMode = useStore(s => s.setJsonMode);
  const importLayout = useStore(s => s.importLayout);
  const metaHistory = useStore(s => s.metaHistory);
  const setMetaText = useStore(s => s.setMetaText);
  const setCanvasType = useStore(s => s.setCanvasType);
  const removeMetaHistory = useStore(s => s.removeMetaHistory);
  const rememberMeta = useStore(s => s.rememberMeta);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const metaTokens = useMemo(() => splitMeta(metaText), [metaText]);

  const canonical = toLayoutText(
    summaryFromState({ metaText, canvasType, sceneCaption }),
    boxes
  );

  const importFromClipboard = async () => {
    setError("");
    let text: string;
    try {
      text = await navigator.clipboard.readText();
    } catch {
      setError("Could not access the clipboard");
      return;
    }
    if (!text.trim()) {
      setError("Clipboard is empty");
      return;
    }
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch (err) {
      setError("Parse error: " + (err as Error).message);
      return;
    }
    try {
      importLayout(parseLayout(data));
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const copyJson = async () => {
    const done = () => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    };
    try {
      await navigator.clipboard.writeText(canonical);
      done();
    } catch {
      const ta = document.createElement("textarea");
      ta.value = canonical;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
      done();
    }
  };

  const download = () => {
    const blob = new Blob([canonical], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "layout.json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  return (
    <>
      <div className="section json-section">
        <div className="json-head">
          <h2>Scene (JSON)</h2>
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
        </div>
      </div>
      {jsonMode && (
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          minHeight: 0,
          padding: "0 12px 12px"
        }}
      >
        <div className="row" style={{ flexShrink: 0 }}>
          <label className="fl" htmlFor="jsonMeta">meta</label>
          <LabelInput
            id="jsonMeta"
            value={metaText}
            options={metaHistory}
            placeholder="poster, ... (comma-separated)"
            ariaLabel="meta"
            getQuery={lastMetaToken}
            excludeValues={metaTokens}
            onSelect={selectMetaToken}
            onChange={setMetaText}
            onRemove={removeMetaHistory}
            onCommit={rememberMeta}
          />
        </div>
        <div className="row" style={{ flexShrink: 0 }}>
          <label className="fl" htmlFor="jsonCanvas">canvas</label>
          <input
            type="text"
            id="jsonCanvas"
            value={canvasType}
            placeholder="single"
            spellCheck={false}
            onChange={e => setCanvasType(e.target.value)}
          />
        </div>
        <div
          style={{
            position: "relative",
            flex: 1,
            display: "flex",
            flexDirection: "column",
            minHeight: 0,
            marginTop: 8
          }}
        >
          <textarea
            id="jsonArea"
            spellCheck={false}
            readOnly
            value={canonical}
          />
          <div className="json-actions">
            <button
              id="btnPasteJson"
              className="gear-btn"
              title="Paste JSON from clipboard"
              aria-label="Paste JSON from clipboard"
              onClick={importFromClipboard}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
                <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
                <path d="M9 12h6" />
                <path d="M12 9v6" />
              </svg>
            </button>
            <button
              id="btnCopyJson"
              className="gear-btn"
              title={copied ? "Copied" : "Copy JSON"}
              aria-label="Copy JSON"
              onClick={copyJson}
            >
              {copied ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
              )}
            </button>
            <button
              id="btnDownload"
              className="gear-btn"
              title="Download .json"
              aria-label="Download .json"
              onClick={download}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
            </button>
          </div>
        </div>
        <div id="jsonError">{error}</div>
      </div>
      )}
    </>
  );
}

// The query for filtering — the last (unfinished) token
function lastMetaToken(value: string): string {
  const i = value.lastIndexOf(",");
  return (i >= 0 ? value.slice(i + 1) : value).trim();
}

// Selecting an item replaces the last token of the value (the space after the comma is preserved)
function selectMetaToken(value: string, selected: string): string {
  const i = value.lastIndexOf(",");
  if (i < 0) return selected;
  const sep = value[i + 1] === " " ? ", " : ",";
  return value.slice(0, i) + sep + selected;
}
