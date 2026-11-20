import { useRef, type PointerEvent as ReactPointerEvent } from "react";
import { LEFT_MAX, LEFT_MIN, LEFT_MINI, useStore } from "../store";
import BoxList from "./BoxList";

export default function LeftPanel() {
  const leftWidth = useStore(s => s.leftWidth);
  const setLeftWidth = useStore(s => s.setLeftWidth);
  const drag = useRef<{ startX: number; startWidth: number } | null>(null);
  const mini = leftWidth < LEFT_MINI;

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { startX: e.clientX, startWidth: leftWidth };
    document.body.classList.add("left-resizing");
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (d === null) return;
    setLeftWidth(d.startWidth + (e.clientX - d.startX));
  };

  const endDrag = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (drag.current === null) return;
    drag.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    document.body.classList.remove("left-resizing");
  };

  return (
    <aside
      className={"left" + (mini ? " left-mini" : "")}
      style={{ width: leftWidth }}
    >
      <BoxList />
      <div
        className="left-resizer"
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize the boxes panel"
        aria-valuemin={LEFT_MIN}
        aria-valuemax={LEFT_MAX}
        aria-valuenow={leftWidth}
        title="Drag to resize"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onLostPointerCapture={endDrag}
      />
    </aside>
  );
}
