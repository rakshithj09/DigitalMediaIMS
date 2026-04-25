export type CheckoutDeadlineState = "healthy" | "warning" | "danger" | "overdue";

type DeadlineMeta = {
  checkedOutDate: Date;
  dueDate: Date;
  totalMs: number;
  elapsedMs: number;
  remainingMs: number;
  progress: number;
  state: CheckoutDeadlineState;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function getCheckoutDeadlineMeta(checkedOutAt?: string | null, dueAt?: string | null): DeadlineMeta | null {
  if (!checkedOutAt || !dueAt) return null;

  const checkedOutDate = new Date(checkedOutAt);
  const dueDate = new Date(dueAt);

  if (Number.isNaN(checkedOutDate.getTime()) || Number.isNaN(dueDate.getTime())) {
    return null;
  }

  const totalMs = dueDate.getTime() - checkedOutDate.getTime();
  if (totalMs <= 0) return null;

  const nowMs = Date.now();
  const elapsedMs = nowMs - checkedOutDate.getTime();
  const remainingMs = dueDate.getTime() - nowMs;
  const progress = clamp(elapsedMs / totalMs, 0, 1);

  let state: CheckoutDeadlineState = "healthy";
  if (remainingMs <= 0) state = "overdue";
  else if (progress >= 0.75) state = "danger";
  else if (progress >= 0.5) state = "warning";

  return {
    checkedOutDate,
    dueDate,
    totalMs,
    elapsedMs,
    remainingMs,
    progress,
    state,
  };
}

export function formatDateTime(value?: string | null) {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatRemainingTime(ms: number) {
  const absMs = Math.abs(ms);
  const totalMinutes = Math.max(1, Math.round(absMs / 60000));
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (days === 0 && minutes > 0) parts.push(`${minutes}m`);

  return parts.slice(0, 2).join(" ");
}
