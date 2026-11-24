import { useEffect, useRef, useState, type DragEvent } from "react";
import { LEFT_MINI, useStore, activeScene } from "../store";
import EyeIcon from "./EyeIcon";
import LockIcon from "./LockIcon";
import TrashIcon from "./TrashIcon";
import type { Box } from "../types";

type DropTarget = { id: number; pos: "above" | "below" } | "end" | null;

const FLOAT_BAR_W = 110;
const FLOAT_BAR_H = 26;
const FLOAT_HIDE_DELAY = 140;

export default function BoxList() {
  const boxes = useStore(activeScene).boxes;
  const selectedId = useStore(s => s.selectedId);
  const hoveredId = useStore(s => s.hoveredId);
  const leftWidth = useStore(s => s.leftWidth);
  const pendingBoxId = useStore(s => s.pendingBoxId);
  const select = useStore(s => s.select);
  const setHoveredId = useStore(s => s.setHoveredId);
  const deleteBox = useStore(s => s.deleteBox);
  const duplicateBox = useStore(s => s.duplicateBox);
  const updateBox = useStore(s => s.updateBox);
  const openBoxEditor = useStore(s => s.openBoxEditor);
  const clearAll = useStore(s => s.clearAll);
  const moveBox = useStore(s => s.moveBox);

  const mini = leftWidth < LEFT_MINI;

  const [dragId, setDragId] = useState<number | null>(null);
  const [drop, setDrop] = useState<DropTarget>(null);
  const [bar, setBar] = useState<{ id: number; top: number; left: number } | null>(null);
  const hideTimer = useRef<number | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const cancelHide = () => {
    if (hideTimer.current !== null) {
      window.clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
  };

  const hideBarNow = () => {
    cancelHide();
    setBar(null);
  };

  // The float bar's z-index would put it above the modal backdrop, so hide it
  // while the box modal is open (it is anchored to a row, not the modal)
  useEffect(() => {
    if (pendingBoxId !== null) hideBarNow();
  }, [pendingBoxId]);

  const scheduleHide = () => {
    if (hideTimer.current !== null) return;
    hideTimer.current = window.setTimeout(() => {
      hideTimer.current = null;
      setBar(null);
    }, FLOAT_HIDE_DELAY);
  };

  const showActions = (id: number, el: HTMLElement) => {
    if (!mini) return;
    cancelHide();
    const r = el.getBoundingClientRect();
    const aside = el.closest("aside.left");
    const a = aside ? aside.getBoundingClientRect() : null;
    const left = a
      ? Math.max(8, Math.min(a.right + 4, window.innerWidth - FLOAT_BAR_W - 6))
      : r.right + 4;
    const top = Math.max(
      6,
      Math.min(r.top + r.height / 2 - FLOAT_BAR_H / 2, window.innerHeight - FLOAT_BAR_H - 6)
    );
    setBar({ id, top, left });
  };

  const mouse = useRef({ x: 0, y: 0 });

  // After the list scrolls, the row under the (stationary) pointer changes and no
  // mouseenter fires, so re-anchor the bar to the row under the pointer or hide it.
  // Runs on the next frame, since the scroll event can fire before the new layout
  const resyncBar = () => {
    cancelHide();
    requestAnimationFrame(() => {
      const t = document.elementFromPoint(mouse.current.x, mouse.current.y);
      const row = t ? (t.closest(".box-item") as HTMLElement | null) : null;
      if (row && row.dataset.boxId !== undefined) showActions(Number(row.dataset.boxId), row);
      else setBar(null);
    });
  };

  // latest value for the stable listeners below
  const resyncRef = useRef(resyncBar);
  resyncRef.current = resyncBar;

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      mouse.current = { x: e.clientX, y: e.clientY };
    };
    const onResize = () => {
      if (hideTimer.current !== null) window.clearTimeout(hideTimer.current);
      hideTimer.current = null;
      setBar(null);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("resize", onResize);
    // on short viewports the aside itself scrolls (scroll events do not bubble),
    // so listen for it separately
    const aside = rootRef.current?.closest("aside.left");
    const onAsideScroll = () => resyncRef.current();
    aside?.addEventListener("scroll", onAsideScroll, { passive: true });
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("resize", onResize);
      aside?.removeEventListener("scroll", onAsideScroll);
      if (hideTimer.current !== null) window.clearTimeout(hideTimer.current);
    };
  }, []);

  const resetDrag = () => {
    setDragId(null);
    setDrop(null);
    hideBarNow();
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

  const barBox = bar ? boxes.find(b => b.id === bar.id) : undefined;

  return (
    <div className="section grow" ref={rootRef}>
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
        onScroll={resyncBar}
      >
        {boxes.length === 0 ? (
          <div id="boxListEmpty">
            Empty for now — drag over the canvas to draw a box
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
              onDuplicate={() => duplicateBox(b.id)}
              onToggleHidden={() => updateBox(b.id, { hidden: !b.hidden })}
              onToggleLocked={() => updateBox(b.id, { locked: !b.locked })}
              onDragStart={e => {
                e.dataTransfer.effectAllowed = "move";
                e.dataTransfer.setData("text/plain", String(b.id));
                hideBarNow();
                setDragId(b.id);
              }}
              onDragEnd={resetDrag}
              onHover={h => setHoveredId(h ? b.id : null)}
              onShowActions={(bx, el) => showActions(bx.id, el)}
              onHideActions={scheduleHide}
              onMoveUp={() => moveBox(b.id, i - 1)}
              onMoveDown={() => moveBox(b.id, i + 2)}
              canMoveUp={i > 0}
              canMoveDown={i < boxes.length - 1}
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
      {mini && bar && barBox ? (
        <div
          className="box-actions float"
          style={{ top: bar.top, left: bar.left }}
          onMouseEnter={cancelHide}
          onMouseLeave={scheduleHide}
        >
          <BoxActions
            box={barBox}
            onToggleHidden={() => updateBox(barBox.id, { hidden: !barBox.hidden })}
            onToggleLocked={() => updateBox(barBox.id, { locked: !barBox.locked })}
            onDuplicate={() => duplicateBox(barBox.id)}
            onDelete={() => {
              deleteBox(barBox.id);
              hideBarNow();
            }}
          />
        </div>
      ) : null}
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
  onDuplicate,
  onToggleHidden,
  onToggleLocked,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
  onHover,
  onShowActions,
  onHideActions,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown
}: {
  box: Box;
  selected: boolean;
  hovered: boolean;
  dragging: boolean;
  dropPos: "above" | "below" | null;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onToggleHidden: () => void;
  onToggleLocked: () => void;
  onDragStart: (e: DragEvent<HTMLDivElement>) => void;
  onDragEnd: () => void;
  onDragOver: (e: DragEvent<HTMLDivElement>) => void;
  onDrop: (e: DragEvent<HTMLDivElement>) => void;
  onHover: (hovering: boolean) => void;
  onShowActions: (box: Box, el: HTMLElement) => void;
  onHideActions: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
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
      data-box-id={box.id}
      draggable
      onClick={onSelect}
      onDoubleClick={onEdit}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onMouseEnter={e => {
        onHover(true);
        onShowActions(box, e.currentTarget);
      }}
      onMouseLeave={() => {
        onHover(false);
        onHideActions();
      }}
    >
      <div className="grip" title="Drag to change the order" aria-hidden="true">
        ⋮⋮
      </div>
      <div className="swatch" style={{ background: box.color }}>
        {box.locked && (
          <span className="lock-badge" title="Box is locked" aria-label="Box is locked">
            <LockIcon locked />
          </span>
        )}
      </div>
      <div className="meta">
        <span className={"label" + (box.label ? "" : " empty")}>{box.label || "label"}</span>
      </div>
      <div className="box-actions">
        <BoxActions
          box={box}
          onToggleHidden={onToggleHidden}
          onToggleLocked={onToggleLocked}
          onDuplicate={onDuplicate}
          onDelete={onDelete}
        />
      </div>
      <div className="box-actions-row">
        <BoxActions
          box={box}
          onToggleHidden={onToggleHidden}
          onToggleLocked={onToggleLocked}
          onDuplicate={onDuplicate}
          onDelete={onDelete}
          onEdit={onEdit}
          onMoveUp={onMoveUp}
          onMoveDown={onMoveDown}
          canMoveUp={canMoveUp}
          canMoveDown={canMoveDown}
        />
      </div>
    </div>
  );
}

function BoxActions({
  box,
  onToggleHidden,
  onToggleLocked,
  onDuplicate,
  onDelete,
  onEdit,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown
}: {
  box: Box;
  onToggleHidden: () => void;
  onToggleLocked: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onEdit?: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
}) {
  return (
    <>
      {onEdit && (
        <button
          className="edit"
          title="Edit box"
          aria-label="Edit box"
          onClick={e => {
            e.stopPropagation();
            onEdit();
          }}
          onDoubleClick={e => e.stopPropagation()}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
          </svg>
        </button>
      )}
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
        className="dup"
        title="Duplicate box (Ctrl+D)"
        aria-label="Duplicate box"
        onClick={e => {
          e.stopPropagation();
          onDuplicate();
        }}
        onDoubleClick={e => e.stopPropagation()}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
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
      {onMoveUp && onMoveDown && (
        <span className="move-bar">
          <button
            className="up"
            title="Move box up"
            aria-label="Move box up"
            disabled={!canMoveUp}
            onClick={e => {
              e.stopPropagation();
              onMoveUp();
            }}
            onDoubleClick={e => e.stopPropagation()}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <polyline points="18 15 12 9 6 15" />
            </svg>
          </button>
          <button
            className="down"
            title="Move box down"
            aria-label="Move box down"
            disabled={!canMoveDown}
            onClick={e => {
              e.stopPropagation();
              onMoveDown();
            }}
            onDoubleClick={e => e.stopPropagation()}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
        </span>
      )}
    </>
  );
}
