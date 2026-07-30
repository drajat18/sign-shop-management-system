export type StorageProvider = "internal" | "dropbox";

export interface StoredFile {
  storageProvider: StorageProvider;
  filePath: string;
  fileName: string;
}

export interface FileStorageProvider {
  upload(fileName: string, data: Buffer, shopId: string): Promise<StoredFile>;
  // fileId is only used by providers that must proxy through our own API
  // (local disk) rather than returning a self-contained signed URL (R2).
  getDownloadUrl(filePath: string, fileId: string): Promise<string>;
  delete(filePath: string): Promise<void>;
}

const R2_CONFIGURED = Boolean(
  process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY && process.env.R2_BUCKET_NAME
);

// Every caller goes through this factory instead of touching a provider
// directly, so the rest of the app never has to know which one is backing
// a given file. "internal" transparently means R2 when credentials are
// configured, local disk otherwise — shops never choose between the two,
// only between "internal" and "their own Dropbox".
export async function getProvider(provider: StorageProvider): Promise<FileStorageProvider> {
  switch (provider) {
    case "internal": {
      if (R2_CONFIGURED) {
        const { r2Provider } = await import("./r2Provider.js");
        return r2Provider;
      }
      const { internalProvider } = await import("./internalProvider.js");
      return internalProvider;
    }
    case "dropbox": {
      const { dropboxProvider } = await import("./dropboxProvider.js");
      return dropboxProvider;
    }
  }
}
