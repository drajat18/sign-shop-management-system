import jwt from "jsonwebtoken";
import type { AccountingProvider } from "../../models/AccountingConnection.js";

export interface AccountingOAuthState {
  shopId: string;
  userId: string;
  provider: AccountingProvider;
}

// Same signed-state round-trip as storageOAuth/paymentOAuth — the state
// carries shopId/userId through the provider's redirect and back without a
// session, and a tampered or stale value just fails verification.
export function signAccountingOAuthState(payload: AccountingOAuthState): string {
  return jwt.sign(payload, process.env.JWT_SECRET!, { expiresIn: "10m" });
}

export function verifyAccountingOAuthState(state: string): AccountingOAuthState {
  return jwt.verify(state, process.env.JWT_SECRET!) as AccountingOAuthState;
}
