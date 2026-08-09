import { apiFetch } from "./client.js";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

export async function bulkUpdateOrders(
  input: { orderIds: string[]; status?: string; paymentStatus?: string },
  token: string | null
): Promise<{ updated: number }> {
  return apiFetch<{ updated: number }>("/orders/bulk", {
    method: "PATCH",
    token,
    body: JSON.stringify(input),
  });
}

// CSV needs the auth header, so a plain <a href> can't fetch it — same
// blob-download pattern as downloadArtwork in api/files.ts.
export async function exportOrdersCsv(
  params: URLSearchParams,
  token: string | null
): Promise<void> {
  const res = await fetch(`${API_URL}/api/orders/export?${params.toString()}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error("Export failed");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "orders.csv";
  a.click();
  URL.revokeObjectURL(url);
}
