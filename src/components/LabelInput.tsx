import { useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent, ReactNode, RefObject } from "react";

type Props = {
  id: string;
  value: string;
  options: string[];
  placeholder?: string;
  // A button rendered inside the field (on the right)
  trailing?: ReactNode;
  // A popover rendered above the field (e.g. a custom picker)
  overlay?: ReactNode;
  // Suppress the built-in autocomplete list
  disableList?: boolean;
  inputRef?: RefObject<HTMLInputElement | null>;
  onChange: (value: string) => void;
  onEnter?: () => void;
  onFocus?: () => void;
  onBlur?: () => void;
  onRemove?: (value: string) => void;
  // Final commit of the value (blur, selection from the list, Enter)
  onCommit?: (value: string) => void;
  // Values without the × button (e.g. defaults)
  readOnlyValues?: string[];
  // How to extract the search query from the value (default — the whole value)
  getQuery?: (value: string) => string;
  // Values not to suggest (default — the current value)
  excludeValues?: string[];
  // How to transform the whole value when an item is selected (default — replace entirely)
  onSelect?: (value: string, selected: string) => string;
  ariaLabel?: string;
};

export default function LabelInput({
  id,
  value,
  options,
  placeholder,
  trailing,
  overlay,
  disableList,
  inputRef,
  onChange,
  onEnter,
  onFocus,
  onBlur,
  onRemove,
  onCommit,
  readOnlyValues,
  getQuery,
  excludeValues,
  onSelect,
  ariaLabel = "label"
}: Props) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const filtered = useMemo(() => {
    const q = (getQuery ? getQuery(value) : value.trim()).toLowerCase();
    const excluded = new Set(
      (excludeValues ?? [value]).map(v => v.trim().toLowerCase())
    );
    return options.filter(o => {
      const v = o.toLowerCase();
      if (excluded.has(v)) return false; // don't suggest what is already there
      return q === "" || v.includes(q);
    });
  }, [options, value, getQuery, excludeValues]);

  // Reset the highlight when the set of options changes
  useEffect(() => {
    setHighlight(filtered.length > 0 ? 0 : -1);
  }, [filtered.length]);

  // Close on an outside click
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  // Keep the highlighted item in view
  useEffect(() => {
    if (!open || highlight < 0 || !listRef.current) return;
    const el = listRef.current.children[highlight] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "nearest" });
  }, [open, highlight]);

  const select = (v: string) => {
    const next = onSelect ? onSelect(value, v) : v;
    onChange(next);
    setOpen(false);
    if (onCommit) onCommit(next);
  };

  const onKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) setOpen(true);
      else setHighlight(h => (h + 1 < filtered.length ? h + 1 : h));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) setOpen(true);
      else setHighlight(h => (h - 1 >= 0 ? h - 1 : h));
      return;
    }
    if (e.key === "Enter") {
      if (open && highlight >= 0 && highlight < filtered.length) {
        e.preventDefault();
        select(filtered[highlight]);
      } else {
        if (onCommit) onCommit(value);
        if (onEnter) onEnter();
      }
      return;
    }
    if (e.key === "Escape" && open && !disableList) {
      e.stopPropagation();
      setOpen(false);
    }
  };

  const showList = !disableList && open && filtered.length > 0;

  return (
    <div className={"label-combo" + (trailing ? " has-trailing" : "")} ref={rootRef}>
      <input
        id={id}
        ref={inputRef}
        type="text"
        value={value}
        placeholder={placeholder}
        spellCheck={false}
        autoComplete="off"
        role="combobox"
        aria-expanded={showList}
        aria-autocomplete="list"
        aria-controls={showList ? id + "list" : undefined}
        onChange={e => {
          onChange(e.target.value);
          if (!disableList) setOpen(true);
        }}
        onFocus={() => {
          if (!disableList && filtered.length > 0) setOpen(true);
          onFocus?.();
        }}
        onBlur={() => {
          setOpen(false);
          if (onCommit) onCommit(value);
          onBlur?.();
        }}
        onKeyDown={onKeyDown}
      />
      {trailing}
      {showList && (
        <ul
          className="label-combo-list"
          id={id + "list"}
          ref={listRef}
          role="listbox"
          aria-label={ariaLabel}
        >
          {filtered.map((o, i) => {
            const removable =
              onRemove !== undefined &&
              !readOnlyValues?.some(d => d.toLowerCase() === o.trim().toLowerCase());
            return (
              <li
                key={o}
                role="option"
                aria-selected={i === highlight}
                className={"label-combo-opt" + (i === highlight ? " sel" : "")}
                onMouseDown={e => {
                  e.preventDefault(); // don't let the input lose focus
                  select(o);
                }}
                onMouseEnter={() => setHighlight(i)}
              >
                <span className="label-combo-opt-text">{o}</span>
                {removable && (
                  <button
                    type="button"
                    className="label-combo-del"
                    aria-label={"Remove " + o}
                    title="Remove from the list"
                    onMouseDown={e => {
                      e.preventDefault();
                      e.stopPropagation();
                      onRemove(o);
                    }}
                  >
                    ×
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {overlay}
    </div>
  );
}
