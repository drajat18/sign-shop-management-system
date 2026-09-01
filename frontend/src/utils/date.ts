// Due dates and install dates are stored as date-only values (UTC midnight
// representing a calendar date, not a real moment in time). Reading them
// with `new Date(iso).toLocaleDateString()` re-interprets that UTC instant
// in the viewer's local timezone, which rolls the displayed date back by one
// for anyone west of UTC — a shop in the US could see "9/14" for a date that
// was entered as 9/15. These helpers read the Y-M-D straight off the ISO
// string instead, so the calendar date shown always matches what was typed,
// regardless of the viewer's timezone.

function dateOnlyParts(value: string): [number, number, number] {
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  return [year, month, day];
}

export function formatDate(value?: string | null): string {
  if (!value) return "";
  const [year, month, day] = dateOnlyParts(value);
  return new Date(year, month - 1, day).toLocaleDateString();
}

export function formatDateTime(value?: string | null): string {
  if (!value) return "";
  const [year, month, day] = dateOnlyParts(value);
  return new Date(year, month - 1, day).toLocaleString();
}

// Compares calendar dates, not instants — a due date is "past" once today's
// local calendar date is after it, independent of what time of day it is.
export function isDateOnlyPast(value?: string | null): boolean {
  if (!value) return false;
  const [year, month, day] = dateOnlyParts(value);
  const target = new Date(year, month - 1, day);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return target.getTime() < today.getTime();
}
