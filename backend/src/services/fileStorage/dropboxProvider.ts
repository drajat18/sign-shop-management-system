import crypto from "node:crypto";
import { Dropbox, DropboxAuth } from "dropbox";
import { getShopModels } from "../../models/shopModels.js";
import { getShopConnection } from "../shopConnection.js";
import { refreshDropboxAccessToken } from "../storageOAuth/dropboxOAuth.js";
import type { FileStorageProvider } from "./index.js";

async function client(shopId: string): Promise<{ dbx: Dropbox; onRefreshed: (token: string) => Promise<void> }> {
  const { StorageConnection } = getShopModels(getShopConnection(shopId));
  const connection = await StorageConnection.findOne({ provider: "dropbox" });
  if (!connection) {
    throw new Error("This shop hasn't connected Dropbox yet — connect it in Settings first.");
  }

  const auth = new DropboxAuth({
    clientId: process.env.DROPBOX_APP_KEY,
    clientSecret: process.env.DROPBOX_APP_SECRET,
    accessToken: connection.accessToken,
    refreshToken: connection.refreshToken,
  });

  return {
    dbx: new Dropbox({ auth }),
    // Dropbox short-lived access tokens expire in a few hours — persisting
    // a refreshed one means the next call doesn't have to refresh again.
    onRefreshed: async (token: string) => {
      connection.accessToken = token;
      await connection.save();
    },
  };
}

// Wraps a Dropbox SDK call so an expired access token is refreshed and
// retried exactly once, instead of every call paying for a refresh
// up front or a stale token failing outright.
async function withAutoRefresh<T>(shopId: string, fn: (dbx: Dropbox) => Promise<T>): Promise<T> {
  const { dbx, onRefreshed } = await client(shopId);
  try {
    return await fn(dbx);
  } catch (err) {
    const status = (err as { status?: number }).status;
    if (status !== 401) throw err;
    const { StorageConnection } = getShopModels(getShopConnection(shopId));
    const connection = await StorageConnection.findOne({ provider: "dropbox" });
    if (!connection) throw err;
    const freshToken = await refreshDropboxAccessToken(connection.refreshToken);
    await onRefreshed(freshToken);
    const retried = new Dropbox({ auth: new DropboxAuth({ accessToken: freshToken }) });
    return fn(retried);
  }
}

export const dropboxProvider: FileStorageProvider = {
  async upload(fileName, data, shopId) {
    const path = `/${crypto.randomUUID()}-${fileName.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    await withAutoRefresh(shopId, (dbx) =>
      dbx.filesUpload({ path, contents: data, mode: { ".tag": "add" } })
    );
    return { storageProvider: "dropbox", filePath: path, fileName };
  },
  async getDownloadUrl(filePath, _fileId, shopId) {
    const result = await withAutoRefresh(shopId, (dbx) => dbx.filesGetTemporaryLink({ path: filePath }));
    return result.result.link;
  },
  async delete(filePath, shopId) {
    await withAutoRefresh(shopId, (dbx) => dbx.filesDeleteV2({ path: filePath }));
  },
};
