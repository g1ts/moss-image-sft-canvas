import { useMemo, useState } from "react";
import { useStore, activeScene, summaryFromState } from "../store";
import { parseLayout, toLayoutText } from "./geometry";

// The read-only JSON of the active scene plus the clipboard/download actions on top of
// it, shared by the right panel and its collapsed strip
export function useLayoutJson() {
  const scene = useStore(activeScene);
  const boxes = scene.boxes;
  const metaText = scene.metaText;
  const canvasType = scene.canvasType;
  const sceneCaption = scene.sceneCaption;
  const importLayout = useStore(s => s.importLayout);
  const showToast = useStore(s => s.showToast);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  const canonical = useMemo(
    () => toLayoutText(summaryFromState({ metaText, canvasType, sceneCaption }), boxes),
    [metaText, canvasType, sceneCaption, boxes]
  );

  const fail = (msg: string) => {
    setError(msg);
    showToast(msg, true);
  };

  // readText can stay pending forever (a never-answered permission prompt), so a
  // read that does not settle in time is treated as an access failure
  const CLIPBOARD_READ_TIMEOUT = 3000;

  const readClipboard = async (): Promise<string | null> => {
    try {
      return await Promise.race([
        navigator.clipboard.readText(),
        new Promise<null>(res => {
          setTimeout(() => res(null), CLIPBOARD_READ_TIMEOUT);
        })
      ]);
    } catch {
      return null;
    }
  };

  const pasteJson = async () => {
    setError("");
    const text = await readClipboard();
    if (text === null) {
      fail("Could not access the clipboard");
      return;
    }
    if (!text.trim()) {
      fail("Clipboard is empty");
      return;
    }
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch (err) {
      fail("Parse error: " + (err as Error).message);
      return;
    }
    try {
      importLayout(parseLayout(data));
    } catch (err) {
      fail((err as Error).message);
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

  return { canonical, copied, error, copyJson, pasteJson, download };
}
