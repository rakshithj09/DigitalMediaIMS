"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

export type SelectOption = {
  label: string;
  value: string;
  disabled?: boolean;
};

type SelectMenuProps = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  triggerClassName?: string;
  menuClassName?: string;
  ariaLabel?: string;
  searchable?: boolean;
  searchPlaceholder?: string;
};

export default function SelectMenu({
  id,
  value,
  onChange,
  options,
  placeholder = "Select an option",
  disabled = false,
  className,
  triggerClassName,
  menuClassName,
  ariaLabel,
  searchable = false,
  searchPlaceholder = "Search...",
}: SelectMenuProps) {
  const rootRef = React.useRef<HTMLDivElement | null>(null);
  const searchInputRef = React.useRef<HTMLInputElement | null>(null);
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");

  const closeMenu = React.useCallback(() => {
    setOpen(false);
    setSearch("");
  }, []);

  const selectedOption = options.find((option) => option.value === value) ?? null;
  const filteredOptions = React.useMemo(() => {
    if (!searchable) return options;

    const query = search.trim().toLowerCase();
    if (!query) return options;

    return options.filter((option) => option.label.toLowerCase().includes(query));
  }, [options, search, searchable]);

  React.useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        closeMenu();
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [closeMenu, open]);

  React.useEffect(() => {
    if (!open) return;

    if (searchable) {
      queueMicrotask(() => searchInputRef.current?.focus());
    }
  }, [open, searchable]);

  return (
    <div className={cn("relative", className)} ref={rootRef}>
      <button
        id={id}
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => {
          if (open) {
            closeMenu();
          } else {
            setOpen(true);
          }
        }}
        className={cn(
          "flex w-full items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-sm text-slate-900 shadow-sm transition-shadow focus-visible:border-[#005a78] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#005a78]/10 disabled:cursor-not-allowed disabled:opacity-50",
          triggerClassName,
        )}
      >
        <span className={cn("truncate", !selectedOption && "text-slate-400")}>
          {selectedOption?.label ?? placeholder}
        </span>
        <svg
          className={cn("shrink-0 transition-transform", open && "rotate-180")}
          width="16"
          height="16"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          viewBox="0 0 24 24"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && !disabled && (
        <div
          role="listbox"
          className={cn(
            "absolute left-0 top-[calc(100%+0.45rem)] z-30 max-h-72 w-full overflow-auto rounded-xl border border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] p-1.5 shadow-[0_14px_34px_rgba(8,36,58,0.14),0_2px_6px_rgba(15,36,55,0.08)]",
            menuClassName,
          )}
        >
          {searchable && (
            <div className="p-1.5">
              <input
                ref={searchInputRef}
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={searchPlaceholder}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-[#005a78] focus:ring-[3px] focus:ring-[#005a78]/10"
              />
            </div>
          )}

          {filteredOptions.length === 0 ? (
            <div className="px-3 py-2 text-sm text-slate-400">No matches found.</div>
          ) : filteredOptions.map((option) => {
            const isSelected = option.value === value;

            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={isSelected}
                disabled={option.disabled}
                onClick={() => {
                  onChange(option.value);
                  closeMenu();
                }}
                className={cn(
                  "flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm transition",
                  option.disabled
                    ? "cursor-not-allowed text-slate-300"
                    : isSelected
                    ? "bg-[#e8f0fe] text-[#005a78]"
                    : "text-slate-700 hover:bg-slate-50 hover:text-slate-900",
                )}
              >
                <span className="truncate">{option.label}</span>
                {isSelected && (
                  <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.4" viewBox="0 0 24 24">
                    <path d="m5 12 5 5L20 7" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
