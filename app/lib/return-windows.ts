export const RETURN_WINDOW_BY_PERIOD = {
  AM: { start: "07:45", end: "10:00" },
  PM: { start: "11:45", end: "15:00" },
} as const;

export function isWeekday(date: Date) {
  const day = date.getDay();
  return day >= 1 && day <= 5;
}

export function nextWeekday(date: Date) {
  const next = new Date(date);
  while (!isWeekday(next)) {
    next.setDate(next.getDate() + 1);
  }
  return next;
}

export function isPeriodValue(value: string): value is keyof typeof RETURN_WINDOW_BY_PERIOD {
  return value === "AM" || value === "PM";
}

export function getReturnWindow(period: keyof typeof RETURN_WINDOW_BY_PERIOD) {
  return RETURN_WINDOW_BY_PERIOD[period];
}

export function isTimeWithinReturnWindow(period: keyof typeof RETURN_WINDOW_BY_PERIOD, timeValue: string) {
  const window = getReturnWindow(period);
  return timeValue >= window.start && timeValue <= window.end;
}

export function filterTimeOptionsForPeriod(
  period: keyof typeof RETURN_WINDOW_BY_PERIOD,
  options: string[],
) {
  return options.filter((timeValue) => isTimeWithinReturnWindow(period, timeValue));
}

export function getChicagoTimeValue(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const hour = parts.find((part) => part.type === "hour")?.value ?? "00";
  const minute = parts.find((part) => part.type === "minute")?.value ?? "00";
  return `${hour}:${minute}`;
}

export function getChicagoWeekday(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    weekday: "short",
  }).format(date);
}
