import type { FileStorageProvider } from "./index.js";

// Placeholder S3/R2-backed implementation. Wire up @aws-sdk/client-s3
// (or equivalent) here once bucket credentials are available.
export const internalProvider: FileStorageProvider = {
  async upload(_fileName, _data) {
    throw new Error("internalProvider.upload not implemented yet");
  },
  async getDownloadUrl(_filePath) {
    throw new Error("internalProvider.getDownloadUrl not implemented yet");
  },
  async delete(_filePath) {
    throw new Error("internalProvider.delete not implemented yet");
  },
};
