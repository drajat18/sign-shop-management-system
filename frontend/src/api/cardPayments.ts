import { apiFetch } from "./client.js";

export type CardPaymentIntentResponse =
  | { mode: "dummy"; attemptId: string }
  | { mode: "stripe"; clientSecret: string; publishableKey?: string; connectedAccountId: string };

export async function createCardPaymentIntent(
  orderId: string,
  amount: number,
  token: string | null
): Promise<CardPaymentIntentResponse> {
  return apiFetch<CardPaymentIntentResponse>(`/orders/${orderId}/card-payment-intent`, {
    method: "POST",
    token,
    body: JSON.stringify({ amount }),
  });
}

export async function confirmCardPaymentIntent(
  orderId: string,
  paymentIntentId: string,
  token: string | null
): Promise<void> {
  await apiFetch(`/orders/${orderId}/card-payment-intent/${paymentIntentId}/confirm`, {
    method: "POST",
    token,
  });
}

export async function completeDummyCardPayment(
  orderId: string,
  amount: number,
  attemptId: string,
  token: string | null
): Promise<void> {
  await apiFetch(`/orders/${orderId}/card-payment-intent/dummy-complete`, {
    method: "POST",
    token,
    body: JSON.stringify({ amount, attemptId }),
  });
}
