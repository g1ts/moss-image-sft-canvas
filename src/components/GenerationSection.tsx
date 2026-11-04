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
  const genSched = useStore(s => s.genSched);
  const genMethod = useStore(s => s.genMethod);
  const genLoras = useStore(s => s.genLoras);
  const genFromCanvas = useStore(s => s.genFromCanvas);
  const genAutoBg = useStore(s => s.genAutoBg);
  const setGenAutoBg = useStore(s => s.setGenAutoBg);
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
    <div className="section">
      <h2>Generation (sdcpp)</h2>
      <div className="row">
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
      <div className="row">
        <label className="f" htmlFor="genW">W</label>
        <input
          type="number"
          id="genW"
          value={genFromCanvas ? cw : genW}
          min={64}
          max={4096}
          disabled={genFromCanvas}
          onChange={e => setGenParam({ genW: e.target.value })}
        />
        <label className="f" htmlFor="genH">H</label>
        <input
          type="number"
          id="genH"
          value={genFromCanvas ? ch : genH}
          min={64}
          max={4096}
          disabled={genFromCanvas}
          onChange={e => setGenParam({ genH: e.target.value })}
        />
        <label className="chk" title="Take size from the canvas">
          <input
            type="checkbox"
            id="genFromCanvas"
            checked={genFromCanvas}
            onChange={e => setGenParam({ genFromCanvas: e.target.checked })}
          />
          from canvas
        </label>
      </div>
      <div className="row">
        <label className="f" htmlFor="genCount">N</label>
        <input
          type="number"
          id="genCount"
          value={genCount}
          min={1}
          max={4}
          onChange={e => setGenParam({ genCount: e.target.value })}
        />
        <label className="f" htmlFor="genSteps">S</label>
        <input
          type="number"
          id="genSteps"
          value={genSteps}
          min={1}
          max={500}
          onChange={e => setGenParam({ genSteps: e.target.value })}
        />
        <label className="f" htmlFor="genCfg">C</label>
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
      <div className="row">
        <label
          className="chk"
          htmlFor="genAutoBg"
          title="After generation, automatically set the last image as the canvas background"
        >
          <input
            type="checkbox"
            id="genAutoBg"
            checked={genAutoBg}
            onChange={e => setGenAutoBg(e.target.checked)}
          />
          auto background after generation
        </label>
      </div>
      <div className="row">
        <label className="fl" htmlFor="genSeed">seed</label>
        <input
          type="number"
          id="genSeed"
          value={genSeed}
          title="-1 = random"
          onChange={e => setGenParam({ genSeed: e.target.value })}
        />
      </div>
      <details className="gen-adv">
        <summary>Advanced</summary>
        <div className="row">
          <label className="fl">clip_skip</label>
          <input
            type="number"
            id="genClip"
            value={genClip}
            min={1}
            max={12}
            onChange={e => setGenParam({ genClip: e.target.value })}
          />
        </div>
        <div className="row">
          <label className="fl" htmlFor="genSched">scheduler</label>
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
        <div className="row">
          <label className="fl" htmlFor="genMethod">method</label>
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
        {catalogLoading && <p className="cs-hint">loading lists from the server...</p>}
        {catalogError && !catalogLoading && (
          <p className="cs-hint" id="catalogError">
            lists: {catalogError}
          </p>
        )}
        <div className="lora-block">
          {genLoras.map((row, i) => (
            <div className="row lora-row" key={row.id}>
              <label className="fl">lora {i + 1}</label>
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
          <div className="row">
            <button type="button" className="lora-add" onClick={addLoraRow}>
              + lora
            </button>
          </div>
        </div>
      </details>
      <p className="cs-hint">
        Start generation with the "Generate" button in the top bar or Ctrl+Enter; while running, a "Cancel" button appears
      </p>
    </div>
  );
}
