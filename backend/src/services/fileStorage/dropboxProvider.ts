import type { FileStorageProvider } from "./index.js";

// Placeholder Dropbox-backed implementation. Wire up the shop-level OAuth
// token (stored from Settings) and the Dropbox API SDK here.
export const dropboxProvider: FileStorageProvider = {
  async upload(_fileName, _data) {
    throw new Error("dropboxProvider.upload not implemented yet");
  },
  async getDownloadUrl(_filePath) {
    throw new Error("dropboxProvider.getDownloadUrl not implemented yet");
  },
  async delete(_filePath) {
    throw new Error("dropboxProvider.delete not implemented yet");
  },
};
