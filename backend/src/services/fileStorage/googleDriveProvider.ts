import { Readable } from "node:stream";
import { google, type drive_v3 } from "googleapis";
import { getShopModels } from "../../models/shopModels.js";
import { getShopConnection } from "../shopConnection.js";
import { googleOAuthClient } from "../storageOAuth/googleOAuth.js";
import type { FileStorageProvider } from "./index.js";

async function driveClient(shopId: string): Promise<drive_v3.Drive> {
  const { StorageConnection } = getShopModels(getShopConnection(shopId));
  const connection = await StorageConnection.findOne({ provider: "google_drive" });
  if (!connection) {
    throw new Error("This shop hasn't connected Google Drive yet — connect it in Settings first.");
  }

  const auth = googleOAuthClient();
  auth.setCredentials({ access_token: connection.accessToken, refresh_token: connection.refreshToken });
  // googleapis refreshes expired access tokens transparently on demand
  // (it holds the refresh_token already), and this listener just persists
  // whatever it comes up with so the next request skips the refresh.
  auth.on("tokens", (tokens) => {
    if (tokens.access_token) {
      connection.accessToken = tokens.access_token;
      void connection.save();
    }
  });

  return google.drive({ version: "v3", auth });
}

export const googleDriveProvider: FileStorageProvider = {
  async upload(fileName, data, shopId) {
    const drive = await driveClient(shopId);
    const res = await drive.files.create({
      requestBody: { name: fileName },
      media: { mimeType: "application/octet-stream", body: Readable.from(data) },
      fields: "id",
    });
    const fileId = res.data.id;
    if (!fileId) throw new Error("Google Drive upload didn't return a file ID.");
    return { storageProvider: "google_drive", filePath: fileId, fileName };
  },
  async getDownloadUrl(filePath, _fileId, shopId) {
    const drive = await driveClient(shopId);
    // Same idea as Dropbox's temporary link — a scoped, single-file grant
    // rather than exposing the whole connected Drive. Re-issuing this on
    // every download keeps it simple rather than tracking expiry ourselves.
    await drive.permissions.create({
      fileId: filePath,
      requestBody: { role: "reader", type: "anyone" },
    });
    return `https://drive.google.com/uc?export=download&id=${filePath}`;
  },
  async delete(filePath, shopId) {
    const drive = await driveClient(shopId);
    await drive.files.delete({ fileId: filePath });
  },
};
