import { useStore } from "../store";
import { useLayoutJson } from "../lib/useLayoutJson";
import SummarySection from "./SummarySection";
import JsonPanel from "./JsonPanel";

export default function RightPanel() {
  const hidden = useStore(s => s.rightHidden);
  const setHidden = useStore(s => s.setRightHidden);
  const jsonMode = useStore(s => s.jsonMode);
  const layout = useLayoutJson();
  const { copied, copyJson, pasteJson, download } = layout;

  if (hidden) {
    return (
      <aside className="right right-collapsed">
        <button
          className="right-tab"
          title="show panel"
          aria-label="show panel"
          onClick={() => setHidden(false)}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        {jsonMode && (
          <>
            <button
              className="gear-btn"
              title="Paste JSON from clipboard"
              aria-label="Paste JSON from clipboard"
              onClick={pasteJson}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
                <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
                <path d="M9 12h6" />
                <path d="M12 9v6" />
              </svg>
            </button>
            <button
              className="gear-btn"
              title={copied ? "Copied" : "Copy JSON"}
              aria-label="Copy JSON"
              onClick={copyJson}
            >
              {copied ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
              )}
            </button>
            <button
              className="gear-btn"
              title="Download .json"
              aria-label="Download .json"
              onClick={download}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
            </button>
          </>
        )}
      </aside>
    );
  }

  return (
    <aside className="right">
      <button
        className="right-tab"
        title="hide panel"
        aria-label="hide panel"
        onClick={() => setHidden(true)}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </button>
      <SummarySection />
      <JsonPanel layout={layout} />
    </aside>
  );
}
