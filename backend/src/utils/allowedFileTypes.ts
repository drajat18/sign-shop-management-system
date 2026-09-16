// Design/proof files only — an allowlist rather than a denylist, since a
// denylist of "known-dangerous" extensions always misses something (a
// renamed .exe, a new dangerous extension nobody's thought to block yet).
// Anything not on this list is rejected, whatever it's named.
const ALLOWED_EXTENSIONS = new Set([
  // Raster images
  "jpg",
  "jpeg",
  "png",
  "gif",
  "webp",
  "bmp",
  "tif",
  "tiff",
  // Vector / print-ready
  "svg",
  "pdf",
  "eps",
  "ai",
  // Common design-app native formats
  "psd",
  "indd",
  "cdr",
]);

export function isAllowedDesignFile(fileName: string): boolean {
  const dot = fileName.lastIndexOf(".");
  if (dot === -1) return false;
  const ext = fileName.slice(dot + 1).toLowerCase();
  return ALLOWED_EXTENSIONS.has(ext);
}

export function allowedFileTypesLabel(): string {
  return "images, PDF, AI, EPS, PSD, INDD, or CDR";
}
