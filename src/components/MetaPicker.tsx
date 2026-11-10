import { useEffect, useMemo, useRef, useState } from "react";
import type { FocusEvent as ReactFocusEvent, KeyboardEvent as ReactKeyboardEvent } from "react";
import { DEFAULT_METAS, dedupeValues } from "../lib/valueHistory";

type Props = {
  tokens: string[];
  history: string[];
  onRemove: (value: string) => void;
  onPick: (value: string) => void;
  onClose: () => void;
};

// Where the keyboard focus is: the filter input, or one of the two lists
type Zone = "filter" | "current" | "add";

export default function MetaPicker({ tokens, history, onRemove, onPick, onClose }: Props) {
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(-1);
  const [curHighlight, setCurHighlight] = useState(-1);
  const [zone, setZone] = useState<Zone>("filter");
  const rootRef = useRef<HTMLDivElement>(null);
  const filterRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const curListRef = useRef<HTMLUListElement>(null);

  const tokenSet = useMemo(
    () => new Set(tokens.map(t => t.trim().toLowerCase())),
    [tokens]
  );

  const merged = useMemo(() => dedupeValues([...DEFAULT_METAS, ...history]), [history]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return merged.filter(o => {
      if (tokenSet.has(o.trim().toLowerCase())) return false; // already in the field
      return q === "" || o.toLowerCase().includes(q);
    });
  }, [merged, query, tokenSet]);

  useEffect(() => {
    filterRef.current?.focus();
  }, []);

  // Reset the highlight when the filter text changes
  useEffect(() => {
    setHighlight(filtered.length > 0 ? 0 : -1);
  }, [query]);

  // Initialize/clamp the highlight when items are picked (the list shrinks)
  // or reappear (tokens are removed from the field)
  useEffect(() => {
    setHighlight(h => {
      if (filtered.length === 0) return -1;
      if (h < 0) return 0;
      if (h >= filtered.length) return filtered.length - 1;
      return h;
    });
  }, [filtered.length]);

  // Keep the current-list highlight within bounds
  useEffect(() => {
    setCurHighlight(h => (h >= tokens.length ? tokens.length - 1 : h));
  }, [tokens.length]);

  // Keep the highlighted items in view
  useEffect(() => {
    if (highlight < 0 || !listRef.current) return;
    const el = listRef.current.children[highlight] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "nearest" });
  }, [highlight]);

  useEffect(() => {
    if (curHighlight < 0 || !curListRef.current) return;
    const el = curListRef.current.children[curHighlight] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "nearest" });
  }, [curHighlight]);

  const applyFocus = (z: Zone) => {
    if (z === "filter") {
      filterRef.current?.focus();
    } else if (z === "add") {
      setHighlight(h => (h >= 0 && h < filtered.length ? h : 0));
      listRef.current?.focus();
    } else {
      setCurHighlight(h => (h >= 0 && h < tokens.length ? h : 0));
      curListRef.current?.focus();
    }
    setZone(z);
  };

  // If focus leaves the panel (e.g. the user clicks the meta field while the
  // picker stays open), clear all highlights and the list focus outline
  const onRootBlur = (e: ReactFocusEvent<HTMLDivElement>) => {
    const root = rootRef.current;
    if (root && e.relatedTarget instanceof Node && root.contains(e.relatedTarget)) return;
    setHighlight(-1);
    setCurHighlight(-1);
    setZone("filter");
  };

  // If the mouse leaves the panel while it holds no focus, drop the
  // hover-driven highlights so no stale selection remains
  const onRootMouseLeave = () => {
    const root = rootRef.current;
    if (root && document.activeElement instanceof Node && root.contains(document.activeElement)) return;
    setHighlight(-1);
    setCurHighlight(-1);
  };

  // If the focused list disappears (its last item was removed), fall back to the filter
  useEffect(() => {
    if (zone === "current" && tokens.length === 0) applyFocus("filter");
    else if (zone === "add" && filtered.length === 0) applyFocus("filter");
  }, [zone, tokens.length, filtered.length]);

  // Tab cycle: filter -> add -> current -> filter (Shift+Tab in reverse),
  // skipping lists that are not rendered
  const tabTarget = (from: Zone, forward: boolean): Zone => {
    const order: Zone[] = forward ? ["filter", "add", "current"] : ["filter", "current", "add"];
    const present = (z: Zone) =>
      z === "filter" || (z === "add" ? filtered.length > 0 : tokens.length > 0);
    const start = order.indexOf(from);
    for (let step = 1; step <= order.length; step++) {
      const z = order[(start + step) % order.length];
      if (present(z)) return z;
    }
    return "filter";
  };

  const pick = (v: string) => {
    onPick(v);
    applyFocus("filter");
  };

  const removeCurrent = (i: number) => {
    if (i >= 0 && i < tokens.length) onRemove(tokens[i]);
  };

  // Move the highlight to the same row in the neighboring column of the
  // multi-column "add" list (balanced fill: column k spans
  // [ceil(len*k/cols), ceil(len*(k+1)/cols)))
  const moveColumn = (dir: 1 | -1) => {
    const list = listRef.current;
    const len = filtered.length;
    if (!list || len === 0) return;
    const cols = Math.max(2, parseInt(getComputedStyle(list).columnCount, 10) || 2);
    setHighlight(i => {
      if (i < 0 || i >= len) return i;
      const bounds = Array.from({ length: cols + 1 }, (_, k) => Math.ceil((len * k) / cols));
      let c = 0;
      while (c < cols - 1 && i >= bounds[c + 1]) c++;
      const next = c + dir;
      if (next < 0 || next >= cols) return i;
      const row = i - bounds[c];
      return Math.max(0, Math.min(bounds[next] + row, bounds[next + 1] - 1));
    });
  };

  const onFilterKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight(h => (h + 1 < filtered.length ? h + 1 : h));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight(h => (h - 1 >= 0 ? h - 1 : h));
      return;
    }
    if (e.key === "Tab") {
      e.preventDefault();
      applyFocus(tabTarget("filter", !e.shiftKey));
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const q = query.trim();
      if (q) {
        onPick(q);
        setQuery("");
        return;
      }
      if (highlight >= 0 && highlight < filtered.length) {
        pick(filtered[highlight]);
      }
      return;
    }
    if (e.key === "Escape") {
      e.stopPropagation();
      onClose();
    }
  };

  const onListKeyDown = (e: ReactKeyboardEvent<HTMLUListElement>, which: "current" | "add") => {
    const len = which === "add" ? filtered.length : tokens.length;
    const setHl = which === "add" ? setHighlight : setCurHighlight;
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHl(h => (h + 1 < len ? h + 1 : h));
        return;
      case "ArrowUp":
        e.preventDefault();
        setHl(h => (h - 1 >= 0 ? h - 1 : h));
        return;
      case "Home":
        e.preventDefault();
        if (len > 0) setHl(0);
        return;
      case "End":
        e.preventDefault();
        if (len > 0) setHl(len - 1);
        return;
      case "ArrowLeft":
      case "ArrowRight":
        if (which === "add") {
          e.preventDefault();
          moveColumn(e.key === "ArrowRight" ? 1 : -1);
        }
        return;
      case "Tab":
        e.preventDefault();
        applyFocus(tabTarget(which, !e.shiftKey));
        return;
      case "Enter":
        // pick without moving focus: the list keeps the keyboard focus so
        // consecutive Enter presses add items one after another
        if (which === "add" && highlight >= 0 && highlight < filtered.length) {
          e.preventDefault();
          onPick(filtered[highlight]);
        }
        return;
      case "Delete":
      case "Backspace":
        if (which === "current") {
          e.preventDefault();
          removeCurrent(curHighlight);
        }
        return;
      case "Escape":
        e.stopPropagation();
        onClose();
    }
  };

  return (
    // stop mousedown propagation: a pick re-renders this picker before the
    // outside-click listener in JsonPanel sees the event, and the original
    // target would be detached by then
    <div
      className="meta-picker"
      ref={rootRef}
      onBlur={onRootBlur}
      onMouseLeave={onRootMouseLeave}
      onMouseDown={e => e.stopPropagation()}
    >
      <div className="meta-picker-part">
        <div className="meta-picker-title">current</div>
        {tokens.length === 0 ? (
          <div className="meta-picker-empty">empty</div>
        ) : (
          <ul
            className={
              "meta-picker-list meta-picker-list-current" + (zone === "current" ? " focused" : "")
            }
            ref={curListRef}
            tabIndex={0}
            role="listbox"
            aria-label="current meta values"
            onFocus={() => setZone("current")}
            onKeyDown={e => onListKeyDown(e, "current")}
          >
            {tokens.map((t, i) => (
              <li
                key={t + ":" + i}
                role="option"
                aria-selected={i === curHighlight}
                className={"meta-picker-item" + (i === curHighlight ? " sel" : "")}
                onMouseEnter={() => setCurHighlight(i)}
              >
                <span className="meta-picker-item-text">{t}</span>
                <button
                  type="button"
                  className="meta-picker-del"
                  aria-label={"Remove " + t}
                  title="Remove from the field"
                  onMouseDown={e => {
                    e.preventDefault();
                    e.stopPropagation();
                    onRemove(t);
                  }}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="meta-picker-part grow">
        <div className="meta-picker-title">add</div>
        <input
          ref={filterRef}
          type="text"
          className="meta-picker-filter"
          placeholder="filter"
          spellCheck={false}
          autoComplete="off"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => setZone("filter")}
          onKeyDown={onFilterKeyDown}
        />
        {filtered.length === 0 ? (
          <div className="meta-picker-empty">nothing found</div>
        ) : (
          <div className={"meta-picker-list-scroll" + (zone === "add" ? " focused" : "")}>
            <ul
              className="meta-picker-list"
              ref={listRef}
              tabIndex={0}
              role="listbox"
              aria-label="meta values"
              onFocus={() => setZone("add")}
              onKeyDown={e => onListKeyDown(e, "add")}
            >
              {filtered.map((o, i) => (
                <li
                  key={o}
                  role="option"
                  aria-selected={i === highlight}
                  className={"meta-picker-item" + (i === highlight ? " sel" : "")}
                  onMouseDown={e => {
                    e.preventDefault(); // don't let the browser move focus to the li
                    setHighlight(i); // stay on this row after the pick shifts items up
                    onPick(o);
                    listRef.current?.focus(); // keep the keyboard focus in the list
                  }}
                  onMouseEnter={() => setHighlight(i)}
                >
                  <span className="meta-picker-item-text">{o}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
