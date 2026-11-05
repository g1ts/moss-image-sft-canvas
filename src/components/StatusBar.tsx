import { useStore } from "../store";

export default function StatusBar() {
  const cursor = useStore(s => s.cursor);
  const action = useStore(s => s.action);
  const width = useStore(s => s.width);
  const height = useStore(s => s.height);

  return (
    <div id="statusBar">
      <span id="stCoords">
        {cursor ? "x: " + cursor.x + ", y: " + cursor.y : "x: —, y: —"}
      </span>
      <span id="stAction">{action}</span>
      <span id="stSize">
        canvas {width}×{height}
      </span>
      <a id="stGithub" href="https://github.com/g1ts/moss-image-sft-canvas" target="_blank" rel="noreferrer">
        GitHub
      </a>
    </div>
  );
}
