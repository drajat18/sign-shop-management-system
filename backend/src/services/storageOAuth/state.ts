import jwt from "jsonwebtoken";
import type { StorageOAuthProvider } from "../../models/StorageConnection.js";

export interface StorageOAuthState {
  shopId: string;
  userId: string;
  provider: StorageOAuthProvider;
}

// The OAuth "state" param round-trips through Dropbox/Google and back to
// our public callback with no session or cookie in between — signing it
// ourselves means the callback can trust shopId/userId without a database
// lookup, and a tampered or stale value just fails verification.
export function signOAuthState(payload: StorageOAuthState): string {
  return jwt.sign(payload, process.env.JWT_SECRET!, { expiresIn: "10m" });
}

export function verifyOAuthState(state: string): StorageOAuthState {
  return jwt.verify(state, process.env.JWT_SECRET!) as StorageOAuthState;
}

export function backendUrl(): string {
  return process.env.BACKEND_URL ?? "http://localhost:4000";
}

export function callbackUrl(provider: StorageOAuthProvider): string {
  return `${backendUrl()}/api/storage-oauth/${provider}/callback`;
}
