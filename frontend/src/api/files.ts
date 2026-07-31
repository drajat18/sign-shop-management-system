import { apiFetch } from "./client.js";
import type { ArtworkFile, StorageProvider } from "../types/index.js";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(",")[1] ?? "");
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export async function uploadArtwork(
  file: File,
  orderId: string,
  orderItemId: string,
  token: string | null,
  storageProvider: StorageProvider = "internal"
): Promise<ArtworkFile> {
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error("File is too large (15MB max)");
  }
  const data = await fileToBase64(file);
  return apiFetch<ArtworkFile>("/files", {
    method: "POST",
    token,
    body: JSON.stringify({
      fileName: file.name,
      orderId,
      orderItemId,
      storageProvider,
      data,
    }),
  });
}

export async function getDownloadUrl(
  fileId: string,
  token: string | null
): Promise<{ url: string; fileName: string }> {
  return apiFetch(`/files/${fileId}/download-url`, { token });
}

// Internal-storage files live behind an authenticated route, so a plain
// <a href> can't fetch them — pull the blob with the auth header, then
// trigger a normal browser download from an object URL.
export async function downloadArtwork(fileId: string, fileName: string, token: string | null): Promise<void> {
  const res = await fetch(`${API_URL}/api/files/${fileId}/raw`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error("Download failed");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}
