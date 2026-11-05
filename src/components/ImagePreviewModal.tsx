import { useEffect, useState } from "react";
import { useStore } from "../store";

export default function ImagePreviewModal({
  itemId,
  onNavigate,
  onClose
}: {
  itemId: number | null;
  onNavigate: (id: number) => void;
  onClose: () => void;
}) {
  const gallery = useStore(s => s.gallery);
  const item = itemId === null ? undefined : gallery.find(g => g.id === itemId);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setCopied(false);
  }, [itemId]);

  useEffect(() => {
    if (!copied) return;
    const t = window.setTimeout(() => setCopied(false), 1500);
    return () => window.clearTimeout(t);
  }, [copied]);

  const open = !!item;
  const count = gallery.length;
  const idx = item ? gallery.findIndex(g => g.id === item.id) : -1;
  const canNav = open && count > 1;

  const goPrev = () => {
    if (!canNav) return;
    onNavigate(gallery[(idx - 1 + count) % count].id);
  };
  const goNext = () => {
    if (!canNav) return;
    onNavigate(gallery[(idx + 1) % count].id);
  };

  useEffect(() => {
    if (!open || itemId === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT")) return;
      e.preventDefault();
      const g = useStore.getState().gallery;
      if (g.length < 2) return;
      const i = g.findIndex(x => x.id === itemId);
      if (i === -1) return;
      const next = e.key === "ArrowLeft" ? (i - 1 + g.length) % g.length : (i + 1) % g.length;
      onNavigate(g[next].id);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, itemId, onNavigate]);

  const copyPrompt = async () => {
    if (!item) return;
    try {
      await navigator.clipboard.writeText(item.prompt);
      setCopied(true);
    } catch {
      /* clipboard unavailable */
    }
  };

  const p = item ? item.params : null;

  return (
    <div
      className={"modal-backdrop" + (open ? "" : " hidden")}
      onMouseDown={e => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal img-view" role="dialog" aria-modal="true" aria-label="Image preview">
        <div className="modal-header">
          <h2>Image preview</h2>
          <button className="modal-close" aria-label="Close" onClick={onClose}>
            ×
          </button>
        </div>
        {item && p && (
          <div className="modal-body pv-body">
            <div className="pv-img-wrap">
              <img src={item.img.src} alt="" />
              {canNav && (
                <>
                  <button
                    type="button"
                    className="pv-nav pv-nav-prev"
                    title="Previous image (←)"
                    aria-label="Previous image"
                    onClick={goPrev}
                  >
                    ‹
                  </button>
                  <button
                    type="button"
                    className="pv-nav pv-nav-next"
                    title="Next image (→)"
                    aria-label="Next image"
                    onClick={goNext}
                  >
                    ›
                  </button>
                  <span className="pv-count">
                    {idx + 1} / {count}
                  </span>
                </>
              )}
            </div>
            <div className="pv-params" key={item.id}>
              <div className="pv-row">
                <span className="pv-k">size</span>
                <span className="pv-v">
                  {p.width}×{p.height}
                  {p.count > 1 ? " · " + p.count + " images" : ""}
                </span>
              </div>
              <div className="pv-row">
                <span className="pv-k">steps</span>
                <span className="pv-v">{p.steps}</span>
              </div>
              <div className="pv-row">
                <span className="pv-k">cfg</span>
                <span className="pv-v">{p.cfg}</span>
              </div>
              <div className="pv-row">
                <span className="pv-k">seed</span>
                <span className="pv-v">{p.seed < 0 ? "random" : p.seed}</span>
              </div>
              <div className="pv-row">
                <span className="pv-k">clip skip</span>
                <span className="pv-v">{p.clipSkip < 0 ? "auto" : p.clipSkip}</span>
              </div>
              <div className="pv-row">
                <span className="pv-k">scheduler</span>
                <span className="pv-v">{p.scheduler}</span>
              </div>
              <div className="pv-row">
                <span className="pv-k">sampler</span>
                <span className="pv-v">{p.method}</span>
              </div>
              <div className="pv-row pv-row-block">
                <span className="pv-k">loras</span>
                {p.loras.length ? (
                  <span className="pv-v pv-v-block">
                    {p.loras.map((l, i) => (
                      <span key={i}>
                        {l.path} × {l.mult}
                      </span>
                    ))}
                  </span>
                ) : (
                  <span className="pv-v">—</span>
                )}
              </div>
              <div className="pv-row pv-row-block">
                <span className="pv-k">negative prompt</span>
                <span className="pv-v pv-v-block">{p.negativePrompt || "—"}</span>
              </div>
              <div className="pv-row pv-row-block">
                <span className="pv-k">server</span>
                <span className="pv-v pv-v-block">{p.server}</span>
              </div>
              <div className="pv-row">
                <span className="pv-k">format</span>
                <span className="pv-v">{p.format}</span>
              </div>
              <div className="pv-row">
                <span className="pv-k">created</span>
                <span className="pv-v">{new Date(p.createdAt).toLocaleString()}</span>
              </div>
              <div className="pv-prompt">
                <div className="pv-prompt-head">
                  <span className="pv-k">prompt</span>
                  <button type="button" className="pv-copy" onClick={copyPrompt}>
                    {copied ? "copied" : "copy"}
                  </button>
                </div>
                <pre>{item.prompt}</pre>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
