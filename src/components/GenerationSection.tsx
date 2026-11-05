import { useEffect } from "react";
import { useStore } from "../store";
import TrashIcon from "./TrashIcon";

function optionsWithCurrent(options: string[], current: string): string[] {
  const list = [...options];
  if (current && !list.includes(current)) list.push(current);
  return list;
}

export default function GenerationSection({ open }: { open: boolean }) {
  const cw = useStore(s => s.width);
  const ch = useStore(s => s.height);
  const genUrl = useStore(s => s.genUrl);
  const genW = useStore(s => s.genW);
  const genH = useStore(s => s.genH);
  const genCount = useStore(s => s.genCount);
  const genSteps = useStore(s => s.genSteps);
  const genCfg = useStore(s => s.genCfg);
  const genSeed = useStore(s => s.genSeed);
  const genClip = useStore(s => s.genClip);
  const genClipManual = useStore(s => s.genClipManual);
  const genSched = useStore(s => s.genSched);
  const genMethod = useStore(s => s.genMethod);
  const genLoras = useStore(s => s.genLoras);
  const genFromCanvas = useStore(s => s.genFromCanvas);
  const genAutoBg = useStore(s => s.genAutoBg);
  const setGenAutoBg = useStore(s => s.setGenAutoBg);
  const genLivePreviewMode = useStore(s => s.genLivePreviewMode);
  const setGenLivePreview = useStore(s => s.setGenLivePreview);
  const previewModes = useStore(s => s.previewModes);
  const schedOptions = useStore(s => s.schedOptions);
  const samplerOptions = useStore(s => s.samplerOptions);
  const loraOptions = useStore(s => s.loraOptions);
  const catalogLoading = useStore(s => s.catalogLoading);
  const catalogError = useStore(s => s.catalogError);
  const setGenParam = useStore(s => s.setGenParam);
  const saveGenUrl = useStore(s => s.saveGenUrl);
  const loadCatalog = useStore(s => s.loadCatalog);
  const addLoraRow = useStore(s => s.addLoraRow);
  const removeLoraRow = useStore(s => s.removeLoraRow);
  const updateLoraRow = useStore(s => s.updateLoraRow);

  useEffect(() => {
    if (open) loadCatalog();
  }, [open, loadCatalog]);

  return (
    <>
      <div className="cs-section">
        <div className="gen-field">
          <label htmlFor="genUrl">Server</label>
          <input
            type="text"
            id="genUrl"
            value={genUrl}
            spellCheck={false}
            title="sdcpp server URL"
            onChange={e => setGenParam({ genUrl: e.target.value })}
            onBlur={() => {
              saveGenUrl();
              loadCatalog();
            }}
          />
        </div>
        <div className="gen-switch-grid">
          <div className="gen-switch-cell">
            <span className="switch-label">auto background after generation</span>
            <label
              className="switch"
              title="After generation, automatically set the last image as the canvas background"
            >
              <input
                type="checkbox"
                id="genAutoBg"
                checked={genAutoBg}
                onChange={e => setGenAutoBg(e.target.checked)}
              />
              <span className="switch-track" aria-hidden="true" />
            </label>
          </div>
          <div className="gen-switch-cell gen-live-cell">
            <span className="switch-label">live preview</span>
            <select
              id="genLivePreviewMode"
              value={genLivePreviewMode}
              title="How the server decodes preview frames (from /sdcpp/v1/capabilities); none disables live preview. Requires auto background"
              disabled={!genAutoBg || previewModes.length === 0}
              onChange={e => setGenLivePreview(e.target.value)}
            >
              {optionsWithCurrent(previewModes, genLivePreviewMode).map(v => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </div>
        </div>
        {previewModes.length === 0 && !catalogError && (
          <p className="cs-hint">live preview: not supported by the server</p>
        )}
      </div>
      <div className="cs-section">
        <h2>Size</h2>
        <div className="gen-grid">
          <div className="gen-field">
            <label htmlFor="genW">Width</label>
            <input
              type="number"
              id="genW"
              value={genFromCanvas ? cw : genW}
              min={64}
              max={4096}
              disabled={genFromCanvas}
              onChange={e => setGenParam({ genW: e.target.value })}
            />
          </div>
          <div className="gen-field">
            <label htmlFor="genH">Height</label>
            <input
              type="number"
              id="genH"
              value={genFromCanvas ? ch : genH}
              min={64}
              max={4096}
              disabled={genFromCanvas}
              onChange={e => setGenParam({ genH: e.target.value })}
            />
          </div>
          <div className="gen-switch-cell">
            <span className="switch-label">from canvas</span>
            <label className="switch" title="Take size from the canvas">
              <input
                type="checkbox"
                id="genFromCanvas"
                checked={genFromCanvas}
                onChange={e => setGenParam({ genFromCanvas: e.target.checked })}
              />
              <span className="switch-track" aria-hidden="true" />
            </label>
          </div>
        </div>
      </div>
      <div className="cs-section">
        <h2>Sampling</h2>
        <div className="gen-grid">
          <div className="gen-field">
            <label htmlFor="genCount">Images</label>
            <input
              type="number"
              id="genCount"
              value={genCount}
              min={1}
              max={4}
              onChange={e => setGenParam({ genCount: e.target.value })}
            />
          </div>
          <div className="gen-field">
            <label htmlFor="genSteps">Steps</label>
            <input
              type="number"
              id="genSteps"
              value={genSteps}
              min={1}
              max={500}
              onChange={e => setGenParam({ genSteps: e.target.value })}
            />
          </div>
          <div className="gen-field">
            <label htmlFor="genCfg">CFG</label>
            <input
              type="number"
              id="genCfg"
              value={genCfg}
              min={0.1}
              max={30}
              step={0.1}
              onChange={e => setGenParam({ genCfg: e.target.value })}
            />
          </div>
          <div className="gen-field">
            <label htmlFor="genSeed">Seed</label>
            <input
              type="number"
              id="genSeed"
              value={genSeed}
              title="-1 = random"
              onChange={e => setGenParam({ genSeed: e.target.value })}
            />
          </div>
        </div>
      </div>
      <div className="cs-section">
        <details className="gen-adv">
          <summary>Advanced</summary>
          <div className="gen-grid">
            <div className="gen-field">
              <label htmlFor="genClip">Clip skip</label>
              <div className="gen-clip-row">
                <input
                  type="number"
                  id="genClip"
                  value={genClipManual ? genClip : "-1"}
                  min={1}
                  max={12}
                  disabled={!genClipManual}
                  onChange={e => setGenParam({ genClip: e.target.value })}
                />
                <label className="switch" title="Manual clip skip (off = auto, sends -1 to the server)">
                  <input
                    type="checkbox"
                    id="genClipManual"
                    checked={genClipManual}
                    onChange={e => setGenParam({ genClipManual: e.target.checked })}
                  />
                  <span className="switch-track" aria-hidden="true" />
                </label>
              </div>
            </div>
            <div className="gen-field">
              <label htmlFor="genSched">Scheduler</label>
              <select
                id="genSched"
                value={genSched}
                title="List is loaded from the server: /sdapi/v1/schedulers"
                onChange={e => setGenParam({ genSched: e.target.value })}
              >
                {optionsWithCurrent(schedOptions, genSched).map(v => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <div className="gen-field">
              <label htmlFor="genMethod">Method</label>
              <select
                id="genMethod"
                value={genMethod}
                title="List is loaded from the server: /sdapi/v1/samplers"
                onChange={e => setGenParam({ genMethod: e.target.value })}
              >
                {optionsWithCurrent(samplerOptions, genMethod).map(v => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {catalogLoading && <p className="cs-hint">loading lists from the server...</p>}
          {catalogError && !catalogLoading && (
            <p className="cs-hint" id="catalogError">
              lists: {catalogError}
            </p>
          )}
        </details>
      </div>
      <div className="cs-section">
        <div className="lora-head">
          <h2>LoRAs</h2>
          <button type="button" className="lora-add" onClick={addLoraRow}>
            + Add
          </button>
        </div>
        {genLoras.length === 0 ? (
          <p className="lora-empty">No LoRAs</p>
        ) : (
          <div className="lora-block">
            {genLoras.map((row, i) => (
              <div className="row lora-row" key={row.id}>
                <span className="lora-idx">{i + 1}</span>
                <select
                  className="lora-sel"
                  value={row.path}
                  title="List is loaded from the server: /sdapi/v1/loras"
                  onChange={e => updateLoraRow(row.id, { path: e.target.value })}
                >
                  <option value="">—</option>
                  {loraOptions.map(o => (
                    <option key={o.path} value={o.path}>
                      {o.name}
                    </option>
                  ))}
                  {row.path &&
                    !loraOptions.some(o => o.path === row.path) && (
                      <option value={row.path}>{row.path}</option>
                    )}
                </select>
                <input
                  type="number"
                  className="lora-mult"
                  value={row.mult}
                  min={0}
                  max={2}
                  step={0.1}
                  title="strength (multiplier)"
                  onChange={e => updateLoraRow(row.id, { mult: e.target.value })}
                />
                <button
                  type="button"
                  className="lora-del"
                  aria-label="Remove lora"
                  title="Remove"
                  onClick={() => removeLoraRow(row.id)}
                >
                  <TrashIcon />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="cs-section">
        <p className="cs-hint gen-foot-hint">
          Start generation with the "Generate" button in the top bar or Ctrl+Enter; while running,
          a "Cancel" button appears
        </p>
      </div>
    </>
  );
}
