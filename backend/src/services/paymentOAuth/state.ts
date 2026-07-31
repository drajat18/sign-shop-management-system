import jwt from "jsonwebtoken";
import type { PaymentOAuthProvider } from "../../models/PaymentConnection.js";

export interface PaymentConnectState {
  shopId: string;
  userId: string;
  provider: PaymentOAuthProvider;
  // Set when the real processor isn't configured — the "state" doubles as
  // the whole session for the dummy connect flow (see billing's
  // DummyCheckoutSession precedent, simplified further here: no DB record
  // needed at all since everything the completion step needs already
  // lives in this signed token).
  dummy?: boolean;
}

export function signPaymentConnectState(payload: PaymentConnectState): string {
  return jwt.sign(payload, process.env.JWT_SECRET!, { expiresIn: "10m" });
}

export function verifyPaymentConnectState(state: string): PaymentConnectState {
  return jwt.verify(state, process.env.JWT_SECRET!) as PaymentConnectState;
}

export function paymentBackendUrl(): string {
  return process.env.BACKEND_URL ?? "http://localhost:4000";
}

export function paymentCallbackUrl(provider: PaymentOAuthProvider): string {
  return `${paymentBackendUrl()}/api/payment-oauth/${provider}/callback`;
}

export interface ChargeLinkToken {
  shopId: string;
  orderId: string;
  amount: number;
}

export function signChargeLinkToken(payload: ChargeLinkToken): string {
  return jwt.sign(payload, process.env.JWT_SECRET!, { expiresIn: "1h" });
}

export function verifyChargeLinkToken(token: string): ChargeLinkToken {
  return jwt.verify(token, process.env.JWT_SECRET!) as ChargeLinkToken;
}
