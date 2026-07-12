export type StorageProvider = "internal" | "dropbox";

export interface StoredFile {
  storageProvider: StorageProvider;
  filePath: string;
  fileName: string;
}

export interface FileStorageProvider {
  upload(fileName: string, data: Buffer): Promise<StoredFile>;
  getDownloadUrl(filePath: string): Promise<string>;
  delete(filePath: string): Promise<void>;
}

// Every caller goes through this factory instead of touching a provider
// directly, so the rest of the app never has to know which one is backing
// a given file.
export async function getProvider(provider: StorageProvider): Promise<FileStorageProvider> {
  switch (provider) {
    case "internal": {
      const { internalProvider } = await import("./internalProvider.js");
      return internalProvider;
    }
    case "dropbox": {
      const { dropboxProvider } = await import("./dropboxProvider.js");
      return dropboxProvider;
    }
  }
}
