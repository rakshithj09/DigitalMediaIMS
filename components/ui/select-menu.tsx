"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";

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
  const menuRef = React.useRef<HTMLDivElement | null>(null);
  const searchInputRef = React.useRef<HTMLInputElement | null>(null);
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [menuLayout, setMenuLayout] = React.useState<{
    left: number;
    top: number;
    width: number;
    maxHeight: number;
  } | null>(null);

  const closeMenu = React.useCallback(() => {
    setOpen(false);
    setSearch("");
    setMenuLayout(null);
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
      const target = event.target as Node;
      if (!rootRef.current?.contains(target) && !menuRef.current?.contains(target)) {
        closeMenu();
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [closeMenu, open]);

  React.useEffect(() => {
    if (!open) return;

    const updateMenuLayout = () => {
      const rect = rootRef.current?.getBoundingClientRect();
      if (!rect) return;

      const gap = 8;
      const viewportPadding = 12;
      const availableBelow = window.innerHeight - rect.bottom - viewportPadding - gap;
      const availableAbove = rect.top - viewportPadding - gap;
      const placeAbove = availableBelow < 180 && availableAbove > availableBelow;
      const maxHeight = Math.max(160, Math.min(288, placeAbove ? availableAbove : availableBelow));

      setMenuLayout({
        left: Math.max(viewportPadding, Math.min(rect.left, window.innerWidth - rect.width - viewportPadding)),
        top: placeAbove ? rect.top - gap - maxHeight : rect.bottom + gap,
        width: rect.width,
        maxHeight,
      });
    };

    updateMenuLayout();
    const handleScroll = (event: Event) => {
      if (event.target instanceof Node && menuRef.current?.contains(event.target)) return;
      closeMenu();
    };

    window.addEventListener("resize", updateMenuLayout);
    window.addEventListener("scroll", handleScroll, true);

    return () => {
      window.removeEventListener("resize", updateMenuLayout);
      window.removeEventListener("scroll", handleScroll, true);
    };
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
        <ChevronDown className={cn("shrink-0 transition-transform", open && "rotate-180")} size={16} strokeWidth={2.2} />
      </button>

      {open && !disabled && menuLayout && createPortal(
        <div
          ref={menuRef}
          role="listbox"
          className={cn(
            "fixed z-50 overflow-auto rounded-xl border border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] p-1.5 shadow-[0_14px_34px_rgba(8,36,58,0.14),0_2px_6px_rgba(15,36,55,0.08)]",
            menuClassName,
          )}
          style={{
            left: menuLayout.left,
            top: menuLayout.top,
            width: menuLayout.width,
            maxHeight: menuLayout.maxHeight,
          }}
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
                {isSelected && <Check size={14} strokeWidth={2.4} />}
              </button>
            );
          })}
        </div>,
        document.body
      )}
    </div>
  );
}
