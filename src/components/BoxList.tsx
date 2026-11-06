import { useState, type DragEvent } from "react";
import { useStore } from "../store";
import EyeIcon from "./EyeIcon";
import LockIcon from "./LockIcon";
import TrashIcon from "./TrashIcon";
import type { Box } from "../types";

type DropTarget = { id: number; pos: "above" | "below" } | "end" | null;

export default function BoxList() {
  const boxes = useStore(s => s.boxes);
  const selectedId = useStore(s => s.selectedId);
  const hoveredId = useStore(s => s.hoveredId);
  const select = useStore(s => s.select);
  const setHoveredId = useStore(s => s.setHoveredId);
  const deleteBox = useStore(s => s.deleteBox);
  const updateBox = useStore(s => s.updateBox);
  const openBoxEditor = useStore(s => s.openBoxEditor);
  const clearAll = useStore(s => s.clearAll);
  const moveBox = useStore(s => s.moveBox);

  const [dragId, setDragId] = useState<number | null>(null);
  const [drop, setDrop] = useState<DropTarget>(null);

  const resetDrag = () => {
    setDragId(null);
    setDrop(null);
  };

  // The insertion position is computed from the drop event geometry rather than state,
  // so it does not depend on the timeliness of React state updates
  const dropOnItem = (e: DragEvent, box: Box, index: number) => {
    if (dragId === null || dragId === box.id) return;
    e.preventDefault();
    e.stopPropagation();
    const r = e.currentTarget.getBoundingClientRect();
    const pos: "above" | "below" = e.clientY < r.top + r.height / 2 ? "above" : "below";
    moveBox(dragId, index + (pos === "below" ? 1 : 0));
    resetDrag();
  };

  const dropOnList = (e: DragEvent) => {
    if (dragId === null) return;
    e.preventDefault();
    moveBox(dragId, boxes.length);
    resetDrag();
  };

  return (
    <div className="section grow">
      <div className="box-header">
        <h2>
          Boxes (<span id="boxCount">{boxes.length}</span>)
        </h2>
        <button
          className="clear-btn"
          title="Clear all"
          aria-label="Clear all"
          onClick={() => {
            if (boxes.length && !confirm("Delete all boxes?")) return;
            clearAll();
          }}
        >
          <TrashIcon />
        </button>
      </div>
      <div
        id="boxList"
        onDragOver={e => {
          if (dragId === null) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
          setDrop(prev => (prev === "end" ? prev : "end"));
        }}
        onDragLeave={e => {
          if (e.currentTarget.contains(e.relatedTarget as Node)) return;
          setDrop(prev => (prev === null ? prev : null));
        }}
        onDrop={dropOnList}
      >
        {boxes.length === 0 ? (
          <div id="boxListEmpty">
            Empty for now — drag with the mouse over the canvas to draw a box
          </div>
        ) : (
          boxes.map((b, i) => (
            <BoxItem
              key={b.id}
              box={b}
              selected={b.id === selectedId}
              hovered={b.id === hoveredId}
              dragging={dragId === b.id}
              dropPos={
                drop !== null && drop !== "end" && drop.id === b.id && dragId !== b.id
                  ? drop.pos
                  : null
              }
              onSelect={() => select(b.id)}
              onEdit={() => openBoxEditor(b.id)}
              onDelete={() => deleteBox(b.id)}
              onToggleHidden={() => updateBox(b.id, { hidden: !b.hidden })}
              onToggleLocked={() => updateBox(b.id, { locked: !b.locked })}
              onDragStart={e => {
                e.dataTransfer.effectAllowed = "move";
                e.dataTransfer.setData("text/plain", String(b.id));
                setDragId(b.id);
              }}
              onDragEnd={resetDrag}
              onHover={h => setHoveredId(h ? b.id : null)}
              onDragOver={e => {
                if (dragId === null || dragId === b.id) return;
                e.preventDefault();
                e.stopPropagation();
                e.dataTransfer.dropEffect = "move";
                const r = e.currentTarget.getBoundingClientRect();
                const pos: "above" | "below" = e.clientY < r.top + r.height / 2 ? "above" : "below";
                setDrop(prev =>
                  prev !== null && prev !== "end" && prev.id === b.id && prev.pos === pos
                    ? prev
                    : { id: b.id, pos }
                );
              }}
              onDrop={e => dropOnItem(e, b, i)}
            />
          ))
        )}
      </div>
    </div>
  );
}

function BoxItem({
  box,
  selected,
  hovered,
  dragging,
  dropPos,
  onSelect,
  onEdit,
  onDelete,
  onToggleHidden,
  onToggleLocked,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
  onHover
}: {
  box: Box;
  selected: boolean;
  hovered: boolean;
  dragging: boolean;
  dropPos: "above" | "below" | null;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onToggleHidden: () => void;
  onToggleLocked: () => void;
  onDragStart: (e: DragEvent<HTMLDivElement>) => void;
  onDragEnd: () => void;
  onDragOver: (e: DragEvent<HTMLDivElement>) => void;
  onDrop: (e: DragEvent<HTMLDivElement>) => void;
  onHover: (hovering: boolean) => void;
}) {
  const cls =
    "box-item" +
    (selected ? " selected" : "") +
    (hovered ? " hovered" : "") +
    (box.hidden ? " is-hidden" : "") +
    (dragging ? " dragging" : "") +
    (dropPos === "above" ? " drop-above" : dropPos === "below" ? " drop-below" : "");
  return (
    <div
      className={cls}
      draggable
      onClick={onSelect}
      onDoubleClick={onEdit}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
    >
      <div className="grip" title="Drag to change the order" aria-hidden="true">
        ⋮⋮
      </div>
      <div className="swatch" style={{ background: box.color }} />
      <div className="meta">
        <span className={"label" + (box.label ? "" : " empty")}>{box.label || "label"}</span>
      </div>
      <button
        className={"eye" + (box.hidden ? " active" : "")}
        title={box.hidden ? "Show box" : "Hide box"}
        aria-label={box.hidden ? "Show box" : "Hide box"}
        onClick={e => {
          e.stopPropagation();
          onToggleHidden();
        }}
        onDoubleClick={e => e.stopPropagation()}
      >
        <EyeIcon hidden={box.hidden} />
      </button>
      <button
        className={"lock" + (box.locked ? " active" : "")}
        title={box.locked ? "Unlock box" : "Lock box"}
        aria-label={box.locked ? "Unlock box" : "Lock box"}
        onClick={e => {
          e.stopPropagation();
          onToggleLocked();
        }}
        onDoubleClick={e => e.stopPropagation()}
      >
        <LockIcon locked={box.locked} />
      </button>
      <button
        className="del"
        title="Delete box"
        onClick={e => {
          e.stopPropagation();
          onDelete();
        }}
        onDoubleClick={e => e.stopPropagation()}
      >
        ✕
      </button>
    </div>
  );
}
