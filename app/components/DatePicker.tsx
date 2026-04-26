"use client";

import { useEffect, useMemo, useRef, useState } from "react";

function toLocalDateInputValue(date: Date) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function parseLocalDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function sameCalendarDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function formatDisplayDate(value: string, placeholder: string) {
  if (!value) return placeholder;

  const date = parseLocalDate(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function buildCalendarDays(month: Date) {
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const firstDay = new Date(year, monthIndex, 1);
  const startOffset = firstDay.getDay();
  const gridStart = new Date(year, monthIndex, 1 - startOffset);

  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(gridStart);
    day.setDate(gridStart.getDate() + index);
    return day;
  });
}

export default function DatePicker({
  value,
  onChange,
  minDate,
  placeholder = "Select date",
  quickActionLabel = "Today",
  className = "",
  disableWeekends = false,
}: {
  value: string;
  onChange: (value: string) => void;
  minDate?: string;
  placeholder?: string;
  quickActionLabel?: string;
  className?: string;
  disableWeekends?: boolean;
}) {
  const pickerRef = useRef<HTMLDivElement | null>(null);
  const today = new Date();
  const selectedDate = value ? parseLocalDate(value) : null;
  const minSelectableDate = minDate ? parseLocalDate(minDate) : null;
  const [open, setOpen] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const initialDate = selectedDate ?? minSelectableDate ?? today;
    return new Date(initialDate.getFullYear(), initialDate.getMonth(), 1);
  });

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!pickerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  const calendarDays = useMemo(() => buildCalendarDays(visibleMonth), [visibleMonth]);
  const monthLabel = visibleMonth.toLocaleDateString([], { month: "long", year: "numeric" });
  const minMonth = minSelectableDate
    ? new Date(minSelectableDate.getFullYear(), minSelectableDate.getMonth(), 1)
    : null;
  const disablePrevMonth = minMonth ? visibleMonth <= minMonth : false;

  return (
    <div className={`relative ${className}`.trim()} ref={pickerRef}>
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] px-3.5 py-2.5 text-left text-sm text-slate-900 shadow-sm transition hover:border-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#005a78]/20"
        onClick={() => {
          if (!open) {
            const nextFocusDate = selectedDate ?? minSelectableDate ?? today;
            setVisibleMonth(new Date(nextFocusDate.getFullYear(), nextFocusDate.getMonth(), 1));
          }
          setOpen((current) => !current);
        }}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span className={value ? "" : "text-slate-400"}>{formatDisplayDate(value, placeholder)}</span>
        <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div
          className="absolute left-0 top-[calc(100%+0.65rem)] z-30 w-[min(20rem,calc(100vw-3rem))] rounded-2xl border border-slate-200 bg-[radial-gradient(circle_at_top_right,rgba(255,210,31,0.16),transparent_32%),linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] p-4 shadow-[0_16px_44px_rgba(8,36,58,0.16),0_2px_6px_rgba(15,36,55,0.08)]"
          role="dialog"
          aria-label="Choose date"
        >
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <p className="m-0 text-[0.68rem] font-bold uppercase tracking-[0.11em] text-slate-500">Select date</p>
              <h4 className="mt-1 text-base font-extrabold tracking-[-0.02em]" style={{ color: "var(--ignite-navy)" }}>
                {monthLabel}
              </h4>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-900 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-35"
                onClick={() => setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))}
                disabled={disablePrevMonth}
                aria-label="Previous month"
              >
                <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.4" viewBox="0 0 24 24">
                  <path d="m15 18-6-6 6-6" />
                </svg>
              </button>
              <button
                type="button"
                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-900 transition hover:border-slate-300 hover:bg-slate-50"
                onClick={() => setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))}
                aria-label="Next month"
              >
                <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.4" viewBox="0 0 24 24">
                  <path d="m9 18 6-6-6-6" />
                </svg>
              </button>
            </div>
          </div>

          <div className="mb-1.5 grid grid-cols-7 gap-1">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((label) => (
              <span key={label} className="text-center text-[0.7rem] font-bold uppercase tracking-[0.08em] text-slate-500">
                {label}
              </span>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map((day) => {
              const dayValue = toLocalDateInputValue(day);
              const isCurrentMonth = day.getMonth() === visibleMonth.getMonth();
              const isWeekend = day.getDay() === 0 || day.getDay() === 6;
              const isDisabled = (minSelectableDate ? day < minSelectableDate : false) || (disableWeekends && isWeekend);
              const isSelected = selectedDate ? sameCalendarDay(day, selectedDate) : false;
              const isToday = sameCalendarDay(day, today);
              const dayClasses = [
                "h-10 rounded-xl border text-sm font-semibold transition",
                isSelected
                  ? "border-[#0957ac] bg-[linear-gradient(180deg,#0b74d8_0%,#0a64c2_100%)] text-white shadow-[inset_0_-1px_0_rgba(255,255,255,0.15),0_6px_14px_rgba(10,100,194,0.22)]"
                  : isDisabled
                  ? "cursor-not-allowed border-transparent bg-transparent text-slate-300"
                  : isToday
                  ? "border-[#005a782e] bg-transparent text-[#005a78] hover:border-blue-200 hover:bg-blue-50"
                  : "border-transparent bg-transparent text-slate-900 hover:border-blue-200 hover:bg-blue-50",
                !isCurrentMonth && !isSelected && !isDisabled ? "text-slate-400" : "",
              ]
                .filter(Boolean)
                .join(" ");

              return (
                <button
                  key={dayValue}
                  type="button"
                  className={dayClasses}
                  disabled={isDisabled}
                  onClick={() => {
                    setVisibleMonth(new Date(day.getFullYear(), day.getMonth(), 1));
                    onChange(dayValue);
                    setOpen(false);
                  }}
                >
                  {day.getDate()}
                </button>
              );
            })}
          </div>

          <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-200 pt-3.5">
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-900 transition hover:border-slate-300 hover:bg-slate-50"
              onClick={() => {
                onChange("");
                setOpen(false);
              }}
            >
              Clear
            </button>
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-full border px-3 py-1.5 text-xs font-bold transition"
              style={{ borderColor: "rgba(0, 90, 120, 0.16)", background: "rgba(0, 90, 120, 0.08)", color: "var(--ignite-navy)" }}
              onClick={() => {
                const nextDate = new Date(today);
                if (disableWeekends) {
                  while (nextDate.getDay() === 0 || nextDate.getDay() === 6) {
                    nextDate.setDate(nextDate.getDate() + 1);
                  }
                }
                const todayValue = toLocalDateInputValue(nextDate);
                onChange(minDate && todayValue < minDate ? minDate : todayValue);
                setVisibleMonth(new Date(nextDate.getFullYear(), nextDate.getMonth(), 1));
                setOpen(false);
              }}
            >
              {quickActionLabel}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
