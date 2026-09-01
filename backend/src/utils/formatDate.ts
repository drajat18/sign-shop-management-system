// Due dates and install dates are stored as date-only values — UTC midnight
// standing in for a calendar date, not a real moment in time. Formatting
// them with the server's local timezone (Node's default for
// toLocaleDateString) re-interprets that UTC instant locally, which can
// roll the displayed date back by one depending on where the process runs.
// Forcing the UTC timezone here always recovers the exact calendar date
// that was stored, regardless of server locale — the customer-facing CSV
// export and notification text both depend on this being right.
export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-US", { timeZone: "UTC" });
}
