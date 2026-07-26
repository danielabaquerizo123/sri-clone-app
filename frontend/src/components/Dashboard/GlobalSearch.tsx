import { Search } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import HeaderDropdownPortal from "./HeaderDropdownPortal";
import type { NavigationRegistryItem } from "./navigationRegistry";

interface GlobalSearchProps {
  items: NavigationRegistryItem[];
  onNavigate: (tab: string) => void;
}

export default function GlobalSearch({ items, onNavigate }: GlobalSearchProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listId = useId();

  const searchableItems = useMemo(() => items.filter((item) => item.enabled), [items]);
  const results = useMemo(() => {
    const normalizedQuery = normalize(query);

    if (!normalizedQuery) {
      return searchableItems.filter((item) => item.principal).slice(0, 7);
    }

    return searchableItems
      .filter((item) => {
        const haystack = normalize(
          [item.titulo, item.descripcion, ...item.palabrasClave].join(" ")
        );
        return haystack.includes(normalizedQuery);
      })
      .slice(0, 8);
  }, [query, searchableItems]);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen(true);
        inputRef.current?.focus();
      }
    };

    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  const selectItem = (item: NavigationRegistryItem) => {
    onNavigate(item.tab);
    setQuery("");
    setOpen(false);
    inputRef.current?.blur();
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open && ["ArrowDown", "ArrowUp", "Enter"].includes(event.key)) {
      setOpen(true);
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((current) => Math.min(current + 1, Math.max(results.length - 1, 0)));
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) => Math.max(current - 1, 0));
    }

    if (event.key === "Enter" && results[activeIndex]) {
      event.preventDefault();
      selectItem(results[activeIndex]);
    }

    if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      inputRef.current?.blur();
    }
  };

  return (
    <div ref={wrapperRef} className="hidden min-w-[240px] max-w-[420px] flex-1 lg:block">
      <div className="flex h-[52px] w-full min-w-0 items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 text-slate-500 shadow-[0_8px_18px_rgba(15,23,42,0.08)]">
        <Search size={18} className="shrink-0 text-slate-400" />
        <input
          ref={inputRef}
          aria-activedescendant={results[activeIndex] ? `${listId}-${results[activeIndex].id}` : undefined}
          aria-controls={listId}
          aria-expanded={open}
          aria-label="Buscar opciones del sistema"
          className="min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none placeholder:text-slate-400"
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Buscar en el sistema..."
          role="combobox"
          value={query}
        />
        <span className="hidden rounded-lg bg-slate-100 px-2 py-1 text-[10px] font-black text-slate-500 sm:inline">
          Ctrl + K
        </span>
      </div>

      <HeaderDropdownPortal
        anchorRef={wrapperRef}
        open={open}
        width={390}
        onClose={() => setOpen(false)}
      >
        <div className="max-h-[420px] overflow-hidden rounded-2xl border border-slate-200 bg-white py-2 shadow-2xl">
          <div className="border-b border-slate-100 px-4 py-3">
            <p className="text-sm font-black text-[#082b68]">Buscar opciones</p>
            <p className="text-xs font-semibold text-slate-500">
              Navega por modulos y acciones disponibles.
            </p>
          </div>
          <div id={listId} role="listbox" className="max-h-[340px] overflow-y-auto p-2">
            {results.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm font-semibold text-slate-500">
                No se encontraron opciones.
              </p>
            ) : (
              results.map((item, index) => (
                <button
                  id={`${listId}-${item.id}`}
                  key={item.id}
                  type="button"
                  role="option"
                  aria-selected={index === activeIndex}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => selectItem(item)}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition ${
                    index === activeIndex ? "bg-blue-50" : "hover:bg-slate-50"
                  }`}
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                    {item.icono}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-black text-[#082b68]">
                      {item.titulo}
                    </span>
                    <span className="block truncate text-xs font-semibold text-slate-500">
                      {item.descripcion}
                    </span>
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      </HeaderDropdownPortal>
    </div>
  );
}

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}
