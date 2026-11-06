import { useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "../store";
import { PALETTE, boxSize, boxText } from "../lib/geometry";
import { DEFAULT_LABELS, buildLabelOptions } from "../lib/valueHistory";
import LabelInput from "./LabelInput";

type CoordKey = "xmin" | "xmax" | "ymin" | "ymax";

const COORD_KEYS: CoordKey[] = ["xmin", "xmax", "ymin", "ymax"];

const COORD_LABELS: Record<CoordKey, string> = {
  xmin: "x min",
  xmax: "x max",
  ymin: "y min",
  ymax: "y max"
};

type Drafts = Record<CoordKey, string | null>;

const EMPTY_DRAFTS: Drafts = { xmin: null, xmax: null, ymin: null, ymax: null };

export default function BoxModal({
  boxId,
  onClose
}: {
  boxId: number | null;
  onClose: () => void;
}) {
  const box = useStore(s => (boxId === null ? undefined : s.boxes.find(b => b.id === boxId)));
  const boxes = useStore(s => s.boxes);
  const labelHistory = useStore(s => s.labelHistory);
  const isNew = useStore(s => s.pendingIsNew);
  const updateBox = useStore(s => s.updateBox);
  const deleteBox = useStore(s => s.deleteBox);
  const removeLabelHistory = useStore(s => s.removeLabelHistory);
  const rememberLabel = useStore(s => s.rememberLabel);
  const [drafts, setDrafts] = useState<Drafts>(EMPTY_DRAFTS);
  const labelRef = useRef<HTMLInputElement>(null);

  const labelOptions = useMemo(
    () => buildLabelOptions(labelHistory, boxes, boxId),
    [labelHistory, boxes, boxId]
  );

  const open = box !== undefined;

  useEffect(() => {
    setDrafts(EMPTY_DRAFTS);
    if (boxId !== null && isNew) {
      labelRef.current?.focus();
      labelRef.current?.select();
    }
  }, [boxId, isNew]);

  const commitCoords = () => {
    if (!box) return;
    const patch: Partial<Record<CoordKey, number>> = {};
    for (const k of COORD_KEYS) {
      const d = drafts[k];
      if (d !== null) {
        const n = parseInt(d, 10);
        if (!Number.isNaN(n)) patch[k] = n;
      }
    }
    if (Object.keys(patch).length) updateBox(box.id, patch);
    setDrafts(EMPTY_DRAFTS);
  };

  const cancel = () => {
    if (box) deleteBox(box.id);
    onClose();
  };

  return (
    <div
      className={"modal-backdrop" + (open ? "" : " hidden")}
      onMouseDown={e => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal" role="dialog" aria-modal="true" aria-label={isNew ? "New box" : "Box"}>
        <div className="modal-header">
          <h2>{isNew ? "New box" : "Box"}</h2>
          <button className="modal-close" aria-label="Close" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="modal-body">
          {box && (
            <>
              <div className="cs-section">
                <h2>Text</h2>
                <div className="bm-fields">
                  <div>
                    <label htmlFor="bmLabel">label</label>
                    <LabelInput
                      id="bmLabel"
                      inputRef={labelRef}
                      value={box.label}
                      options={labelOptions}
                      placeholder="label"
                      readOnlyValues={DEFAULT_LABELS}
                      onChange={v => updateBox(box.id, { label: v })}
                      onEnter={onClose}
                      onRemove={removeLabelHistory}
                      onCommit={rememberLabel}
                    />
                  </div>
                  <div>
                    <label htmlFor="bmCaption">caption</label>
                    <textarea
                      id="bmCaption"
                      rows={6}
                      value={box.caption}
                      placeholder="caption — description"
                      spellCheck={false}
                      onChange={e => updateBox(box.id, { caption: e.target.value })}
                    />
                  </div>
                  <div>
                    <label htmlFor="bmText">text</label>
                    <input
                      id="bmText"
                      type="text"
                      value={box.text}
                      placeholder="text — for label=text"
                      spellCheck={false}
                      onChange={e => updateBox(box.id, { text: e.target.value })}
                      onKeyDown={e => {
                        if (e.key === "Enter") onClose();
                      }}
                    />
                  </div>
                </div>
              </div>
              <div className="cs-section">
                <h2>Color</h2>
                <div className="swatch-row">
                  {PALETTE.map(c => (
                    <button
                      key={c}
                      type="button"
                      className={"swatch-btn" + (box.color === c ? " sel" : "")}
                      style={{ background: c }}
                      aria-label={"Color " + c}
                      onClick={() => updateBox(box.id, { color: c })}
                    />
                  ))}
                </div>
              </div>
              <div className="cs-section">
                <h2>Coordinates</h2>
                <div className="bm-coords">
                  {COORD_KEYS.map(k => (
                    <div key={k}>
                      <label htmlFor={"bm" + k}>{COORD_LABELS[k]} (px)</label>
                      <input
                        type="number"
                        id={"bm" + k}
                        spellCheck={false}
                        value={drafts[k] !== null ? drafts[k] : String(box[k])}
                        onChange={e =>
                          setDrafts(d => ({ ...d, [k]: e.target.value }))
                        }
                        onBlur={commitCoords}
                        onKeyDown={e => {
                          if (e.key === "Enter") commitCoords();
                        }}
                      />
                    </div>
                  ))}
                </div>
                <div className="cs-req">
                  {boxText(box)} · {boxSize(box)}
                </div>
                <div className="cs-hint">
                  Pixels from the canvas center: bbox = [y_min, x_min, y_max, x_max].
                </div>
              </div>
              <div className="bm-actions">
                {isNew ? (
                  <>
                    <button type="button" className="danger" onClick={cancel}>
                      Cancel
                    </button>
                    <button type="button" className="primary" onClick={onClose}>
                      Done
                    </button>
                  </>
                ) : (
                  <button type="button" className="primary" onClick={onClose}>
                    Close
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
