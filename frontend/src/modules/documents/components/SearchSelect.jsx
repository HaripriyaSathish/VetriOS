import { useEffect, useRef, useState } from "react";
import { Search, ChevronDown, X } from "lucide-react";
import "../styles/Documents.css";

// Type-to-filter combobox. `options` is [{ value, label }]. Controlled via
// `value` (the selected option's value) + `onChange(value)`.
function SearchSelect({ options, value, onChange, placeholder = "Search…", disabled = false }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef(null);

  const selected = options.find((o) => String(o.value) === String(value));

  useEffect(() => {
    function onDocClick(e) {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const filtered = options.filter((o) => o.label.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="doc-search-select" ref={rootRef}>
      <button
        type="button"
        className="doc-search-select-trigger"
        disabled={disabled}
        onClick={() => setOpen((prev) => !prev)}
      >
        <span className={selected ? "" : "doc-search-select-placeholder"}>
          {selected ? selected.label : placeholder}
        </span>
        {selected ? (
          <X
            size={14}
            onClick={(e) => { e.stopPropagation(); onChange(""); }}
          />
        ) : (
          <ChevronDown size={14} />
        )}
      </button>

      {open && (
        <div className="doc-search-select-panel">
          <div className="doc-search-select-input-wrap">
            <Search size={13} />
            <input
              autoFocus
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Type to search…"
            />
          </div>
          <div className="doc-search-select-options">
            {filtered.length === 0 ? (
              <div className="doc-search-select-empty">No matches.</div>
            ) : (
              filtered.map((o) => (
                <div
                  key={o.value}
                  className={`doc-search-select-option ${String(o.value) === String(value) ? "selected" : ""}`}
                  onClick={() => { onChange(o.value); setOpen(false); setQuery(""); }}
                >
                  {o.label}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default SearchSelect;
