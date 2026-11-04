import { useStore } from "../store";

export default function SummarySection() {
  const sceneCaption = useStore(s => s.sceneCaption);
  const negPrompt = useStore(s => s.negPrompt);
  const jsonMode = useStore(s => s.jsonMode);
  const setSceneCaption = useStore(s => s.setSceneCaption);
  const setNegPrompt = useStore(s => s.setNegPrompt);

  return (
    <div className="section">
      <h2>Prompt</h2>
      <div className="row">
        <textarea
          id="sumCaption"
          rows={2}
          placeholder={jsonMode ? "caption — description of the scene and style" : "prompt"}
          spellCheck={false}
          value={sceneCaption}
          onChange={e => setSceneCaption(e.target.value)}
        />
      </div>
      <div className="row">
        <textarea
          id="sumNegPrompt"
          rows={2}
          placeholder="negative prompt (optional)"
          spellCheck={false}
          value={negPrompt}
          onChange={e => setNegPrompt(e.target.value)}
        />
      </div>
    </div>
  );
}
